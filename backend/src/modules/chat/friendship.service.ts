import { Injectable, BadRequestException } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { PutCommand, QueryCommand, GetCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { Friendship } from '@zalo-edu/shared';

@Injectable()
export class FriendshipService {
  constructor(private readonly db: DynamoDBService) {}

  /**
   * SEND FRIEND REQUEST
   */
  async sendRequest(senderEmail: string, receiverEmail: string) {
    if (senderEmail === receiverEmail) throw new BadRequestException('Cannot add yourself');

    const checkExisting = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${senderEmail}`, SK: `FRIEND#${receiverEmail}` }
    }));

    if (checkExisting.Item) throw new BadRequestException('Request already sent or already friends');

    const timestamp = new Date().toISOString();

    await this.db.docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: `USER#${senderEmail}`,
              SK: `FRIEND#${receiverEmail}`,
              sender_id: senderEmail,
              receiver_id: receiverEmail,
              status: 'pending',
              createdAt: timestamp,
              updatedAt: timestamp
            }
          }
        },
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: `USER#${receiverEmail}`,
              SK: `FRIEND#${senderEmail}`,
              sender_id: senderEmail,
              receiver_id: receiverEmail,
              status: 'pending',
              createdAt: timestamp,
              updatedAt: timestamp
            }
          }
        }
      ]
    }));

    return { message: 'Friend request sent successfully' };
  }

  /**
   * ACCEPT FRIEND REQUEST
   */
  async acceptRequest(userEmail: string, senderEmail: string) {
    const timestamp = new Date().toISOString();

    await this.db.docClient.send(new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: `USER#${userEmail}`,
              SK: `FRIEND#${senderEmail}`,
              sender_id: senderEmail,
              receiver_id: userEmail,
              status: 'accepted',
              updatedAt: timestamp
            }
          }
        },
        {
          Put: {
            TableName: this.db.tableName,
            Item: {
              PK: `USER#${senderEmail}`,
              SK: `FRIEND#${userEmail}`,
              sender_id: senderEmail,
              receiver_id: userEmail,
              status: 'accepted',
              updatedAt: timestamp
            }
          }
        }
      ]
    }));

    return { message: 'Friend request accepted' };
  }

  /**
   * GET ALL FRIENDS (AND PENDING REQUESTS)
   */
  async getFriendships(email: string) {
    const result = await this.db.docClient.send(new QueryCommand({
      TableName: this.db.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':skPrefix': 'FRIEND#'
      }
    }));

    return (result.Items || []) as Friendship[];
  }
}
