import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { QueryCommand, UpdateCommand, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SessionService } from './session.service';
import { ChatGateway } from '../chat/chat.gateway';

@Injectable()
export class DeviceService {
  private readonly logger = new Logger(DeviceService.name);

  constructor(
    private readonly db: DynamoDBService,
    private readonly sessionService: SessionService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) { }

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

  /**
   * Bắt buộc tạo Session bản ghi vào bảng Sessions (DynamoDB/Redis).
   * Giúp các Guard không bị lỗi SESSION_INVALIDATED.
   */
  /**
   * Hybrid Single-Session Logic (V4) - BẢN GIA CỐ ƯU TIÊN DYNAMODB
   * Đảm bảo: 1 Web + 1 Mobile cùng lúc.
   * - Login Web mới -> "Đá" Web cũ, giữ Mobile.
   * - Login Mobile mới -> "Đá" Mobile cũ, giữ Web.
   */
  async handleNewSession(email: string, deviceId: string, metadata?: any) {
    const rawNewType = (metadata?.deviceType || 'web').toLowerCase();
    // Chuẩn hóa loại thiết bị: web/desktop -> WEB, mobile/tablet/android/ios -> MOBILE
    const newCategory = (rawNewType === 'mobile' || rawNewType === 'tablet' || rawNewType === 'android' || rawNewType === 'ios') ? 'MOBILE' : 'WEB';
    
    this.logger.log(`[DeviceService.handleNewSession] Hybrid Session check for ${email} (Type: ${rawNewType}, Category: ${newCategory})`);
    
    // 1. Quét TOÀN BỘ thiết bị trong DynamoDB của User này
    const result = await this.db.docClient.send(new QueryCommand({
      TableName: this.db.tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :sk)',
      ExpressionAttributeValues: {
        ':pk': `USER#${email}`,
        ':sk': 'DEVICE#',
      },
    }));

    const allDevices = result.Items || [];

    for (const oldDevice of allDevices) {
      // Sửa lỗi: Nếu thuộc tính deviceId bị thiếu, trích xuất từ SK (DEVICE#...)
      const oldDeviceId = oldDevice.deviceId || (oldDevice.SK as string)?.replace('DEVICE#', '');
      
      if (!oldDeviceId || oldDeviceId === deviceId) continue;

      // Chỉ xét các thiết bị đang ACTIVE
      if (oldDevice.status !== 'ACTIVE') continue;

      const rawOldType = (oldDevice.deviceType || 'unknown').toLowerCase();
      const oldCategory = (rawOldType === 'mobile' || rawOldType === 'tablet' || rawOldType === 'android' || rawOldType === 'ios' || oldDevice.platform === 'mobile') ? 'MOBILE' : 'WEB';

      // QUY TẮC CỐT LÕI: Chỉ "đá" nếu cùng nhóm phân loại (WEB đá WEB, MOBILE đá MOBILE)
      if (oldCategory === newCategory) {
        this.logger.warn(`[DeviceService] Kicking out duplicate session category: ${oldCategory} (ID: ${oldDeviceId}, Type: ${rawOldType})`);
        
        // A. Đánh dấu REVOKED trong DynamoDB
        await this.markAsLoggedOut(email, oldDeviceId, {
          deviceName: oldDevice.deviceName,
          deviceType: oldDevice.deviceType,
          reason: 'SESSION_REPLACED'
        });

        // B. Xóa Key trong Redis (Chặn đứng Request ngay lập tức)
        await this.sessionService.removeSession(email, oldDeviceId);

        // C. Bắn tín hiệu Socket (Đá đích danh)
        this.chatGateway.notifyForceLogout(
          email, 
          oldDeviceId, 
          `Hệ thống phát hiện đăng nhập mới trên một thiết bị ${newCategory.toLowerCase()} khác. Phiên làm việc này đã bị chấm dứt để bảo mật.`
        );
      }
    }

    const now = new Date().toISOString();
    
    // 2. Kích hoạt phiên mới trong DynamoDB (Dùng PutCommand để ghi đè toàn bộ hoặc UpdateCommand)
    // Ở đây dùng UpdateCommand để giữ lại các trường như 'trusted' và 'createdAt' nếu đã có
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: `DEVICE#${deviceId}` },
      UpdateExpression: 'SET #status = :s, lastLoginAt = :now, updatedAt = :now, deviceName = :dName, deviceType = :dType, platform = :p, lastLogoutReason = :null, deviceId = :did',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':s': 'ACTIVE',
        ':now': now,
        ':dName': metadata?.deviceName || 'Thiết bị mới',
        ':dType': rawNewType,
        ':p': newCategory.toLowerCase(),
        ':null': null,
        ':did': deviceId,
      },
    }));
  }

  /**
   * Vô hiệu hóa TẤT CẢ các phiên đăng nhập của người dùng (dùng khi Khóa/Xóa tài khoản hoặc Đổi mật khẩu).
   */
  async revokeAllSessions(email: string) {
    this.logger.warn(`[DeviceService] Revoking ALL sessions for ${email}`);
    
    // 1. Lấy danh sách session active từ Redis
    const activeDeviceIds = await this.sessionService.getSessions(email);
    
    for (const deviceId of activeDeviceIds) {
      const session = await this.sessionService.getSession(email, deviceId);
      
      // 2. Mark là LOGGED_OUT trong DynamoDB
      await this.markAsLoggedOut(email, deviceId, {
        deviceName: session?.deviceName,
        deviceType: session?.deviceType,
        reason: 'SESSION_REPLACED'
      });

      // 3. Remove khỏi Redis
      await this.sessionService.removeSession(email, deviceId);
    }

    // 4. Bắn Socket thông báo toàn hệ thống
    this.chatGateway.notifyForceLogout(email, 'all', 'Tài khoản của bạn đã được cập nhật trạng thái bảo mật mới. Tất cả các thiết bị đã bị đăng xuất.');
    this.chatGateway.notifySessionsUpdate(email);
    
    return { success: true };
  }
}
