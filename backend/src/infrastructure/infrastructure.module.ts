import { Global, Module } from '@nestjs/common';
import { DynamoDBService } from './dynamodb.service';
import { EmailService } from './email/email.service';
import { RedisService } from './redis.service';
import { S3Service } from './s3.service';
import { MessageEncryptionService } from './message-encryption.service';

@Global()
@Module({
  providers: [DynamoDBService, EmailService, RedisService, S3Service, MessageEncryptionService],
  exports: [DynamoDBService, EmailService, RedisService, S3Service, MessageEncryptionService],
})
export class InfrastructureModule {}
