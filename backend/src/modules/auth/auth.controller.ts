import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { LoginRequestDto, RegisterRequestDto } from '@zalo-edu/shared';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

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

  // ===== NEW ENDPOINTS (ALIGNED WITH SCREENSHOT) =====

  @Post('verify-otp')
  async verifyOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.verifyOtpGeneric(body.email, body.otp);
  }

  @Post('reset-password')
  async resetPasswordAlias(@Body() body: { email: string; otp: string; newPassword: string }) {
    return this.authService.resetPassword(body.email, body.otp, body.newPassword);
  }

  @Post('resend-otp')
  async resendOtp(@Body() body: { email: string; type: 'register' | 'forgot_password' }) {
    return this.authService.resendOtp(body.email, body.type);
  }

  @Post('register')
  async register(@Body() body: { email: string }) {
    return this.authService.requestRegisterOtp(body.email);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPasswordRequestOtp(body.email);
  }

  @Post('refresh')
  async refresh(@Body() body: { email: string }) {
    return this.authService.refreshToken(body.email);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req, @Body() body: { deviceId: string }) {
    const email = req.user.email;
    return this.authService.logout(email, body.deviceId);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  async logoutAll(@Req() req) {
    const email = req.user.email;
    return this.authService.logoutAll(email);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(@Req() req) {
    const email = req.user.email;
    return this.authService.getActiveSessions(email);
  }

  @Post('sessions/:deviceId') // Keep for compatibility if needed
  @UseGuards(JwtAuthGuard)
  async revokeSessionPost(@Req() req, @Body() body: { deviceId: string }) {
    const email = req.user.email;
    return this.authService.logout(email, body.deviceId || req.params.deviceId);
  }

  @Delete('sessions/:deviceId')
  @UseGuards(JwtAuthGuard)
  async revokeSession(@Req() req, @Param('deviceId') deviceId: string) {
    const email = req.user.email;
    return this.authService.logout(email, deviceId);
  }

  @Post('test-email')
  async testEmail(@Body() body: { email: string }) {
    return this.authService.testEmail(body.email);
  }

  // ===== ACCOUNT LOCK/UNLOCK =====

  @Post('account/request-lock-otp')
  @UseGuards(JwtAuthGuard)
  async requestLockOtp(@Req() req) {
    const email = req.user.email;
    return this.authService.requestLockOtp(email);
  }

  @Post('account/confirm-lock-otp')
  @UseGuards(JwtAuthGuard)
  async confirmLockOtp(@Req() req, @Body() body: { otp: string; reason?: string }) {
    const email = req.user.email;
    const reason = body?.reason || 'Yêu cầu từ người dùng';
    return this.authService.confirmLockOtp(email, body.otp, reason);
  }

  @Post('account/unlock')
  @UseGuards(JwtAuthGuard)
  async unlockAccount(@Req() req) {
    const email = req.user.email;
    return this.authService.unlockAccount(email);
  }

  @Delete('account/delete')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req) {
    const email = req.user.email;
    return this.authService.deleteAccount(email);
  }

  // ===== UNLOCK ACCOUNT WITH OTP =====

  @Post('account/request-unlock-otp')
  async requestUnlockOtp(@Body() body: { email: string }) {
    return this.authService.requestUnlockOtp(body.email);
  }

  @Post('account/confirm-unlock-otp')
  async confirmUnlockOtp(@Body() body: { email: string; otp: string }) {
    return this.authService.confirmUnlockOtp(body.email, body.otp);
  }
}
