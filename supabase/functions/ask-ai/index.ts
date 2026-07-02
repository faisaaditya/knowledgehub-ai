// @ts-ignore
declare const Deno: any;

// @ts-ignore
import "@supabase/functions-js/edge-runtime.d.ts";

// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

// --- Konfigurasi ---
const TOP_K = 5;

// --- Helper: Response dengan CORS ---
function corsResponse(data: any, status: number = 200, headers: Record<string, string> = {}) {
  const body = typeof data === "string" ? data : JSON.stringify(data);
  return new Response(body, {
    status,
    headers: {
      "Content-Type": typeof data === "string" ? "text/plain" : "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      ...headers,
    },
  });
}

// --- Helper: Dapatkan/ Buat Organization Default ---
async function getOrCreateDefaultOrganization(supabaseAdmin: any): Promise<string> {
  console.log("🔍 Checking for default organization...");
  const { data: orgs, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .limit(1);
  if (orgError) {
    console.error("❌ Org query error:", orgError);
    throw new Error(`Failed to query organizations: ${orgError.message}`);
  }
  if (orgs && orgs.length > 0) {
    console.log(`✅ Found existing organization: ${orgs[0].id}`);
    return orgs[0].id;
  }

  console.log("📁 Creating default organization...");
  const { data: newOrg, error: createError } = await supabaseAdmin
    .from("organizations")
    .insert({ name: "Default Organization" })
    .select()
    .single();
  if (createError || !newOrg) {
    throw new Error(`Failed to create default organization: ${createError?.message}`);
  }
  console.log(`✅ Created organization: ${newOrg.id}`);
  return newOrg.id;
}

// --- Helper: Pastikan Profile Ada ---
async function ensureUserProfile(
  supabaseAdmin: any,
  userId: string,
  email: string,
  fullName?: string
): Promise<string> {
  console.log(`👤 Ensuring profile for user ${userId}`);
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.organization_id) {
      console.log(`✅ Profile exists with org: ${existingProfile.organization_id}`);
      return existingProfile.organization_id;
    }
    const orgId = await getOrCreateDefaultOrganization(supabaseAdmin);
    console.log(`🔄 Updating profile with organization: ${orgId}`);
    await supabaseAdmin.from("profiles").update({ organization_id: orgId }).eq("id", userId);
    return orgId;
  }

  const orgId = await getOrCreateDefaultOrganization(supabaseAdmin);
  console.log(`📝 Creating new profile for user ${userId} with org ${orgId}`);
  await supabaseAdmin.from("profiles").insert({
    id: userId,
    full_name: fullName || email,
    organization_id: orgId,
    role: 'member',
  });
  console.log(`✅ Profile created`);
  return orgId;
}

// --- Main Function ---
console.log("🚀 ask-ai function starting...");

Deno.serve(async (req: Request) => {
  console.log("📥 Request received");

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type",
      },
    });
  }

  try {
    if (req.method !== "POST") {
      console.warn("❌ Method not allowed");
      return corsResponse("Method not allowed", 405);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("❌ Unauthorized - missing bearer token");
      return corsResponse("Unauthorized", 401);
    }
    const token = authHeader.split(" ")[1];

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      console.warn("❌ Query is empty");
      return corsResponse({ error: "Query is required" }, 400);
    }
    console.log(`📝 Query: "${query}"`);

    // --- Environment ---
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SERVICE_ROLE_KEY")!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) {
      console.error("❌ Missing GEMINI_API_KEY");
      throw new Error("Missing GEMINI_API_KEY");
    }
    console.log("✅ Environment variables loaded");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // --- Auth & Profile Setup ---
    const isServiceRole = token.startsWith("sb_") || token.includes(".") === false;
    let supabaseUser: any;
    let organizationId: string | null = null;

    if (isServiceRole) {
      console.log("🔑 Using service role mode");
      supabaseUser = supabaseAdmin;
      organizationId = await getOrCreateDefaultOrganization(supabaseAdmin);
    } else {
      console.log("👤 Using user JWT mode");
      supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: userData, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !userData?.user) {
        console.error("❌ Failed to get user data:", userError);
        throw new Error("Failed to get user data");
      }
      const userId = userData.user.id;
      const userEmail = userData.user.email;
      const userFullName = userData.user.user_metadata?.full_name || null;
      console.log(`👤 User ID: ${userId}, Email: ${userEmail}`);

      organizationId = await ensureUserProfile(supabaseAdmin, userId, userEmail, userFullName);
    }

    console.log(`🏢 Organization ID: ${organizationId}`);

    // --- Gemini Embedding ---
    console.log("🧠 Initializing Gemini embedding...");
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const embedResult = await embedModel.embedContent(query);
    const queryEmbedding = embedResult.embedding.values;
    if (queryEmbedding.length > 768) {
      queryEmbedding.length = 768;
    }
    console.log(`✅ Embedding generated (dimension: ${queryEmbedding.length})`);

    // --- Vector Search ---
    console.log("🔎 Performing vector search...");
    const { data: chunks, error: searchError } = await supabaseUser.rpc(
      "match_document_chunks",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: TOP_K,
        p_org_id: organizationId,
      }
    );

    if (searchError) {
      console.error("❌ Search error:", searchError);
      throw new Error("Vector search failed");
    }
    console.log(`✅ Found ${chunks?.length || 0} relevant chunks`);

    // --- Build Context ---
    let sources: Array<{ title: string; content: string }> = [];
    let context = "";
    if (chunks && chunks.length > 0) {
      sources = chunks.map((chunk: any) => ({
        title: chunk.document_title || "Unknown",
        content: chunk.content,
      }));
      context = sources.map((s, i) => `[${i+1}] ${s.content}`).join("\n\n");
    } else {
      context = "Tidak ada dokumen yang relevan ditemukan.";
    }

    // --- Prompt ---
    const systemPrompt = `Anda adalah asisten AI perusahaan. Jawab hanya berdasarkan konteks berikut.
Jika jawaban tidak ada, katakan "Saya tidak menemukan informasi tersebut."
Sebutkan sumber di akhir.

Konteks:
${context}

Pertanyaan: ${query}
Jawaban:`;

    // --- Gemini Chat (dengan fallback model) ---
    console.log("💬 Calling Gemini chat model...");
    const modelPriority = ["gemini-1.5-flash", "gemini-2.0-flash-lite", "gemini-2.5-flash","gemini-3.0-flash-lite"];
    let chatModel: any = null;
    let lastError: any = null;

    for (const modelName of modelPriority) {
      try {
        console.log(`🔄 Trying model: ${modelName}`);
        const model = genAI.getGenerativeModel({ model: modelName });
        // Test singkat untuk memastikan model aktif
        const testResult = await model.generateContent("Halo");
        if (testResult.response) {
          chatModel = model;
          console.log(`✅ Using model: ${modelName}`);
          break;
        }
      } catch (err: any) {
        console.warn(`⚠️ Model ${modelName} failed:`, err?.message || err);
        lastError = err;
        if (err?.message?.includes("429") || err?.status === 429) {
          console.log(`⏳ Model ${modelName} quota exceeded, trying next...`);
          continue;
        }
      }
    }

    if (!chatModel) {
      throw new Error(`No Gemini model available: ${lastError?.message || "Unknown error"}`);
    }

    // --- Build contents array untuk generateContentStream ---
    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Baik, saya akan menjawab berdasarkan konteks yang diberikan." }] },
      { role: "user", parts: [{ text: query }] },
    ];

    console.log("📤 Sending generateContentStream...");
    const streamResult = await chatModel.generateContentStream({ contents });

    // --- SSE Response ---
    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          // Kirim sources terlebih dahulu
          const sourcesMessage = JSON.stringify({ type: "sources", data: sources });
          controller.enqueue(new TextEncoder().encode(`data: ${sourcesMessage}\n\n`));

          // Iterasi stream
          for await (const chunk of streamResult.stream) {
            const text = chunk.text();
            if (text) {
              const message = JSON.stringify({ type: "text", data: text });
              controller.enqueue(new TextEncoder().encode(`data: ${message}\n\n`));
            }
          }
          controller.enqueue(new TextEncoder().encode(`data: {"type":"done"}\n\n`));
        } catch (streamError) {
          console.error("❌ Stream error:", streamError);
          // Kirim error sebagai teks biasa (fallback)
          const errorMsg = JSON.stringify({ type: "text", data: "Maaf, terjadi kesalahan saat memproses respons." });
          controller.enqueue(new TextEncoder().encode(`data: ${errorMsg}\n\n`));
          controller.enqueue(new TextEncoder().encode(`data: {"type":"done"}\n\n`));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: any) {
    console.error("🔥 Fatal:", error?.message || error);
    return corsResponse({ error: error?.message || "Internal server error" }, 500);
  }
});