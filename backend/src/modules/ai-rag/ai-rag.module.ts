import { Module } from '@nestjs/common';
import { IngestService } from './ingest.service';
import { AskService } from './ask.service';
import { AIRagController } from './ai-rag.controller';

@Module({
  controllers: [AIRagController],
  providers: [IngestService, AskService],
  exports: [IngestService, AskService],
})
export class AIRagModule {}
