import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { AuthController } from './auth.controller';
import { OtpModule } from '../otp/otp.module';
import { ChatModule } from '../chat/chat.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    OtpModule,
    ChatModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'zaloedu_secret',
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, SessionService],
  exports: [AuthService, SessionService],
})
export class AuthModule {}
