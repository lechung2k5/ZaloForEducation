export interface RAGChunk {
  _id?: any;
  docId: string;
  chunkId: string;
  content: string;
  embedding?: number[];
  tokens: number;
  subject: string;
  grade: string;
  semester?: string;
  sourceUrl?: string;
  sourceTitle: string;
  pageNumber?: number;
  chapterNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RAGDocument {
  _id?: any;
  docId: string;
  originalName: string;
  subject: string;
  grade: string;
  semester?: string;
  s3Url: string;
  totalChunks: number;
  totalTokens: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface AskRequest {
  query: string;
  subject?: string;
  grade?: string;
  topK?: number;
}

export interface ChatRequest {
  message: string;
}

export interface ChatResponse {
  answer: string;
  model: string;
}

export interface AskResponse {
  query: string;
  answer: string;
  citations: Citation[];
  retrievedChunks: RAGChunk[];
  confidence: number;
  responseTime: number;
}

export interface Citation {
  chunkId: string;
  content: string;
  sourceTitle: string;
  pageNumber?: number;
  relevanceScore: number;
}

export interface IngestRequest {
  file: Express.Multer.File;
  subject: string;
  grade: string;
  semester?: string;
  userId: string;
}

export interface IngestResponse {
  docId: string;
  fileName: string;
  totalChunks: number;
  totalTokens: number;
  status: 'success' | 'partial' | 'failed';
  message: string;
}
