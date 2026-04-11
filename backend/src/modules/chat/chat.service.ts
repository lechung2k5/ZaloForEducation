import { Injectable, BadRequestException } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { PutCommand, GetCommand, QueryCommand, BatchGetCommand, UpdateCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Conversation, User } from '@zalo-edu/shared';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ChatService {
  constructor(private readonly db: DynamoDBService) {}

  /**
   * CREATE DIRECT CONVERSATION (1-1)
   */
  async createDirectConversation(email1: string, email2: string) {
    if (email1 === email2) throw new BadRequestException('Cannot create chat with yourself');
    
    // Create a predictable conversation ID for 1-1 chats (e.g. sorted emails)
    const sorted = [email1, email2].sort();
    const convId = `CONV#DIRECT#${sorted[0]}#${sorted[1]}`;

    // Check if exists
    const exists = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: convId, SK: 'METADATA' }
    }));

    if (exists.Item) return exists.Item as Conversation;

    const newConv: Conversation = {
      id: convId,
      type: 'direct',
      members: [email1, email2],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Use TransactWrite to ensure all or nothing
    await this.db.docClient.send(new TransactWriteCommand({
      TransactItems: [
        // 1. The Conversation Metadata
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: convId,
              SK: 'METADATA',
              ...newConv
            }
          }
        },
        // 2. Mapping for User 1
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: `USER#${email1}`,
              SK: convId,
              type: 'direct',
              partner: email2,
              createdAt: newConv.createdAt
            }
          }
        },
        // 3. Mapping for User 2
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: `USER#${email2}`,
              SK: convId,
              type: 'direct',
              partner: email1,
              createdAt: newConv.createdAt
            }
          }
        }
      ]
    }));

    return newConv;
  }

  /**
   * CREATE GROUP CONVERSATION
   */
  async createGroupConversation(adminEmail: string, members: string[], groupName: string) {
    const allMembers = Array.from(new Set([adminEmail, ...members]));
    if (allMembers.length < 3) throw new BadRequestException('Group must have at least 3 members');

    const rawId = uuidv4();
    const convId = `CONV#GROUP#${rawId}`;

    const newConv: Conversation = {
      id: convId,
      name: groupName,
      type: 'group',
      admin: adminEmail,
      members: allMembers,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Construct TransactItems (Max 100 items per request in DynamoDB)
    const transactItems: any[] = [
      {
        Put: {
          TableName: this.db.tableName,
          Item: {
            PK: convId,
            SK: 'METADATA',
            ...newConv
          }
        }
      }
    ];

    for (const member of allMembers) {
      transactItems.push({
        Put: {
          TableName: this.db.tableName,
          Item: {
            PK: `USER#${member}`,
            SK: convId,
            type: 'group',
            name: groupName,
            createdAt: newConv.createdAt
          }
        }
      });
    }

    await this.db.docClient.send(new TransactWriteCommand({
      TransactItems: transactItems
    }));

    return newConv;
  }

  /**
   * GET USER CONVERSATIONS (INBOX)
   */
  async getConversationsByUser(email: string) {
    // Step 1: Find all conversation mappings for this user
    const mappingParams = new QueryCommand({
      TableName: this.db.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'CONV#'
      }
    });

    const mappingResult = await this.db.docClient.send(mappingParams);
    const mappings = mappingResult.Items || [];

    if (mappings.length === 0) return [];

    // Step 2: BatchGet all Conversation Metadata
    const keys = mappings.map(m => ({
      PK: m.SK as string,
      SK: 'METADATA'
    }));

    // Chunk arrays if > 100 max per Dynamo BatchGet
    const results: Conversation[] = [];
    
    // For simplicity, assuming < 100 conversations for MVP
    const batchResult = await this.db.docClient.send(new BatchGetCommand({
      RequestItems: {
        [this.db.tableName]: {
          Keys: keys
        }
      }
    }));

    const convs = batchResult.Responses?.[this.db.tableName] as Conversation[] || [];
    
    // Map with latest message details and return sorted
    return convs.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }
}
