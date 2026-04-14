import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis.service';

@Injectable()
export class OtpLimiterService {
  constructor(private readonly redis: RedisService) {}

  /**
   * Check if the identifier (email) is in the cooldown period.
   * If yes, throws a 429 Too Many Requests error with the remaining TTL.
   * @param identifier The user's email
   * @param type The OTP type (register, forgot_password, etc.)
   */
  async checkCooldown(identifier: string, type: string): Promise<void> {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    const key = `OTP_COOLDOWN:${type}:${normalizedIdentifier}`;

    const ttl = await this.redis.ttl(key);

    if (ttl > 0) {
      throw new HttpException(
        {
          message: `Vui lòng đợi ${ttl} giây trước khi yêu cầu mã mới.`,
          retryAfter: ttl,
          error: 'Too Many Requests',
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set cooldown for 30 seconds
    await this.redis.set(key, 'true', 30);
  }

  /**
   * Manually clear a cooldown (optional, useful for edge cases)
   */
  async clearCooldown(identifier: string, type: string): Promise<void> {
    const normalizedIdentifier = identifier.toLowerCase().trim();
    const key = `OTP_COOLDOWN:${type}:${normalizedIdentifier}`;
    await this.redis.del(key);
  }
}
