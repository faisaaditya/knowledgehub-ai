# API Specifications - Edge Functions

**Base URL:** `https://<project-ref>.supabase.co/functions/v1/`

---

## Authentication
Semua endpoint (kecuali yang ditandai) memerlukan **Bearer Token**:
```http
Authorization: Bearer <SUPABASE_JWT>
```

---

## 1. POST `/process-document` (Internal Webhook)

> **Trigger:** Dipanggil otomatis oleh Supabase Storage saat file selesai di-upload.

### Request Body (dikirim oleh Storage)
```json
{
  "type": "INSERT",
  "table": "objects",
  "record": {
    "name": "contract_2024.pdf",
    "bucket_id": "documents",
    "metadata": { "size": 2048000 }
  }
}
```

### Response (Success)
* **Status Code:** `200 OK`
```json
{
  "status": "processing_started",
  "document_id": "uuid"
}
```

### Response (Error)
* **Status Code:** `500 Internal Server Error`
```json
{
  "error": "Failed to parse PDF: Invalid format"
}
```

---

## 2. POST `/ask-ai` (Public Endpoint)

Menerima pertanyaan user dan mengembalikan streaming jawaban berbasis RAG.

### Request Headers
```http
Authorization: Bearer <JWT>
Content-Type: application/json
```

### Request Body
```json
{
  "query": "Bagaimana cara mengajukan cuti darurat?",
  "session_id": "optional-uuid"
}
```

### Response (Streaming - `text/event-stream`)
```json
data: {"type": "citation", "source": "HR_Policy_2024.pdf", "chunk": "Pasal 5..."}
data: {"type": "text", "content": "Untuk"}
data: {"type": "text", "content": " mengajukan"}
data: {"type": "text", "content": " cuti..."}
data: {"type": "done"}
```

### Response (Error - Non-streaming)
```json
{
  "error": "Invalid organization access",
  "code": 403
}
```

---

## 3. DELETE `/documents/:id`

Menghapus dokumen dan seluruh chunk terkait (hanya untuk owner).

### Path Parameter
* `id` (UUID dokumen)

### Response
* **Status Code:** `204 No Content`

---

## Standard Error Codes

| Code | Deskripsi |
| :--- | :--- |
| **400** | Bad Request (payload tidak sesuai) |
| **401** | Unauthorized (Token tidak valid/expired) |
| **403** | Forbidden (RLS violation / Bukan owner) |
| **429** | Too Many Requests (Rate limit OpenAI) |
| **500** | Internal Server Error (Gagal parsing / kegagalan API external) |
