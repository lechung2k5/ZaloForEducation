# ZaloEdu RAG (Retrieval Augmented Generation) Setup Guide

## 📚 Tổng Quan
Hệ thống RAG giáo dục tích hợp **NotebookLM-style chatbot** cho pipeline:
1. **Upload tài liệu** (PDF, text) → Extract text × Chunk × Embedding
2. **Lưu trữ** → MongoDB Vector Search
3. **Truy vấn** → Vector search + metadata filter + LLM generation + citations

---

## 🛠️ Setup Bước-Bước

### 1️⃣ Cài Dependencies
```bash
cd backend
npm install
```

**New dependencies added:**
- `mongoose` - MongoDB client
- `pdf-parse` - PDF text extraction
- `openai` - OpenAI Embeddings + Chat API
- `axios` - HTTP requests

### 2️⃣ Cấu Hình Environment Variables

Cập nhật `backend/.env` với:

```env
# MongoDB for RAG
MONGODB_URI=mongodb+srv://username:password@cluster-name.mongodb.net/?appName=ZaloEdu
MONGODB_DB_NAME=zaloedu-rag

# OpenAI API key (lấy từ https://platform.openai.com/account/api-keys)
OPENAI_API_KEY=sk-...your-api-key-here...
```

### 3️⃣ Khởi Tạo MongoDB Collections

Backend sẽ tự động tạo collections khi startup:
- **chunks** - Lưu đoạn text + embedding + metadata
- **documents** - Lưu metadata tài liệu

### 4️⃣ Chạy Backend
```bash
npm run backend:dev
```

Check log:
```
✅ MongoDB connected to database: zaloedu-rag
✅ MongoDB collections and indexes ensured
[ZaloEdu] Backend is running on: http://localhost:3000
```

### 5️⃣ Nối Ingest Document (Upload tài liệu)

**API Endpoint:** `POST /api/ai/ingest`

**Request:**
```bash
curl -X POST http://localhost:3000/api/ai/ingest \
  -F "file=@document.pdf" \
  -F "subject=Toán" \
  -F "grade=Lớp 10" \
  -F "semester=Học Kỳ 1"
```

**Response:**
```json
{
  "docId": "DOC#uuid",
  "fileName": "document.pdf",
  "totalChunks": 42,
  "totalTokens": 12450,
  "status": "success",
  "message": "Successfully ingested 42 chunks"
}
```

### 6️⃣ Query RAG (Hỏi câu hỏi)

**API Endpoint:** `POST /api/ai/ask`

**Request:**
```bash
curl -X POST http://localhost:3000/api/ai/ask \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Công thức giải phương trình bậc 2 là gì?",
    "subject": "Toán",
    "grade": "Lớp 10",
    "topK": 5
  }'
```

**Response:**
```json
{
  "query": "Công thức giải phương trình bậc 2 là gì?",
  "answer": "Phương trình bậc 2 có dạng ax² + bx + c = 0 có nghiệm được tính bằng công thức discriminant...",
  "citations": [
    {
      "chunkId": "CHUNK#uuid",
      "content": "Phương trình bậc 2 ax² + bx + c = 0 với a ≠ 0...",
      "sourceTitle": "Chapter 3 - Phương Trình Bậc Hai.pdf",
      "relevanceScore": 0.95
    }
  ],
  "retrievedChunks": [...],
  "confidence": 0.8,
  "responseTime": 1234
}
```

---

## 🎯 Các API khác

### Liệt kê Documents
```bash
GET /api/ai/documents?subject=Toán&grade=Lớp 10
```

### Xem Chunks của Document
```bash
GET /api/ai/documents/:docId/chunks
```

### Xóa Document
```bash
POST /api/ai/documents/:docId/delete
```

### Health Check
```bash
GET /api/ai/health
```

---

## 🚀 Frontend Integration

ChatBot component đã được update để:
1. Gọi `/api/ai/ask` khi user nhập câu hỏi
2. Hiển thị citations nguồn tham chiếu
3. Xử lý error + loading state

**File:** `apps/web/src/components/ChatBot.tsx`

---

## ⚙️ Configuration & Tuning

### Chunk Size
Default `400 tokens` với overlap `50 tokens`. Điều chỉnh trong `ingest.service.ts`:
```typescript
private readonly CHUNK_SIZE = 400;
private readonly CHUNK_OVERLAP = 50;
```

### Top K Results
Default `5` documents. Điều chỉnh khi call API:
```json
{
  "query": "...",
  "topK": 10  // Lấy top 10 results
}
```

### LLM Temperature
Default `0.7` (creative). Điều chỉnh trong `ask.service.ts`:
```typescript
temperature: 0.7,  // 0 = deterministic, 1 = creative
```

---

## 🐛 Troubleshooting

### MongoDB Connection Error
```
❌ MONGODB_URI environment variable is not set
```
→ Kiểm tra `backend/.env` có `MONGODB_URI` không

### OpenAI API Error
```
401 Unauthorized
```
→ Kiểm tra `OPENAI_API_KEY` hợp lệ

### PDF Parse Error
```
Failed to parse PDF
```
→ File PDF có thể corrupted. Thử file khác

### Vector Search No Results
```
"Không tìm thấy thông tin liên quan"
```
→ Thử upload thêm tài liệu hoặc sửa query

---

## 📊 Monitoring & Metrics

### Log Ingest
```
✅ Created 42 chunks
✅ Ingested document DOC#uuid with 42 chunks
```

### Log Query
```
✅ Question answered in 1234ms
{
  "topK": 5,
  "responseTime": 1234,
  "chunkCount": 5
}
```

---

## 🔄 Next Steps (Production)

1. **Real Embeddings**: Replace mock `generateMockEmbedding()` với OpenAI Embeddings API
2. **Vector Database**: Dùng MongoDB Atlas Vector Search index thực thay vì cosine similarity
3. **Reranking**: Thêm model rerank để xếp lại top K
4. **Caching**: Cache embedding + responses để giảm latency
5. **Rate Limiting**: Thêm rate limit cho API endpoints
6. **Authentication**: Implement user-based permission cho documents
7. **Analytics**: Track retrieval hit rate, citation accuracy, latency

---

## 📞 Support
- MongoDB setup: https://docs.mongodb.com/
- OpenAI API: https://platform.openai.com/docs
- NestJS PDF: https://github.com/modesty/pdf2json
