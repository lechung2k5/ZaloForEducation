import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { MongoDBService } from '../../infrastructure/mongodb.service';
import { AskRequest, AskResponse, Citation, RAGChunk } from './ai-rag.types';

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);
  private readonly OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';
  private readonly CHAT_MODEL = 'gpt-4o-mini';
  private readonly TOP_K = 5; // Retrieve top 5 most relevant chunks

  constructor(private readonly mongoDb: MongoDBService) {}

  async chatWithOpenAI(message: string): Promise<{ answer: string; model: string }> {
    const trimmed = message?.trim();
    if (!trimmed) {
      throw new BadRequestException('Message is required and cannot be empty');
    }

    if (!this.OPENAI_API_KEY) {
      throw new BadRequestException('OPENAI_API_KEY is not configured on server');
    }

    try {
      const response = await this.requestOpenAIChatWithRetry(trimmed);

      const answer = response.data?.choices?.[0]?.message?.content;
      if (!answer) {
        throw new Error('OpenAI returned an empty response');
      }

      return {
        answer,
        model: this.CHAT_MODEL,
      };
    } catch (error: any) {
      const status = error?.response?.status;
      this.logger.error(`❌ OpenAI chat failed: ${error?.message || 'Unknown error'} (status: ${status || 'n/a'})`);

      if (status === 429) {
        return {
          answer:
            'OpenAI đang tạm quá tải hoặc tài khoản đã chạm giới hạn quota. Bạn thử lại sau khoảng 1-2 phút nhé.',
          model: 'fallback-429',
        };
      }

      return {
        answer:
          'Hiện tại dịch vụ AI đang gặp sự cố tạm thời. Mình đã nhận câu hỏi của bạn, bạn vui lòng thử lại sau ít phút.',
        model: 'fallback-error',
      };
    }
  }

  private async requestOpenAIChatWithRetry(message: string, maxAttempts = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await axios.post(
          'https://api.openai.com/v1/chat/completions',
          {
            model: this.CHAT_MODEL,
            messages: [
              {
                role: 'system',
                content:
                  'Bạn là trợ lý thân thiện của ZaloEdu. Trả lời tự nhiên, rõ ràng, ngắn gọn khi phù hợp. Trả lời bằng tiếng Việt nếu người dùng dùng tiếng Việt.',
              },
              {
                role: 'user',
                content: message,
              },
            ],
            temperature: 0.7,
            max_tokens: 500,
          },
          {
            headers: {
              Authorization: `Bearer ${this.OPENAI_API_KEY}`,
              'Content-Type': 'application/json',
            },
          },
        );
      } catch (error: any) {
        const status = error?.response?.status;
        const shouldRetry = (status === 429 || status >= 500) && attempt < maxAttempts;

        if (!shouldRetry) {
          throw error;
        }

        const retryAfterHeader = Number(error?.response?.headers?.['retry-after']);
        const delayMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? retryAfterHeader * 1000
          : 600 * Math.pow(2, attempt - 1);

        this.logger.warn(`OpenAI request retry #${attempt} after ${delayMs}ms (status: ${status})`);
        await this.sleep(delayMs);
      }
    }

    throw new Error('OpenAI request failed after retries');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async ask(request: AskRequest): Promise<AskResponse> {
    const startTime = Date.now();

    try {
      // Step 1: Generate query embedding (OpenAI if available, deterministic fallback otherwise)
      const queryEmbedding = await this.generateQueryEmbedding(request.query);

      // Step 2: Hybrid search in MongoDB (vector + keyword overlap)
      const retrievedChunks = await this.vectorSearch(
        request.query,
        queryEmbedding,
        request.topK || this.TOP_K,
        request.subject,
        request.grade,
      );

      if (retrievedChunks.length === 0) {
        const answerWithoutContext = await this.generateAnswer(request.query);
        return {
          query: request.query,
          answer: `${answerWithoutContext}\n\n(Lưu ý: Hiện chưa tìm thấy tài liệu phù hợp trong kho kiến thức RAG.)`,
          citations: [],
          retrievedChunks: [],
          confidence: 0.4,
          responseTime: Date.now() - startTime,
        };
      }

      // Step 3: Build context từ retrieved chunks
      const context = retrievedChunks.map((c) => c.content).join('\n\n');

      // Step 4: Generate response từ LLM
      const answer = await this.generateAnswer(request.query, context);

      // Step 5: Create citations
      const citations = this.createCitations(retrievedChunks);

      const responseTime = Date.now() - startTime;

      this.logger.log(`✅ Question answered in ${responseTime}ms`);

      return {
        query: request.query,
        answer,
        citations,
        retrievedChunks,
        confidence: 0.8,
        responseTime,
      };
    } catch (error: any) {
      this.logger.error(`❌ Ask failed: ${error?.message || 'Unknown error'}`);
      throw new BadRequestException(`Ask failed: ${error?.message || 'Unknown error'}`);
    }
  }

  private async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!this.OPENAI_API_KEY) {
      return this.generateDeterministicEmbedding(query, 256);
    }

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/embeddings',
        {
          model: this.EMBEDDING_MODEL,
          input: query,
        },
        {
          headers: {
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const embedding = response.data?.data?.[0]?.embedding;
      if (Array.isArray(embedding) && embedding.length > 0) {
        return embedding;
      }
      return this.generateDeterministicEmbedding(query, 256);
    } catch (error: any) {
      this.logger.warn(`OpenAI embeddings failed, fallback to deterministic embedding: ${error?.message || 'Unknown error'}`);
      return this.generateDeterministicEmbedding(query, 256);
    }
  }

  private async vectorSearch(
    query: string,
    embedding: number[],
    topK: number,
    subject?: string,
    grade?: string,
  ): Promise<RAGChunk[]> {
    const db = this.mongoDb.getDatabase();
    const chunksCollection = db.collection('chunks');

    // Build query filter
    const filter: any = {};
    if (subject) filter.subject = subject;
    if (grade) filter.grade = grade;

    const allChunks = (await chunksCollection.find(filter).toArray()) as RAGChunk[];
    const queryTerms = this.extractTerms(query);

    // Hybrid scoring improves relevance when embeddings are noisy/missing.
    const chunksWithScores = allChunks.map((chunk) => ({
      chunk,
      score: this.hybridScore(embedding, queryTerms, chunk),
    }));

    return chunksWithScores
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((item) => item.chunk);
  }

  private hybridScore(queryEmbedding: number[], queryTerms: string[], chunk: RAGChunk): number {
    const vectorScore = this.cosineSimilarity(queryEmbedding, chunk.embedding || []);
    const keywordScore = this.keywordOverlapScore(queryTerms, chunk.content || '');

    // Vector dominates, keyword acts as lexical boost.
    return vectorScore * 0.7 + keywordScore * 0.3;
  }

  private keywordOverlapScore(queryTerms: string[], text: string): number {
    if (queryTerms.length === 0 || !text.trim()) return 0;

    const normalizedText = this.normalizeText(text);
    const hitCount = queryTerms.reduce((count, term) => {
      return normalizedText.includes(term) ? count + 1 : count;
    }, 0);

    return hitCount / queryTerms.length;
  }

  private extractTerms(text: string): string[] {
    return this.normalizeText(text)
      .split(' ')
      .filter((term) => term.length >= 2);
  }

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
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

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < Math.min(a.length, b.length); i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
  }

  private async generateAnswer(query: string, context?: string): Promise<string> {
    const systemPrompt = `Bạn là một trợ lý giáo dục thông minh cho nền tảng ZaloEdu. 
Hãy trả lời câu hỏi của học sinh dựa CHỈ trên thông tin được cung cấp trong ngữ cảnh (Context).
Nếu thông tin không có sẵn trong context, hãy nói rõ "Thông tin này chưa có trong cơ sở dữ liệu của tôi".
Luôn giải thích rõ ràng, sử dụng ví dụ nếu có thể, và khuyến khích học sinh tìm hiểu thêm.
Trả lời bằng tiếng Việt.`;

    const fallbackSystemPrompt = `Bạn là trợ lý học tập của ZaloEdu. 
Khi không có tài liệu nội bộ, hãy trả lời ngắn gọn, chính xác theo kiến thức phổ thông, 
và nêu rõ đây là câu trả lời tổng quát chưa dựa trên tài liệu RAG.`;

    const useRagContext = !!context && context.trim().length > 0;
    const userMessage = useRagContext
      ? `Context:\n${context}\n\nCâu hỏi: ${query}`
      : `Câu hỏi: ${query}`;

    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: this.CHAT_MODEL,
          messages: [
            { role: 'system', content: useRagContext ? systemPrompt : fallbackSystemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
          max_tokens: 500,
        },
        {
          headers: {
            Authorization: `Bearer ${this.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.choices[0].message.content;
    } catch (error: any) {
      this.logger.warn(`OpenAI API call failed, using local fallback response: ${error?.message || 'Unknown error'}`);
      if (useRagContext) {
        return `Dựa trên tài liệu hiện có, mình tìm thấy thông tin liên quan như sau:\n\n${context!.substring(0, 400)}...`;
      }

      return 'Hiện tại mình chưa thể kết nối dịch vụ AI để trả lời tự do. Bạn có thể tải tài liệu học tập lên để mình trả lời theo kho dữ liệu nội bộ.';
    }
  }

  private createCitations(chunks: RAGChunk[]): Citation[] {
    return chunks.map((chunk) => ({
      chunkId: chunk.chunkId || '',
      content: chunk.content.substring(0, 150) + '...',
      sourceTitle: chunk.sourceTitle,
      pageNumber: chunk.pageNumber,
      relevanceScore: 0.9,
    }));
  }

  async getDocumentChunks(docId: string): Promise<RAGChunk[]> {
    const db = this.mongoDb.getDatabase();
    const chunksCollection = db.collection('chunks');

    return (await chunksCollection.find({ docId }).toArray()) as any as RAGChunk[];
  }
}
