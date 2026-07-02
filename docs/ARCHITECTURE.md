# Architecture Design - AI Knowledge Base

Dokumen ini menjelaskan arsitektur tingkat tinggi dan alur data sistem **AI Native Knowledge Base**.

---

## 1. High-Level Architecture (C4 Model - Level 1)

```mermaid
flowchart LR
    User[User Browser] --> Vercel[Vercel Hosting\nNext.js 14]
    Vercel --> Auth[Supabase Auth]
    Vercel --> DB[(PostgreSQL + pgvector)]
    Vercel --> Storage[Supabase Storage]
    Storage -.->|Trigger| Edge[Supabase Edge Functions]
    Edge --> OpenAI[OpenAI / Claude API]
    Edge --> DB
```

---

## 2. Component Diagram (Level 2)

```mermaid
graph TD
    subgraph Frontend [Next.js App Router]
        UI[Dashboard UI]
        Chat[Chat Interface]
        Upload[Upload Component]
        Lib[Supabase Client]
    end

    subgraph Backend [Supabase]
        Auth[Auth Service]
        DB[(PostgreSQL\nTables + RLS + pgvector)]
        Bucket[Storage Bucket 'documents']
        EF1[Edge Function:\nprocess-document]
        EF2[Edge Function:\nask-ai]
    end

    subgraph AI [External AI]
        Embed[OpenAI Embeddings]
        LLM[OpenAI GPT-4 / Claude]
    end

    Upload --> Bucket
    Bucket -->|Webhook| EF1
    EF1 --> Embed
    EF1 --> DB
    Chat --> EF2
    EF2 --> DB
    EF2 --> LLM
    EF2 -->|Streaming| Chat
```

---

## 3. Data Flow (Upload Pipeline)

1. **Upload Request**: User mengirim file ke Next.js.
2. **File Storage**: Next.js mengupload ke Supabase Storage via REST API (dengan token JWT user).
3. **Webhook Trigger**: Supabase Storage menyimpan file, lalu mengirim payload ke Edge Function `process-document`.
4. **Processing**: Edge Function membaca file dari Storage, ekstraksi teks, dan melakukan chunking.
5. **Embedding Generation**: Edge Function memanggil OpenAI Embedding API.
6. **Save to Database**: Hasil embedding disimpan di tabel `document_chunks` (PostgreSQL).
7. **Status Update**: Status dokumen diupdate menjadi `ready`.

---

## 4. Data Flow (Chat / RAG Pipeline)

1. **User Query**: User mengirim pertanyaan ke Next.js.
2. **AI Request**: Next.js memanggil Edge Function `ask-ai` dengan session JWT.
3. **Verify Auth**: Edge Function mengekstrak `organization_id` dari JWT via Supabase Auth.
4. **Vector Search**: Edge Function melakukan Vector Search (Cosine similarity) di tabel `document_chunks` dengan filter `organization_id`.
5. **Prompt Construction**: Edge Function mengambil 5 chunk teratas dan menyusunnya menjadi context prompt.
6. **LLM Generation**: Edge Function mengirim prompt ke OpenAI/Claude dengan parameter `stream: true`.
7. **Stream Response**: Edge Function mengirim balik stream response ke Next.js.
8. **UI Render**: Next.js merender response token-by-token ke UI menggunakan Vercel AI SDK.

---

## 5. Deployment Flow (Vercel)

```mermaid
flowchart LR
    Git[git push] --> GitHub[GitHub]
    GitHub --> Vercel[Vercel Production/Preview]
    Vercel --> Env[Set Environment Variables]
    Env --> Build[pnpm build]
    Build --> Start[pnpm start]
```

---

## 6. Sequence Diagram: Upload

```mermaid
sequenceDiagram
    actor User
    User->>+Next.js: Upload File
    Next.js->>+Supabase Storage: PUT file (JWT)
    Supabase Storage-->>-Next.js: 200 OK (Path)
    Supabase Storage->>+EdgeFunc: Trigger (Payload)
    EdgeFunc->>EdgeFunc: Extract Text & Chunk
    EdgeFunc->>+OpenAI: Request Embedding
    OpenAI-->>-EdgeFunc: Vector Array
    EdgeFunc->>+DB: INSERT chunks
    DB-->>-EdgeFunc: Success
    EdgeFunc->>Supabase Storage: Update Doc Status
    Next.js-->>-User: Status "Ready" (Realtime)
```

---

## 7. Sequence Diagram: Chat

```mermaid
sequenceDiagram
    actor User
    User->>+Next.js: "Apa isi kontrak?"
    Next.js->>+EdgeFunc: POST /ask-ai (JWT)
    EdgeFunc->>EdgeFunc: Verify JWT & get org_id
    EdgeFunc->>+DB: Vector Search (pgvector)
    DB-->>-EdgeFunc: 5 Relevant Chunks
    EdgeFunc->>EdgeFunc: Build System Prompt + Context
    EdgeFunc->>+OpenAI: Stream Completion
    OpenAI-->>EdgeFunc: Stream Chunk
    EdgeFunc-->>Next.js: Stream Chunk
    Next.js-->>User: Render Token
```

---

## 8. Technology Justification

| Komponen | Pilihan | Alasan |
| :--- | :--- | :--- |
| **Frontend** | Next.js 14 | SSR untuk SEO (dashboard), API Routes minimal. |
| **DB** | Supabase (pgvector) | Managed PostgreSQL, built-in vector support, realtime. |
| **Auth** | Supabase Auth | JWT terintegrasi dengan RLS. |
| **Edge Func** | Deno / Supabase | Serverless, dekat dengan Storage (minimal latency). |
| **Package** | pnpm | Efisiensi disk space dan kecepatan CI/CD. |
