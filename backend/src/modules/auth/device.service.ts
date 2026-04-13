import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly db: DynamoDBService) {}

  /**
   * Đánh dấu thiết bị là đã đăng xuất (hoặc bị kick).
   */
  async markAsLoggedOut(email: string, deviceId: string, metadata?: { deviceName?: string, deviceType?: string, reason?: 'USER_LOGOUT' | 'SESSION_REPLACED' | string }) {
    this.logger.log(`Marking device ${deviceId} as LOGGED_OUT for ${email} (Reason: ${metadata?.reason || 'USER_LOGOUT'})`);

    const now = new Date().toISOString();
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    // Rule: If kicked by another device, it's no longer trusted
    const isUntrusted = metadata?.reason === 'SESSION_REPLACED';

    try {
      await this.db.docClient.send(new UpdateCommand({
        TableName: this.db.tableName,
        Key: { 
          PK: `USER#${email}`, 
          SK: `DEVICE#${deviceId}` 
        },
        UpdateExpression: 'SET #status = :s, logoutAt = :now, updatedAt = :now, expiresAt = :ttl, deviceName = :dName, deviceType = :dType, lastLogoutReason = :reason' + (isUntrusted ? ', trusted = :f' : ''),
        ExpressionAttributeNames: { 
          '#status': 'status' 
        },
        ExpressionAttributeValues: {
          ':s': 'LOGGED_OUT',
          ':now': now,
          ':ttl': expiresAt,
          ':dName': metadata?.deviceName || 'Thiết bị cũ',
          ':dType': metadata?.deviceType || 'unknown',
          ':reason': metadata?.reason || 'USER_LOGOUT',
          ...(isUntrusted ? { ':f': false } : {}),
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to mark device ${deviceId} as LOGGED_OUT`, error.stack);
    }
  }

  /**
   * Đánh dấu thiết bị là tin cậy (đã qua OTP).
   */
  async trustDevice(email: string, deviceId: string) {
    this.logger.log(`Trusting device ${deviceId} for ${email}`);
    try {
      await this.db.docClient.send(new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: `DEVICE#${deviceId}` },
        UpdateExpression: 'SET trusted = :t, updatedAt = :now, lastLogoutReason = :null',
        ExpressionAttributeValues: {
          ':t': true,
          ':now': new Date().toISOString(),
          ':null': null,
        },
      }));
    } catch (error) {
      this.logger.error(`Error trusting device ${deviceId}`, error.stack);
    }
  }

  /**
   * Lấy lịch sử đăng nhập (các thiết bị đã đăng xuất) - Tối đa 10 cái mới nhất.
   */
  async getLoginHistory(email: string) {
    try {
      const result = await this.db.docClient.send(new QueryCommand({
        TableName: this.db.tableName,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
        FilterExpression: '#status = :s',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':pk': `USER#${email}`,
          ':sk': 'DEVICE#',
          ':s': 'LOGGED_OUT',
        },
      }));

      // Sắp xếp theo updatedAt mới nhất (DynamoDB query begins_with không hỗ trợ sort theo trường non-key trực tiếp)
      return (result.Items || [])
        .sort((a, b) => new Date(b.updatedAt || b.logoutAt).getTime() - new Date(a.updatedAt || a.logoutAt).getTime())
        .slice(0, 10);
    } catch (error) {
      this.logger.error(`Error fetching history for ${email}`, error.stack);
      return [];
    }
  }

  /**
   * Kiểm tra trạng thái thiết bị để đảm bảo tính phân tách phiên (Isolation).
   */
  async getDeviceStatus(email: string, deviceId: string) {
    try {
      const result = await this.db.docClient.send(new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: `DEVICE#${deviceId}` },
      }));
      return result.Item;
    } catch (error) {
      this.logger.error(`Error getting status for ${deviceId}`, error.stack);
      return null;
    }
  }
}
