import React, { useState } from 'react';
import api from '../services/api';

const UploadDocumentsPage: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState('Toán');
  const [grade, setGrade] = useState('Lớp 10');
  const [semester, setSemester] = useState('Học Kỳ 1');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [documents, setDocuments] = useState<any[]>([]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Vui lòng chọn tệp');
      return;
    }

    setIsUploading(true);
    setUploadStatus('Đang tải lên...');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('subject', subject);
      formData.append('grade', grade);
      formData.append('semester', semester);

      const response = await api.post('/api/ai/ingest', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadStatus(`✅ Thành công! Đã tạo ${response.data.totalChunks} chunks`);
      setFile(null);
      loadDocuments();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message;
      setUploadStatus(`❌ Lỗi: ${errorMsg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const loadDocuments = async () => {
    try {
      const response = await api.get('/api/ai/documents', {
        params: { subject, grade },
      });
      setDocuments(response.data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  React.useEffect(() => {
    loadDocuments();
  }, [subject, grade]);

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-on-surface">📚 Quản Lý Tài Liệu RAG</h1>

      {/* Upload Section */}
      <div className="bg-white rounded-lg border border-outline-variant/20 p-6 space-y-4">
        <h2 className="text-xl font-semibold text-on-surface">Tải Lên Tài Liệu</h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Môn Học</label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/40 outline-none"
            >
              <option>Toán</option>
              <option>Tiếng Việt</option>
              <option>Tiếng Anh</option>
              <option>Vật Lý</option>
              <option>Hóa Học</option>
              <option>Sinh Học</option>
              <option>Lịch Sử</option>
              <option>Địa Lý</option>
            </select>
          </div>

          {/* Grade */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Lớp</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/40 outline-none"
            >
              <option>Lớp 9</option>
              <option>Lớp 10</option>
              <option>Lớp 11</option>
              <option>Lớp 12</option>
            </select>
          </div>

          {/* Semester */}
          <div>
            <label className="block text-sm font-medium text-on-surface mb-2">Học Kỳ</label>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="w-full px-3 py-2 border border-outline-variant/20 rounded-lg focus:ring-2 focus:ring-primary/40 outline-none"
            >
              <option>Học Kỳ 1</option>
              <option>Học Kỳ 2</option>
            </select>
          </div>
        </div>

        {/* File Input */}
        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Chọn File PDF</label>
          <div className="flex items-center gap-3">
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={handleFileSelect}
              className="flex-1 px-3 py-2 border border-outline-variant/20 rounded-lg text-on-surface"
            />
            {file && <span className="text-sm text-primary">📁 {file.name}</span>}
          </div>
        </div>

        {/* Upload Button */}
        <button
          onClick={handleUpload}
          disabled={!file || isUploading}
          className="w-full bg-primary text-white py-2 rounded-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition"
        >
          {isUploading ? '⏳ Đang tải lên...' : '📤 Tải Lên'}
        </button>

        {/* Status */}
        {uploadStatus && (
          <div className={`text-sm p-3 rounded-lg ${uploadStatus.includes('✅') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {uploadStatus}
          </div>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-white rounded-lg border border-outline-variant/20 p-6">
        <h2 className="text-xl font-semibold text-on-surface mb-4">📖 Tài Liệu Đã Tải</h2>

        {documents.length === 0 ? (
          <p className="text-on-surface-variant">Chưa có tài liệu nào</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div key={doc._id} className="border border-outline-variant/20 rounded-lg p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-on-surface">{doc.originalName}</h3>
                    <p className="text-sm text-on-surface-variant">
                      {doc.subject} • {doc.grade} • {doc.totalChunks} chunks • {doc.totalTokens.toLocaleString()} tokens
                    </p>
                    <p className="text-xs text-on-surface-variant">
                      Tải lên: {new Date(doc.createdAt).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (confirm('Xóa tài liệu này?')) {
                        try {
                          await api.post(`/api/ai/documents/${doc.docId}/delete`);
                          loadDocuments();
                          alert('✅ Đã xóa');
                        } catch (error) {
                          alert('❌ Xóa thất bại');
                        }
                      }
                    }}
                    className="text-red-500 text-sm font-semibold hover:text-red-700"
                  >
                    🗑️ Xóa
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadDocumentsPage;
