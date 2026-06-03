import { GetCommand } from '@aws-sdk/lib-dynamodb';
import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, any>;
  categoryId?: string;
};

type StoredPushToken = {
  token: string;
  deviceId?: string | null;
  platform?: string | null;
  updatedAt?: string;
};

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly expoPushUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(private readonly db: DynamoDBService) {}

  async sendNotification(targetEmail: string, payload: PushPayload) {
    const tokens = await this.getExpoPushTokens(targetEmail);
    if (tokens.length === 0) {
      this.logger.debug(`[Notification] No push token for ${targetEmail}`);
      return false;
    }

    const messages = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      priority: 'high',
      channelId: 'default',
      ...(payload.categoryId ? { categoryId: payload.categoryId } : {}),
    }));

    await this.sendExpoMessages(messages);
    this.logger.log(`[Notification] Push sent to ${targetEmail} (${tokens.length} device(s))`);
    return true;
  }

  async broadcastNotification(emails: string[], payload: PushPayload) {
    const uniqueEmails = [
      ...new Set(
        emails
          .map((email) => String(email || '').toLowerCase())
          .filter(Boolean),
      ),
    ];

    this.logger.log(`[Notification] Broadcasting to ${uniqueEmails.length} users`);
    await Promise.all(uniqueEmails.map((email) => this.sendNotification(email, payload)));
  }

  private async getExpoPushTokens(email: string): Promise<string[]> {
    const normalizedEmail = String(email || '').toLowerCase();
    if (!normalizedEmail) return [];

    const result = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${normalizedEmail}`, SK: 'METADATA' },
        ProjectionExpression: 'pushTokens',
      }),
    );

    const pushTokens = Array.isArray(result.Item?.pushTokens)
      ? (result.Item.pushTokens as StoredPushToken[])
      : [];

    return [
      ...new Set(
        pushTokens
          .map((item) => String(item?.token || '').trim())
          .filter((token) => this.isExpoPushToken(token)),
      ),
    ];
  }

  private isExpoPushToken(token: string) {
    return /^ExponentPushToken\[[^\]]+\]$/.test(token) || /^ExpoPushToken\[[^\]]+\]$/.test(token);
  }

  private async sendExpoMessages(messages: any[]) {
    const chunkSize = 100;

    for (let index = 0; index < messages.length; index += chunkSize) {
      const chunk = messages.slice(index, index + chunkSize);
      try {
        const response = await fetch(this.expoPushUrl, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const text = await response.text();
          this.logger.warn(`[Notification] Expo push failed ${response.status}: ${text}`);
        }
      } catch (error: any) {
        this.logger.warn(`[Notification] Expo push request failed: ${error?.message || error}`);
      }
    }
  }
}
