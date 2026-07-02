# Security Architecture - AI Knowledge Base

Dokumen ini menjelaskan model ancaman (*threat model*) dan mekanisme perlindungan data pada aplikasi **AI Knowledge Base**.

---

## 1. Threat Model

| Threat | Deskripsi | Mitigasi |
| :--- | :--- | :--- |
| **Data Leakage** | User dari Organisasi A secara tidak sengaja/sengaja mengakses data milik Organisasi B. | Penerapan **Row Level Security (RLS)** ketat di level PostgreSQL. |
| **Prompt Injection** | User menyisipkan instruksi berbahaya dalam kolom pertanyaan untuk memanipulasi LLM. | *Hardcoded system prompt* di Edge Function dan melakukan sanitasi pada input query. |
| **Token Theft** | Kredensial JWT dicuri dari lalu lintas jaringan. | Mengamankan jalur dengan HTTPS, masa berlaku JWT yang singkat (1 jam), dan penggunaan refresh token. |
| **Malicious Upload** | User mengunggah file berbahaya (misalnya virus atau script jahat). | Batasi tipe file hanya `.pdf` dan `.txt`. Simpan di storage dengan path unik yang terisolasi. |

---

## 2. JWT & Auth Flow

* Semua request ke Supabase Edge Function divalidasi menggunakan helper resmi `@supabase/supabase-js` melalui method `getUser(token)`.
* Role pengguna (`owner` vs `member`) ditarik dari database relasional di tabel `profiles` setelah token JWT dinyatakan valid.

---

## 3. Row Level Security (RLS) - Implementation Deep Dive

* **Prinsip:** *"User hanya bisa melihat baris data yang terhubung dengan `organization_id` milik mereka sendiri."*
* **Eksekusi:** Semua query di Edge Function menggunakan **Service Role Key** (untuk mem-bypass RLS untuk keperluan internal) **ATAU** menggunakan **anon key** dengan parameter `auth.uid()` yang sudah di-set otomatis oleh Supabase Auth. Di proyek ini, kita menggunakan anon key agar filter RLS tetap aktif di level database.
* **Verifikasi:** Menyediakan skrip pengujian RLS di `supabase/tests/rls_test.sql` untuk membuktikan fungsionalitas isolasi data.

---

## 4. Storage Policies

```sql
-- Mengizinkan user mengunggah file hanya ke folder organisasi mereka sendiri
CREATE POLICY "Give users access to own org folder" ON storage.objects
  FOR ALL USING (
    bucket_id = 'documents' AND 
    (storage.foldername(name))[1] = auth.uid()::text
  );
```

> [!NOTE]
> Karena menggunakan arsitektur multi-tenant, penyimpanan di Supabase Storage sebaiknya menggunakan prefix path `{organization_id}/` untuk isolasi berkas yang lebih aman.

---

## 5. Mitigasi Prompt Injection

* **Input Validation:** Validasi panjang query teks yang dikirimkan user (maksimal 500 karakter).
* **System Message:** Hindari penggabungan input mentah user secara langsung ke dalam system prompt tanpa pembatas yang jelas. Gunakan pembatas khusus (seperti tag `---` atau `[Konteks]`).
* **Output Filtering:** Edge Function melakukan pemeriksaan response LLM untuk memblokir jika terdeteksi pola instruksi berbahaya (seperti query SQL `DROP TABLE`, dsb).

---

## 6. Data Leakage Prevention Checklist

- [x] Apakah RLS aktif di semua tabel database?
- [x] Apakah Edge Function menggunakan parameter `auth.uid()` untuk memfilter data user?
- [x] Apakah koneksi ke OpenAI menggunakan API Key yang dienkripsi dengan aman di Vercel Environment Variables?
- [x] Apakah error logging didesain untuk tidak menampilkan isi dokumen asli demi menjaga privasi?
