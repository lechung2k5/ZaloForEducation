import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis.service';
import { UserSession } from '@zalo-edu/shared';

@Injectable()
export class SessionService {
  constructor(public readonly redis: RedisService) { }

  private getSessionKey(userId: string, deviceId: string): string {
    return `session:${userId}:${deviceId}`;
  }

  async getSession(userId: string, deviceId: string) {
    const key = this.getSessionKey(userId, deviceId);
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  // Legacy/Internal support for full key lookups (used by JwtAuthGuard)
  async getSessionByFullKey(key: string) {
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  async createSession(userId: string, deviceId: string, metadata?: { deviceName?: string, deviceType?: string, platform?: string }) {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    const sessionId = this.getSessionKey(userId, deviceId);
    
    // 1. Dữ liệu session chi tiết
    const sessionData = {
      deviceId,
      userId,
      deviceName: metadata?.deviceName || 'Thiết bị không xác định',
      deviceType: metadata?.deviceType || 'unknown',
      platform: metadata?.platform || 'mobile',
      loginAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
      isActive: true,
    };
    
    // 2. Lưu vào Redis (7 ngày = 604800s)
    await this.redis.set(sessionId, JSON.stringify(sessionData), 604800);
    
    // 3. Quản lý danh sách thiết bị của User (SET)
    await this.redis.sAdd(userSessionsKey, deviceId);
    await this.redis.expire(userSessionsKey, 604800);

    return sessionData;
  }

  async getSessions(userId: string): Promise<string[]> {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    return await this.redis.sMembers(userSessionsKey);
  }

  async removeSession(userId: string, deviceId: string) {
    if (!deviceId) return; // Chốt chặn an toàn cho lỗi TypeError Redis
    
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    const sessionId = this.getSessionKey(userId, deviceId);
    
    await this.redis.del(sessionId);
    await this.redis.sRem(userSessionsKey, deviceId);
  }

  async removeAllSessions(userId: string) {
    const userSessionsKey = `USER_SESSIONS#${userId}`;
    const deviceIds = await this.redis.sMembers(userSessionsKey);
    
    for (const deviceId of deviceIds) {
      await this.redis.del(this.getSessionKey(userId, deviceId));
    }
    
    await this.redis.del(userSessionsKey);
  }
}
