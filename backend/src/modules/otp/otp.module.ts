import { Module } from '@nestjs/common';
import { OtpService } from './otp.service';
import { OtpLimiterService } from './otp-limiter.service';

@Module({
  providers: [OtpService, OtpLimiterService],
  exports: [OtpService, OtpLimiterService],
})
export class OtpModule {}
