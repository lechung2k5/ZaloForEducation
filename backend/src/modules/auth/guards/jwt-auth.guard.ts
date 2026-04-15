import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { SessionService } from '../session.service';
import { DeviceService } from '../device.service';
import { DynamoDBService } from '../../../infrastructure/dynamodb.service';
import { GetCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private sessionService: SessionService,
    private deviceService: DeviceService,
    private db: DynamoDBService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);
    
    if (!token) {
      throw new UnauthorizedException('Không tìm thấy Token xác thực.');
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('JWT_SECRET') || 'zaloedu_secret',
      });

      // --- NEW LOGIC: VERIFY SESSION IN REDIS AND DB ---
      if (payload.email && payload.deviceId) {
        // 1. Kiểm tra Redis (Active session) - Nhanh
        const session = await this.sessionService.getSession(payload.email, payload.deviceId);
        
        if (!session) {
          console.warn(`[AUTH] Redis session missing for ${payload.email} on ${payload.deviceId}`);
          throw new UnauthorizedException('SESSION_INVALIDATED');
        }

        // 2. Kiểm tra DB (Device Status) - Isolation sếp yêu cầu
        const dbDevice = await this.deviceService.getDeviceStatus(payload.email, payload.deviceId);
        if (!dbDevice || dbDevice.status !== 'ACTIVE') {
          console.warn(`[AUTH] DB session invalidated (status: ${dbDevice?.status}) for ${payload.email}`);
          throw new UnauthorizedException('SESSION_INVALIDATED');
        }

        // 3. Kiểm tra trạng thái USER (LOCKED/DELETED) - "Chặn đường về"
        const userRes = await this.db.docClient.send(new GetCommand({
          TableName: this.db.tableName,
          Key: { PK: `USER#${payload.email}`, SK: 'METADATA' }
        }));
        const user = userRes.Item;
        if (!user) {
          throw new UnauthorizedException('Tài khoản không tồn tại.');
        }
        if (user.status === 'LOCKED') {
          throw new UnauthorizedException('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ quản trị viên.');
        }
        if (user.isDeleted === true) {
          throw new UnauthorizedException('Tài khoản này đã bị xóa. Vui lòng liên hệ hỗ trợ nếu có nhầm lẫn.');
        }
      }

      request['user'] = payload;
    } catch (err) {
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn.');
    }

    return true;
  }

  private extractTokenFromHeader(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
