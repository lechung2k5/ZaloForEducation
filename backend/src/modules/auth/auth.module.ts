import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ChatModule } from '../chat/chat.module';
import { OtpModule } from '../otp/otp.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SessionService } from './session.service';

@Module({
  imports: [
    OtpModule,
    ChatModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'zaloedu_secret',
        signOptions: { expiresIn: '7d' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService, JwtAuthGuard],
  exports: [AuthService, SessionService, JwtModule, JwtAuthGuard],
})
export class AuthModule {}
