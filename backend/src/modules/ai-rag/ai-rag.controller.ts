import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AskRequest, AskResponse, ChatRequest, ChatResponse, IngestResponse } from './ai-rag.types';
import { AskService } from './ask.service';
import { IngestService } from './ingest.service';

@Controller('api/ai')
export class AIRagController {
  constructor(
    private readonly ingestService: IngestService,
    private readonly askService: AskService,
  ) {}

  /**
   * POST /api/ai/ingest
   * Upload tài liệu (PDF/text), extract, chunk, embedding, lưu MongoDB
   */
  @Post('ingest')
  @UseInterceptors(FileInterceptor('file'))
  async ingestDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { subject: string; grade: string; semester?: string },
    @Req() req: any,
  ): Promise<IngestResponse> {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }

    const userId = req.user?.email || 'system';

    return await this.ingestService.ingestDocument({
      file,
      subject: body.subject,
      grade: body.grade,
      semester: body.semester,
      userId,
    });
  }

  /**
   * POST /api/ai/ask
   * Query RAG: retrieve + generate answer với citations
   */
  @Post('ask')
  async ask(@Body() request: AskRequest): Promise<AskResponse> {
    if (!request.query || request.query.trim().length === 0) {
      throw new BadRequestException('Query is required and cannot be empty');
    }

    return await this.askService.ask(request);
  }

  /**
   * POST /api/ai/chat
   * Direct chat with OpenAI (no RAG retrieval)
   */
  @Post('chat')
  async chat(@Body() request: ChatRequest): Promise<ChatResponse> {
    if (!request?.message || request.message.trim().length === 0) {
      throw new BadRequestException('Message is required and cannot be empty');
    }

    return await this.askService.chatWithOpenAI(request.message);
  }

  /**
   * GET /api/ai/documents
   * Liệt kê các tài liệu đã ingest
   */
  @Get('documents')
  async listDocuments(
    @Query('subject') subject?: string,
    @Query('grade') grade?: string,
  ) {
    return await this.ingestService.listDocuments(subject, grade);
  }

  /**
   * DELETE /api/ai/documents/:docId
   * Xóa tài liệu (xóa tất cả chunks của nó)
   */
  @Post('documents/:docId/delete')
  async deleteDocument(@Param('docId') docId: string) {
    await this.ingestService.deleteDocument(docId);
    return { message: `Document ${docId} deleted successfully` };
  }

  /**
   * GET /api/ai/documents/:docId/chunks
   * Xem tất cả chunks của một document
   */
  @Get('documents/:docId/chunks')
  async getDocumentChunks(@Param('docId') docId: string) {
    return await this.askService.getDocumentChunks(docId);
  }

  /**
   * Health check
   */
  @Get('health')
  health() {
    return { status: 'AI-RAG module is running' };
  }
}
