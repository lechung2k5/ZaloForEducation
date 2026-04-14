import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as pdf from 'pdf-parse';
import { v4 as uuidv4 } from 'uuid';
import { MongoDBService } from '../../infrastructure/mongodb.service';
import { S3Service } from '../../infrastructure/s3.service';
import { IngestRequest, IngestResponse, RAGChunk, RAGDocument } from './ai-rag.types';

@Injectable()
export class IngestService {
  private readonly logger = new Logger(IngestService.name);
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  
  private readonly CHUNK_SIZE = 400; // ~400 tokens per chunk
  private readonly CHUNK_OVERLAP = 50; // 50 token overlap

  constructor(
    private readonly mongoDb: MongoDBService,
    private readonly s3Service: S3Service,
  ) {}

  async ingestDocument(request: IngestRequest): Promise<IngestResponse> {
    const { file, subject, grade, semester, userId } = request;

    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      const docId = `DOC#${uuidv4()}`;
      
      // Step 1: Extract text từ PDF
      const extractedText = await this.extractTextFromPdf(file.buffer);
      
      if (!extractedText.trim()) {
        throw new BadRequestException('PDF file is empty or unreadable');
      }

      // Step 2: Upload file lên S3
      const s3Url = await this.s3Service.uploadFile(file, 'rag-documents');

      // Step 3: Chunk text + tokenize
      const chunks = await this.chunkText(extractedText, {
        docId,
        subject,
        grade,
        semester,
        sourceTitle: file.originalname,
        createdAt: new Date(),
      });

      // Step 4: Generate embeddings (OpenAI when available, deterministic fallback otherwise)
      const chunksWithEmbeddings = await this.generateEmbeddings(chunks);

      // Step 5: Lưu vào MongoDB
      const db = this.mongoDb.getDatabase();
      const chunksCollection = db.collection('chunks');
      const docsCollection = db.collection('documents');

      // Insert chunks
      const insertResult = await chunksCollection.insertMany(chunksWithEmbeddings);
      
      // Insert document metadata
      const docMetadata: RAGDocument = {
        docId,
        originalName: file.originalname,
        subject,
        grade,
        semester,
        s3Url,
        totalChunks: chunksWithEmbeddings.length,
        totalTokens: chunksWithEmbeddings.reduce((sum, c) => sum + c.tokens, 0),
        createdBy: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      await docsCollection.insertOne(docMetadata);

      this.logger.log(`✅ Ingested document ${docId} with ${chunksWithEmbeddings.length} chunks`);

      return {
        docId,
        fileName: file.originalname,
        totalChunks: chunksWithEmbeddings.length,
        totalTokens: docMetadata.totalTokens,
        status: 'success',
        message: `Successfully ingested ${chunksWithEmbeddings.length} chunks`,
      };
    } catch (error) {
      this.logger.error(`❌ Ingest failed: ${error.message}`);
      throw new BadRequestException(`Ingest failed: ${error.message}`);
    }
  }

  private async extractTextFromPdf(buffer: Buffer): Promise<string> {
    try {
      const data = await pdf(buffer);
      const text = data.text;
      return text;
    } catch (error) {
      this.logger.error(`PDF parse error: ${error.message}`);
      throw new BadRequestException(`Failed to parse PDF: ${error.message}`);
    }
  }

  private async chunkText(
    text: string,
    metadata: {
      docId: string;
      subject: string;
      grade: string;
      semester?: string;
      sourceTitle: string;
      createdAt: Date;
    },
  ): Promise<RAGChunk[]> {
    // Split by newlines và normalize spaces
    const sentences = text
      .split(/[\n\r]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const chunks: RAGChunk[] = [];
    let currentChunk = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.estimateTokens(sentence);

      if (currentTokens + sentenceTokens > this.CHUNK_SIZE) {
        // Save current chunk
        if (currentChunk.trim().length > 0) {
          chunks.push({
            docId: metadata.docId,
            chunkId: `CHUNK#${uuidv4()}`,
            content: currentChunk.trim(),
            tokens: currentTokens,
            subject: metadata.subject,
            grade: metadata.grade,
            semester: metadata.semester,
            sourceTitle: metadata.sourceTitle,
            createdAt: metadata.createdAt,
            updatedAt: metadata.createdAt,
          });
        }

        // Overlap: keep last 50 tokens
        currentChunk = currentChunk.slice(-(this.CHUNK_OVERLAP * 4)); // rough estimate
        currentTokens = this.estimateTokens(currentChunk);
      }

      currentChunk += (currentChunk ? ' ' : '') + sentence;
      currentTokens = this.estimateTokens(currentChunk);
    }

    // Last chunk
    if (currentChunk.trim().length > 0) {
      chunks.push({
        docId: metadata.docId,
        chunkId: `CHUNK#${uuidv4()}`,
        content: currentChunk.trim(),
        tokens: currentTokens,
        subject: metadata.subject,
        grade: metadata.grade,
        semester: metadata.semester,
        sourceTitle: metadata.sourceTitle,
        createdAt: metadata.createdAt,
        updatedAt: metadata.createdAt,
      });
    }

    this.logger.log(`Created ${chunks.length} chunks`);
    return chunks;
  }

  private async generateEmbeddings(chunks: RAGChunk[]): Promise<RAGChunk[]> {
    if (!this.OPENAI_API_KEY) {
      return chunks.map((chunk) => ({
        ...chunk,
        embedding: this.generateDeterministicEmbedding(chunk.content, 256),
      }));
    }

    try {
      const embeddedChunks = await Promise.all(
        chunks.map(async (chunk) => {
          const embedding = await this.generateOpenAIEmbedding(chunk.content);
          return {
            ...chunk,
            embedding,
          };
        }),
      );

      return embeddedChunks;
    } catch (error: any) {
      this.logger.warn(`OpenAI embeddings failed, fallback to deterministic embeddings: ${error?.message || 'Unknown error'}`);
      return chunks.map((chunk) => ({
        ...chunk,
        embedding: this.generateDeterministicEmbedding(chunk.content, 256),
      }));
    }
  }

  private async generateOpenAIEmbedding(text: string): Promise<number[]> {
    const response = await axios.post(
      'https://api.openai.com/v1/embeddings',
      {
        model: this.EMBEDDING_MODEL,
        input: text,
      },
      {
        headers: {
          Authorization: `Bearer ${this.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      },
    );

    const embedding = response.data?.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new Error('Invalid embedding response from OpenAI');
    }
    return embedding;
  }

  private generateDeterministicEmbedding(text: string, dimensions = 256): number[] {
    const vector = new Array<number>(dimensions).fill(0);
    const terms = this.extractTerms(text);

    for (const term of terms) {
      let hash = 0;
      for (let i = 0; i < term.length; i++) {
        hash = (hash * 31 + term.charCodeAt(i)) | 0;
      }
      const index = Math.abs(hash) % dimensions;
      vector[index] += 1;
    }

    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm === 0) return vector;
    return vector.map((value) => value / norm);
  }

  private extractTerms(text: string): string[] {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .filter((term) => term.length >= 2);
  }

  private estimateTokens(text: string): number {
    // Rough estimate: ~1 token per 4 characters
    return Math.ceil(text.length / 4);
  }

  async listDocuments(subject?: string, grade?: string): Promise<RAGDocument[]> {
    const db = this.mongoDb.getDatabase();
    const docsCollection = db.collection('documents');

    const query: any = {};
    if (subject) query.subject = subject;
    if (grade) query.grade = grade;

    return (await docsCollection.find(query).sort({ createdAt: -1 }).toArray()) as any as RAGDocument[];
  }

  async deleteDocument(docId: string): Promise<void> {
    const db = this.mongoDb.getDatabase();
    const chunksCollection = db.collection('chunks');
    const docsCollection = db.collection('documents');

    // Delete all chunks belonging to this document
    await chunksCollection.deleteMany({ docId });

    // Delete document metadata
    await docsCollection.deleteOne({ docId });

    this.logger.log(`✅ Deleted document ${docId}`);
  }
}
