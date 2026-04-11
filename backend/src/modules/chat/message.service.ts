import { Injectable } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { Message } from '@zalo-edu/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class MessageService {
  constructor(private readonly db: DynamoDBService) {}

  /**
   * SEND A NEW MESSAGE
   */
  async sendMessage(convId: string, senderEmail: string, content: string, type: Message['type'] = 'text', media: any[] = [], files: any[] = []) {
    const timestamp = new Date().toISOString();
    const msgId = uuidv4();
    // Sort key format: MSG#2026-04-10T...#uuid ensures chronological sorting in DynamoDB
    const SK = `MSG#${timestamp}#${msgId}`;

    const newMessage: Message = {
      id: SK,
      conversationId: convId,
      senderId: senderEmail,
      content,
      type,
      media,
      files,
      createdAt: timestamp,
    };

    // 1. Save Message
    await this.db.docClient.send(new PutCommand({
      TableName: this.db.tableName,
      Item: {
        PK: convId,
        SK: SK,
        ...newMessage
      }
    }));

    // 2. Update Conversation's lastMessage and updatedAt
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: convId, SK: 'METADATA' },
      UpdateExpression: 'SET lastMessage = :sk, updatedAt = :time',
      ExpressionAttributeValues: {
        ':sk': SK,
        ':time': timestamp
      }
    }));

    return newMessage;
  }

  /**
   * GET MESSAGES FOR CONVERSATION
   */
  async getMessages(convId: string, limit: number = 50, lastEvaluatedKey?: any) {
    const params: any = {
      TableName: this.db.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :msgPrefix)',
      ExpressionAttributeValues: {
        ':pk': convId,
        ':msgPrefix': 'MSG#'
      },
      ScanIndexForward: false, // get newest first
      Limit: limit
    };

    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const result = await this.db.docClient.send(new QueryCommand(params));

    // Reverse to chronological order for UI
    const items = (result.Items || []) as Message[];
    return {
      messages: items.reverse(),
      lastEvaluatedKey: result.LastEvaluatedKey
    };
  }
}
