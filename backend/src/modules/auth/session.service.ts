import { Injectable } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis.service';
import { UserSession } from '@zalo-edu/shared';

@Injectable()
export class SessionService {
  constructor(private readonly redis: RedisService) { }

  async createSession(userId: string, deviceId: string) {
    // 1. Logic 1 thiết bị: Xóa session cũ của user trong Redis
    // (Trong phiên bản này ta đơn giản hóa là overwrite key nếu dùng chung key pattern, 
    // hoặc lưu map USER_SESSIONS#userId -> deviceId)
    const userSessionKey = `USER_ACTIVE_SESSION#${userId}`;
    
    // 2. Tạo phiên mới
    const sessionId = `SESSION#${deviceId}`;
    const newSession: UserSession = {
      id: sessionId,
      userId,
      isActive: true,
      lastActiveAt: new Date().toISOString(),
    };

    // Lưu vào Redis: SESSION#deviceId -> userId (để auth) 
    // và USER_ACTIVE_SESSION#userId -> deviceId (để thực hiện 1 thiết bị)
    await this.redis.set(sessionId, userId, 86400 * 30); // 30 days
    await this.redis.set(userSessionKey, deviceId, 86400 * 30);

    return newSession;
  }
}
