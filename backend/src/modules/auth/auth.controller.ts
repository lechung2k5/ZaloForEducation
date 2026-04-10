import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto, LoginRequestDto } from '@zalo-edu/shared';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/request-otp')
  async requestRegisterOtp(@Body() body: { email: string }) {
    return this.authService.requestRegisterOtp(body.email);
  }

  @Post('register/confirm')
  async confirmRegister(@Body() dto: RegisterRequestDto) {
    return this.authService.confirmRegister(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginRequestDto) {
    return this.authService.login(dto);
  }

  // ===== QUÊN MẬT KHẨU =====

  @Post('forgot-password/request-otp')
  async forgotPasswordRequestOtp(@Body() body: { email: string }) {
    return this.authService.forgotPasswordRequestOtp(body.email);
  }

  @Post('forgot-password/verify-otp')
  async forgotPasswordVerifyOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.forgotPasswordVerifyOtp(body.email, body.otp);
  }

  @Post('forgot-password/reset')
  async resetPassword(@Body() body: { email: string; otp: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.otp, body.newPassword);
  }
}
