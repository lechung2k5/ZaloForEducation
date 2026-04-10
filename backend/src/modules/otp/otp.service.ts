import { Injectable, BadRequestException } from '@nestjs/common';
import { RedisService } from '../../infrastructure/redis.service';
import { OtpCode } from '@zalo-edu/shared';

@Injectable()
export class OtpService {
  constructor(private readonly redis: RedisService) {}

  async createOtp(email: string, type: 'register' | 'forgot_password'): Promise<string> {
    const code = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
    
    // Lưu vào Redis với TTL 5 phút
    await this.redis.set(`OTP#${email}`, code, 300);

    return code;
  }

  async verifyOtp(email: string, inputCode: string): Promise<boolean> {
    const savedCode = await this.redis.get(`OTP#${email}`);

    if (!savedCode) {
      throw new BadRequestException('Mã OTP không hợp lệ hoặc đã hết hạn.');
    }

    if (savedCode !== inputCode) {
      throw new BadRequestException('Mã OTP không chính xác.');
    }

    // Thành công - xóa mã OTP
    await this.redis.del(`OTP#${email}`);

    return true;
  }

  // Lấy OTP mà không xóa (dùng cho bước preview verify)
  async getOtp(email: string): Promise<string | null> {
    return await this.redis.get(`OTP#${email}`);
  }
}
