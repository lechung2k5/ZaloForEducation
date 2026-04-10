import { Injectable, OnModuleInit } from '@nestjs/common';
import { DynamoDBClient, CreateTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DynamoDBService implements OnModuleInit {
  private client: DynamoDBClient;
  public docClient: DynamoDBDocumentClient;
  
  public get tableName(): string {
    return process.env.DYNAMODB_TABLE_NAME || 'ZaloEduTable';
  }

  constructor() {
    const region = process.env.AWS_REGION || 'ap-southeast-1';
    const endpoint = process.env.DYNAMODB_ENDPOINT; // Nếu không có, SDK sẽ tự dùng AWS Cloud endpoint

    this.client = new DynamoDBClient({
      region,
      endpoint,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    this.docClient = DynamoDBDocumentClient.from(this.client);
  }

  async onModuleInit() {
    await this.initializeTable();
  }

  private async initializeTable() {
    try {
      const listTables = await this.client.send(new ListTablesCommand({}));
      if (listTables.TableNames?.includes(this.tableName)) {
        console.log(`Table ${this.tableName} already exists.`);
        return;
      }

      const command = new CreateTableCommand({
        TableName: this.tableName,
        KeySchema: [
          { AttributeName: 'PK', KeyType: 'HASH' }, // Partition Key
          { AttributeName: 'SK', KeyType: 'RANGE' }, // Sort Key
        ],
        AttributeDefinitions: [
          { AttributeName: 'PK', AttributeType: 'S' },
          { AttributeName: 'SK', AttributeType: 'S' },
        ],
        ProvisionedThroughput: {
          ReadCapacityUnits: 5,
          WriteCapacityUnits: 5,
        },
      });

      await this.client.send(command);
      console.log(`Table ${this.tableName} created successfully.`);
    } catch (error) {
      console.error('Error initializing DynamoDB table:', error);
    }
  }
}
