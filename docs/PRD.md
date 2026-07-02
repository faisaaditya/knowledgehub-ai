# Product Requirements Document (PRD) - AI Knowledge Base

**Versi:** 1.0.0 | **Status:** Final

---

## 1. Product Vision
Menciptakan "Otak Kedua" bagi tim perusahaan dengan mengubah tumpukan dokumen internal (PDF, DOCX) menjadi asisten AI yang interaktif. Setiap tim memiliki ruang data pribadi yang aman, di mana karyawan cukup bertanya dalam bahasa sehari-hari untuk mendapatkan jawaban spesifik dari kebijakan, panduan, atau laporan perusahaan.

## 2. Problem Statement
Saat ini, karyawan membuang rata-rata 2-3 jam per minggu hanya untuk mencari informasi di arsip Google Drive atau SharePoint. Dokumen tercecer, pencarian keyword gagal menemukan konteks, dan tidak ada cara untuk menanyakan pertanyaan kompleks seperti *"Bagaimana prosedur reimbursement untuk client luar negeri di Q4?"* secara instan.

## 3. Goals
* **G1:** Mengurangi waktu pencarian informasi hingga **80%** (dari 30 menit menjadi < 5 menit).
* **G2:** Menjamin **Zero Data Leakage** antar departemen (Multi-tenancy absolut).
* **G3:** Menyediakan antarmuka *chat* yang seamless seperti menggunakan ChatGPT, namun data sepenuhnya privat.

## 4. Scope

### In-Scope (V1)
* Registrasi & Login (Email/Password).
* Upload file (PDF & TXT) via drag-and-drop.
* Proses otomatis chunking & embedding.
* Chat interaktif dengan sitasi (menunjuk ke dokumen asal).

### Out-of-Scope (Future)
* OCR untuk gambar/scanned file.
* Dukungan file Excel/PPT.
* Slack atau Discord integrasi.

## 5. User Personas

| Nama | Role | Pain Point | Goals |
| :--- | :--- | :--- | :--- |
| **Super Admin** | IT Manager | Kesulitan mengelola izin akses dokumen lama. | Ingin dashboard yang jelas untuk memonitor siapa akses apa. |
| **Member** | Legal Staff | Sering bingung dengan versi dokumen legal terbaru. | Ingin bertanya langsung dan mendapat jawaban plus pasal sumber. |

## 6. User Journey (Member - Legal Staff)
1. Member menerima email undangan dari Super Admin untuk bergabung di Org "PT Maju Jaya".
2. Member login, langsung melihat dashboard kosong (belum ada dokumen).
3. Super Admin meng-upload 50 halaman kontrak lawas.
4. 2 menit kemudian, status berubah dari "Processing" menjadi "Ready".
5. Member membuka halaman Chat dan mengetik: *"Berapa denda keterlambatan proyek?"*
6. Sistem menampilkan jawaban: *"Denda 2% per bulan, sesuai Pasal 5 Ayat 3 (Sumber: Kontrak_Vendor_2024.pdf)"*.
7. Member puas dan menyimpan sesi chat tersebut.

## 7. Functional Requirements (High-Level)
* **FR-1:** Sistem harus memiliki manajemen organisasi (multi-tenant).
* **FR-2:** Sistem harus memproses file menjadi teks terstruktur.
* **FR-3:** Sistem harus memberikan jawaban yang akurat dengan referensi sumber.

## 8. Non-Functional Requirements
* **NFR-1:** Keamanan: RLS harus diaktifkan di semua tabel database.
* **NFR-2:** Performa: First token di bawah 2 detik.
* **NFR-3:** Ketersediaan: 99% Uptime (skala portfolio).

## 9. Success Metrics (KPI)
* **Metric 1:** Akurasi jawaban > 80% berdasarkan uji manual 20 pertanyaan acak.
* **Metric 2:** Waktu upload hingga status "Ready" rata-rata < 3 menit untuk file 20 halaman.
* **Metric 3:** Tidak ada error RLS selama sesi testing multi-user.

## 10. Risks & Mitigasi

| Risk | Dampak | Mitigasi |
| :--- | :--- | :--- |
| **Biaya API OpenAI** | Menghabiskan budget jika banyak upload. | Batasi ukuran file (10MB) dan chunking hemat token. |
| **PDF Parsing Gagal** | User frustrasi. | Berikan fallback error message yang jelas. |

## 11. Definition of Done (DoD)
- [ ] Semua skenario User Journey berhasil dijalankan secara end-to-end.
- [ ] Kode di-deploy ke Vercel dengan environment variable yang aman.
- [ ] Terdapat dokumentasi `prompt logs` sebagai bukti proses AI Native development.
