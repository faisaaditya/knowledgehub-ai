// @ts-ignore
declare const Deno: any;

// @ts-ignore
import "@supabase/functions-js/edge-runtime.d.ts";

// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";
// @ts-ignore
import * as pdfjs from "npm:pdfjs-dist@4.0.379";

// --- Konfigurasi ---
const CHUNK_SIZE = 300;
const CHUNK_OVERLAP = 30;
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_PAGES = 10;
const MAX_CHUNKS = 50;

// --- Model Embedding (Reuse - dibuat sekali per invocation) ---
let embedModel: any = null;

async function generateEmbedding(text: string, genAI: GoogleGenerativeAI): Promise<number[]> {
  if (!embedModel) {
    embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  }
  const result = await embedModel.embedContent(text);
  const embedding = result.embedding.values;
  
  // Log dimensi hanya di chunk pertama
  if (!globalThis.__embedding_logged) {
    console.log(`🧠 Embedding dimension: ${embedding.length}`);
    globalThis.__embedding_logged = true;
  }
  
  // Model ini output 768, tapi kita potong >768 sebagai safety (tidak akan terpanggil)
  if (embedding.length > 768) {
    embedding.length = 768;
  }
  return embedding;
}

// --- Helper: Proses chunk satu per satu ---
async function processChunk(
  chunk: string,
  chunkIndex: number,
  documentId: string,
  fileName: string,
  supabaseAdmin: any,
  genAI: GoogleGenerativeAI
): Promise<boolean> {
  try {
    const embedding = await generateEmbedding(chunk, genAI);
    const { error } = await supabaseAdmin
      .from("document_chunks")
      .insert({
        document_id: documentId,
        content: chunk,
        embedding: embedding,
        metadata: {
          chunk_index: chunkIndex,
          file_name: fileName,
        },
      });
    if (error) {
      console.error(`❌ Insert chunk ${chunkIndex} failed:`, error);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`❌ Chunk ${chunkIndex} error:`, err);
    return false;
  }
}

// --- Main Function ---
Deno.serve(async (req: Request) => {
  let fileData: any = null;
  let pdfDoc: any = null;

  try {
    const payload = await req.json();
    const { type, table, record } = payload;
    if (type !== "INSERT" || table !== "objects") {
      return new Response("Ignored", { status: 200 });
    }

    const { name: fileName, bucket_id: bucketId, metadata } = record;
    const fileSize = metadata?.size || 0;
    console.log(`📄 Processing: ${fileName}, size: ${fileSize} bytes`);

    if (fileSize > MAX_FILE_SIZE_BYTES) {
      throw new Error(`File too large: ${fileSize} bytes (max ${MAX_FILE_SIZE_BYTES})`);
    }

    // --- Environment ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
    const genAI = new GoogleGenerativeAI(geminiApiKey);

    const storagePath = fileName;

    // --- Get or create document ---
    let documentId: string;
    let orgId: string;

    const { data: existingDoc } = await supabaseAdmin
      .from("documents")
      .select("id, organization_id")
      .eq("storage_path", storagePath)
      .maybeSingle();

    if (existingDoc) {
      documentId = existingDoc.id;
      orgId = existingDoc.organization_id;
      console.log(`📄 Found existing doc: ${documentId}`);
    } else {
      const { data: defaultOrg } = await supabaseAdmin
        .from("organizations")
        .select("id")
        .limit(1)
        .maybeSingle();
      if (!defaultOrg) {
        const { data: newOrg } = await supabaseAdmin
          .from("organizations")
          .insert({ name: "Default Organization" })
          .select()
          .single();
        if (!newOrg) throw new Error("Failed to create org");
        orgId = newOrg.id;
      } else {
        orgId = defaultOrg.id;
      }

      const { data: newDoc } = await supabaseAdmin
        .from("documents")
        .insert({
          organization_id: orgId,
          title: fileName,
          storage_path: storagePath,
          status: "uploading",
        })
        .select()
        .single();
      if (!newDoc) throw new Error("Failed to create doc");
      documentId = newDoc.id;
      console.log(`📄 Created new doc: ${documentId}`);
    }

    await supabaseAdmin
      .from("documents")
      .update({ status: "processing" })
      .eq("id", documentId);

    // --- Download file ---
    const { data: downloadedFile, error: downloadError } = await supabaseAdmin
      .storage.from(bucketId)
      .download(storagePath);
    if (downloadError || !downloadedFile) {
      throw new Error(`Download failed: ${downloadError?.message}`);
    }
    fileData = downloadedFile;
    console.log(`📥 Downloaded: ${fileData.byteLength} bytes`);

    // --- Parse PDF ---
    const arrayBuffer = await fileData.arrayBuffer();
    // 🔥 PERBAIKAN: pakai let bukan const
    let buffer = new Uint8Array(arrayBuffer);
    fileData = null; // Bebaskan memori

    const loadingTask = pdfjs.getDocument({ data: buffer });
    pdfDoc = await loadingTask.promise;
    // buffer akan keluar scope, tidak perlu di-set null

    console.log(`📄 Pages: ${pdfDoc.numPages}`);

    // --- Streaming chunking per halaman ---
    let insertedCount = 0;
    let chunkIndex = 0;
    let carry = "";

    const pagesToProcess = Math.min(pdfDoc.numPages, MAX_PAGES);

    for (let i = 1; i <= pagesToProcess; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => item.str).join(' ');

      let fullText = carry + pageText;
      carry = "";

      while (fullText.length > CHUNK_SIZE && chunkIndex < MAX_CHUNKS) {
        let end = Math.min(CHUNK_SIZE, fullText.length);
        if (end < fullText.length) {
          const lastSpace = fullText.lastIndexOf(' ', end);
          if (lastSpace > 0) end = lastSpace;
        }
        const chunk = fullText.substring(0, end);
        fullText = fullText.substring(end - CHUNK_OVERLAP);

        const success = await processChunk(chunk, chunkIndex, documentId, fileName, supabaseAdmin, genAI);
        if (success) insertedCount++;
        chunkIndex++;

        if (chunkIndex % 3 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      carry = fullText;
    }

    if (carry.length > 0 && chunkIndex < MAX_CHUNKS) {
      const success = await processChunk(carry, chunkIndex, documentId, fileName, supabaseAdmin, genAI);
      if (success) insertedCount++;
      chunkIndex++;
    }

    console.log(`✅ Inserted ${insertedCount} chunks`);

    pdfDoc = null;

    // --- Update status ---
    if (insertedCount > 0) {
      await supabaseAdmin
        .from("documents")
        .update({
          status: "ready",
          chunk_count: insertedCount,
        })
        .eq("id", documentId);
      console.log(`🎉 Document ${documentId} ready with ${insertedCount} chunks`);
    } else {
      await supabaseAdmin
        .from("documents")
        .update({ status: "failed" })
        .eq("id", documentId);
      throw new Error("No chunks inserted");
    }

    return new Response(
      JSON.stringify({ success: true, document_id: documentId, chunks: insertedCount }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("🔥 Fatal:", error?.message || error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Unknown error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  } finally {
    // Bersihkan referensi besar
    fileData = null;
    pdfDoc = null;
  }
});