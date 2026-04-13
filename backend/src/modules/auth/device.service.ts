import { Injectable, Logger } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(private readonly db: DynamoDBService) {}

  /**
   * Đánh dấu thiết bị là đã đăng xuất (hoặc bị kick).
   * @param email Email của người dùng
   * @param deviceId ID của thiết bị
   * @param metadata Các thông tin bổ sung (tên máy, loại máy) lấy từ session trước khi xóa
   */
  async markAsLoggedOut(email: string, deviceId: string, metadata?: { deviceName?: string, deviceType?: string }) {
    this.logger.log(`Marking device ${deviceId} as LOGGED_OUT for ${email}`);

    const now = new Date().toISOString();
    // TTL: 30 ngày kể từ lúc logout (tính bằng giây)
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60);

    try {
      await this.db.docClient.send(new UpdateCommand({
        TableName: this.db.tableName,
        Key: { 
          PK: `USER#${email}`, 
          SK: `DEVICE#${deviceId}` 
        },
        UpdateExpression: 'SET #status = :s, logoutAt = :now, updatedAt = :now, expiresAt = :ttl, deviceName = :dName, deviceType = :dType',
        ExpressionAttributeNames: { 
          '#status': 'status' 
        },
        ExpressionAttributeValues: {
          ':s': 'LOGGED_OUT',
          ':now': now,
          ':ttl': expiresAt,
          ':dName': metadata?.deviceName || 'Thiết bị cũ',
          ':dType': metadata?.deviceType || 'unknown',
        },
      }));
    } catch (error) {
      this.logger.error(`Failed to mark device ${deviceId} as LOGGED_OUT`, error.stack);
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
