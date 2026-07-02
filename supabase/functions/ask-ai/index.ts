// @ts-ignore
declare const Deno: any;

// @ts-ignore
import "@supabase/functions-js/edge-runtime.d.ts";

// @ts-ignore
import { createClient } from "npm:@supabase/supabase-js@2";
// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai";

const TOP_K = 3;

async function getOrCreateDefaultOrganization(supabaseAdmin: any): Promise<string> {
  const { data: orgs, error: orgError } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .limit(1);
  if (orgError) throw new Error(`Failed to query organizations: ${orgError.message}`);
  if (orgs && orgs.length > 0) return orgs[0].id;

  const { data: newOrg, error: createError } = await supabaseAdmin
    .from("organizations")
    .insert({ name: "Default Organization" })
    .select()
    .single();
  if (createError || !newOrg) throw new Error(`Failed to create default organization: ${createError?.message}`);
  return newOrg.id;
}

async function ensureUserProfile(supabaseAdmin: any, userId: string, email: string, fullName?: string): Promise<string> {
  const { data: existingProfile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (existingProfile) {
    if (existingProfile.organization_id) return existingProfile.organization_id;
    const orgId = await getOrCreateDefaultOrganization(supabaseAdmin);
    await supabaseAdmin.from("profiles").update({ organization_id: orgId }).eq("id", userId);
    return orgId;
  }

  const orgId = await getOrCreateDefaultOrganization(supabaseAdmin);
  await supabaseAdmin.from("profiles").insert({
    id: userId,
    full_name: fullName || email,
    organization_id: orgId,
    role: 'member',
  });
  return orgId;
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }
    const token = authHeader.split(" ")[1];

    const { query } = await req.json();
    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = [
      Deno.env.get("SERVICE_ROLE_KEY"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    ].find(key => key && key.startsWith("eyJ"))!;
    const geminiApiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiApiKey) throw new Error("Missing GEMINI_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    let organizationId: string | null = null;
    const isServiceRole = token.startsWith("sb_") || token.includes(".") === false;

    if (!isServiceRole) {
      const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: userData, error: userError } = await supabaseUser.auth.getUser();
      if (userError || !userData?.user) throw new Error("Failed to get user data");
      const userId = userData.user.id;
      const userEmail = userData.user.email;
      const userFullName = userData.user.user_metadata?.full_name || null;
      organizationId = await ensureUserProfile(supabaseAdmin, userId, userEmail, userFullName);
    } else {
      organizationId = await getOrCreateDefaultOrganization(supabaseAdmin);
    }

    // --- Gemini Embedding ---
    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const embedModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
    const embedResult = await embedModel.embedContent(query);
    const queryEmbedding = embedResult.embedding.values;
    if (queryEmbedding.length > 768) {
      queryEmbedding.length = 768;
    }

    // --- Vector Search ---
    const { data: chunks, error: searchError } = await supabaseAdmin.rpc(
      "match_document_chunks",
      {
        query_embedding: queryEmbedding,
        match_threshold: 0.7,
        match_count: TOP_K,
        p_org_id: organizationId,
      }
    );

    if (searchError) {
      console.error("Search error:", searchError);
      throw new Error("Vector search failed");
    }

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

    // --- Panggil Gemini (non-streaming, pakai model yang lebih ringan) ---
    const chatModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const chat = chatModel.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Baik, saya akan menjawab berdasarkan konteks yang diberikan." }] },
      ],
    });

    const result = await chat.sendMessage(query);
    const responseText = result.response.text();

    return new Response(
      JSON.stringify({ response: responseText, sources }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("🔥 Fatal:", error?.message || error);
    return new Response(
      JSON.stringify({ error: error?.message || "Internal server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});