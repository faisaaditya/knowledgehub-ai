# KnowledgeHub-AI

> Internal AI Knowledge Base & RAG Dashboard dengan Supabase, Next.js, dan Gemini.

---

## 📖 Tentang Proyek

`KnowledgeHub-AI` adalah dashboard internal untuk membangun knowledge base perusahaan dengan fitur upload dokumen dan tanya jawab berbasis RAG.

Proyek ini dirancang sebagai monorepo `pnpm workspace` dengan frontend Next.js, Supabase Auth + Storage + Functions, dan pipeline AI menggunakan Google Gemini.

## ✨ Fitur Utama

- 🔐 Login / register dengan Supabase Auth.
- 📄 Dashboard dokumen dan statistik organisasi.
- 📁 Upload dokumen PDF/TXT ke Supabase Storage.
- 🧩 Proses dokumen otomatis dengan chunking dan embedding.
- 🤖 Chat RAG untuk menjawab pertanyaan berdasarkan konten dokumen.
- 🛡️ Row Level Security (RLS) Supabase untuk isolasi organisasi.

## 🛠️ Teknologi Utama

- Frontend: `Next.js 16` (App Router), Tailwind CSS, `shadcn/ui`
- Backend/DB: Supabase PostgreSQL dengan `vector` + Auth + Storage + Edge Functions
- AI: Google Gemini (`gemini-embedding-001`, `gemini-2.5-flash`)
- Package manager: `pnpm`
- Monorepo: `apps/*`, `packages/*`

## 📁 Struktur Proyek

- `apps/web` — frontend Next.js dengan halaman auth, dashboard, chat, dan setting.
- `supabase/functions/ask-ai` — function AI untuk query chat dan retrieval.
- `supabase/functions/process-document` — function untuk parsing dokumen, chunking, dan embedding.
- `supabase/migrations` — skema database, tabel, indeks, RLS, dan policies.
- `packages/types` — TypeScript typings untuk database Supabase.

## 🚀 Cara Menjalankan Lokal

1. Install dependency di root monorepo:

```bash
pnpm install
```

2. Masuk ke folder aplikasi web:

```bash
cd apps/web
```

3. Jalankan development server:

```bash
pnpm dev
```

> Jika Anda menggunakan Supabase lokal atau deploy fungsi, pastikan Supabase CLI sudah terpasang.

## 🔧 Environment Variables

Tambahkan variabel berikut ke `.env.local` di `apps/web`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SERVICE_ROLE_KEY=your-service-role-key
GEMINI_API_KEY=your-gemini-api-key
NEXT_PUBLIC_SUPABASE_EDGE_FUNCTION_URL=https://your-project.supabase.co/functions/v1/ask-ai
```

- `NEXT_PUBLIC_SUPABASE_URL`: URL proyek Supabase.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: kunci anon publik Supabase.
- `SUPABASE_SERVICE_ROLE_KEY` / `SERVICE_ROLE_KEY`: service role key untuk function server-side.
- `GEMINI_API_KEY`: API key Google Gemini untuk embedding dan chat.
- `NEXT_PUBLIC_SUPABASE_EDGE_FUNCTION_URL`: URL function Supabase untuk `ask-ai`.

## 🧠 Alur Data

1. Pengguna login/register dengan Supabase Auth.
2. File di-upload ke bucket Supabase Storage.
3. `process-document` memproses dokumen dan menyimpan embedding ke `document_chunks`.
4. UI chat memanggil `ask-ai` untuk pencarian vektor dan generasi jawaban.
5. Jawaban AI disajikan bersama sumber dokumen yang relevan.

## 📌 Catatan Teknis Penting

- Pipeline dokumen menggunakan embedding vektor dimensi `768`.
- Edge function `ask-ai` menggunakan model `gemini-2.5-flash` untuk generasi jawaban.
- Supabase RLS aktif di tabel `organizations`, `profiles`, `documents`, `document_chunks`.
- Halaman `settings` masih berisi placeholder.

## 📚 Dokumentasi Tambahan

Lihat folder `docs/` untuk dokumentasi proyek lebih lengkap.

| File                   | Deskripsi                     |
| ---------------------- | ----------------------------- |
| `docs/PRD.md`          | Visi produk dan requirements. |
| `docs/ARCHITECTURE.md` | Arsitektur dan alur sistem.   |
| `docs/DATABASE.md`     | Skema database dan RLS.       |
| `docs/API.md`          | API dan function contract.    |
| `docs/AI_PIPELINE.md`  | Proses embedding & prompt.    |
| `docs/SECURITY.md`     | Keamanan dan mitigasi.        |
| `docs/ROADMAP.md`      | Rencana pengembangan.         |

## 🔧 Deploy

- Deploy frontend dari `apps/web` ke platform seperti Vercel.
- Deploy Supabase Functions dari folder `supabase/functions` ke proyek Supabase.
- Simpan `GEMINI_API_KEY` dan service role key pada environment Supabase.

## 📌 Referensi Kode

- `apps/web/src/app/(dashboard)/chat/page.tsx` — UI chat streaming dengan Supabase Edge Function.
- `supabase/functions/ask-ai/index.ts` — pipeline AI + vector retrieval.
- `supabase/migrations/20260701093252_init_schema.sql` — schema dan RLS setup.
