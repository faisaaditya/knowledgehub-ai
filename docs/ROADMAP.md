# Product Roadmap - AI Knowledge Base

Rencana pengembangan dan peta jalan fitur sistem **AI Knowledge Base**.

---

## 🚀 V1.0 - Foundation (MVP) *[CURRENT]*

**Goal:** Membuktikan konsep RAG dengan multi-tenancy yang aman.
- [x] Auth & Multi-tenant (Supabase RLS).
- [x] Upload file PDF/TXT.
- [x] Proses Embedding & Vector Search.
- [x] Chat streaming dengan sitasi.

---

## 📈 V2.0 - Collaboration & Productivity

**Goal:** Meningkatkan kegunaan tim dan kemudahan administrasi.

### Fitur Baru
* **Invite Member:** Pemilik organisasi dapat mengirim undangan email ke anggota baru untuk bergabung.
* **Chat History:** Menyimpan riwayat obrolan per sesi (menggunakan tabel `chat_sessions`).
* **Feedback Loop:** Tombol jempol ke atas/bawah pada jawaban AI untuk membantu mengumpulkan dataset fine-tuning di masa depan.
* **Export Chat:** Ekspor riwayat tanya-jawab ke format PDF atau Markdown.

### Sisi Teknis
* Migrasi ke `pgvector` versi 0.5+ untuk performa indexing yang lebih cepat.
* Implementasi Job Queue di background menggunakan Supabase Edge Functions + Cron.

---

## 🧠 V3.0 - Intelligent Automation

**Goal:** Sistem yang proaktif membantu alih-alih pasif menjawab.

### Fitur Baru
* **Auto-Tagging:** AI secara otomatis memberikan kategori/label dokumen berdasarkan konten (misal: "Keuangan", "HR", "Legal").
* **Slack & Discord Integration:** Memungkinkan pengguna berinteraksi dan bertanya langsung dari workspace chat mereka.
* **Multi-Modal Support:** Mengunggah gambar/infografis dan menggunakan GPT-4-Vision untuk ekstraksi teks secara otomatis.
* **Analytics Dashboard:** Visualisasi topik yang paling sering ditanyakan oleh anggota tim (sebagai acuan perbaikan SOP perusahaan).

### Sisi Teknis
* Implementasi **Hybrid Search** (pencarian leksikal BM25 + pencarian vektor) untuk akurasi retrieval yang lebih tinggi.
* Fine-tuning model LLM menggunakan data feedback yang dikumpulkan pada fase V2.

---

## 🌟 Future AI Features (Long-term)

* **Agentic Workflow:** AI tidak hanya memberikan jawaban, tetapi juga dapat memicu aksi eksternal (misalnya memperbarui status tiket Jira berdasarkan analisis kontrak).
* **Knowledge Graph:** Memetakan relasi antar dokumen (misal: menghubungkan "Kebijakan A" dengan "Prosedur B") untuk mendukung pencarian multi-langkah (*multi-step reasoning*) yang kompleks.
