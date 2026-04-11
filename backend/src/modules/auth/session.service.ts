import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis.service';
import { UserSession } from '@zalo-edu/shared';

@Injectable()
export class SessionService {
  constructor(public readonly redis: RedisService) { }

  async getSession(deviceId: string) {
    const sessionId = `SESSION#${deviceId}`;
    const data = await this.redis.get(sessionId);
    return data ? JSON.parse(data) : null;
  }

  async createSession(userId: string, deviceId: string, metadata?: { deviceName?: string, deviceType?: string }) {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    const sessionId = `SESSION#${deviceId}`;
    
    // 1. Dữ liệu session chi tiết
    const sessionData = {
      deviceId,
      userId,
      deviceName: metadata?.deviceName || 'Thiết bị không xác định',
      deviceType: metadata?.deviceType || 'unknown',
      loginAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isActive: true,
    };
    
    // 2. Lưu vào Redis (30 ngày)
    await this.redis.set(sessionId, JSON.stringify(sessionData), 86400 * 30);
    
    // 3. Quản lý danh sách thiết bị của User (SET)
    await this.redis.sAdd(userSessionsKey, deviceId);
    await this.redis.expire(userSessionsKey, 86400 * 30);

    return sessionData;
  }

  async getSessions(userId: string): Promise<string[]> {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    return await this.redis.sMembers(userSessionsKey);
  }

  async removeSession(userId: string, deviceId: string) {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    const sessionId = `SESSION#${deviceId}`;
    
    await this.redis.del(sessionId);
    await this.redis.sRem(userSessionsKey, deviceId);
  }

  async removeAllSessions(userId: string) {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    const deviceIds = await this.redis.sMembers(userSessionsKey);
    
    for (const deviceId of deviceIds) {
      await this.redis.del(`SESSION#${deviceId}`);
    }
    
    await this.redis.del(userSessionsKey);
  }
}
