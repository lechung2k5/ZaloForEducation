import { Controller, Post, Body, Get, UseGuards, Req, Param, Delete } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterRequestDto, LoginRequestDto } from '@zalo-edu/shared';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { UserService } from '../user/user.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService
  ) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req) {
    const email = req.user.email;
    return this.userService.getUserProfile(email);
  }

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

  @Post('verify-login-otp')
  async verifyLoginOtp(@Body() body: { 
    email: string; 
    otp: string; 
    deviceId: string; 
    deviceName?: string; 
    deviceType?: string; 
  }) {
    return this.authService.verifyLoginOtp(body.email, body.otp, body.deviceId, body.deviceName, body.deviceType);
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
  @UseGuards(JwtAuthGuard)
  async refresh(@Req() req) {
    const { email, deviceId } = req.user;
    return this.authService.refreshToken(email, deviceId);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req, @Body() body: { deviceId?: string }) {
    const email = req.user.email;
    // FIX: Luôn ưu tiên deviceId từ JWT payload (req.user.deviceId)
    // để đảm bảo đúng session bị xóa, tránh mismatch khi QR login
    // hoặc khi client gửi sai deviceId trong body
    const deviceId = req.user.deviceId || body.deviceId;
    if (!deviceId) {
      return { message: 'Không tìm thấy deviceId.' };
    }
    return this.authService.logout(email, deviceId);
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

  // ===== KHÓA TÀI KHOẢN =====

  @Post('lock-account/request')
  @UseGuards(JwtAuthGuard)
  async requestLockAccount(@Req() req, @Body() body: { currentPassword: string }) {
    return this.authService.requestLockAccount(req.user.email, body.currentPassword);
  }

  @Post('lock-account/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmLockAccount(@Req() req, @Body() body: { otp: string }) {
    return this.authService.confirmLockAccount(req.user.email, body.otp);
  }

  // ===== XÓA TÀI KHOẢN =====

  @Post('delete-account/request')
  @UseGuards(JwtAuthGuard)
  async requestDeleteAccount(@Req() req, @Body() body: { currentPassword: string }) {
    return this.authService.requestDeleteAccount(req.user.email, body.currentPassword);
  }

  @Post('delete-account/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmDeleteAccount(@Req() req, @Body() body: { otp: string }) {
    return this.authService.confirmDeleteAccount(req.user.email, body.otp);
  }

  // ===== XÓA TÀI KHOẢN KHI ĐANG BỊ KHÓA (PUBLIC FLOW) =====

  @Post('locked/delete-request')
  async requestDeleteLockedAccount(@Body() body: { email: string; currentPassword: string }) {
    return this.authService.requestDeleteLockedAccount(body.email, body.currentPassword);
  }

  @Post('locked/delete-confirm')
  async confirmDeleteLockedAccount(@Body() body: { email: string; otp: string }) {
    return this.authService.confirmDeleteLockedAccount(body.email, body.otp);
  }

  @Post('test-email')
  async testEmail(@Body() body: { email: string }) {
    return this.authService.testEmail(body.email);
  }

  // ===== QR LOGIN ENDPOINTS =====

  @Get('qr-code')
  async getQrCode() {
    return this.authService.generateQrCodeId();
  }

  @Post('qr-confirm')
  @UseGuards(JwtAuthGuard)
  async confirmQrCode(@Req() req, @Body() body: { qrCodeId: string; isBiometricVerified?: boolean }) {
    const email = req.user.email;
    return this.authService.confirmQrCode(email, body.qrCodeId, body.isBiometricVerified);
  }

  // ===== CHANGE PASSWORD (SUPREME SECURITY) =====

  @Post('change-password/request')
  @UseGuards(JwtAuthGuard)
  async requestChangePassword(@Req() req, @Body() body: { currentPassword: string; newPassword: string }) {
    const email = req.user.email;
    return this.authService.requestChangePassword(email, body.currentPassword, body.newPassword);
  }

  @Post('change-password/confirm')
  @UseGuards(JwtAuthGuard)
  async confirmChangePassword(@Req() req, @Body() body: { otp: string }) {
    const email = req.user.email;
    return this.authService.confirmChangePassword(email, body.otp);
  }

  // ===== GOOGLE LOGIN ENDPOINTS =====

  @Post('google-login')
  async googleLogin(@Body() body: { idToken: string; deviceId: string; deviceName?: string; deviceType?: string }) {
    return this.authService.googleLogin(body.idToken, body.deviceId, body.deviceName, body.deviceType);
  }

  @Post('google-complete/request-otp')
  async googleCompleteRequestOtp(@Body() body: { email: string }) {
    return this.authService.googleCompleteRequestOtp(body.email);
  }

  @Post('google-complete/confirm')
  async googleCompleteConfirm(@Body() dto: RegisterRequestDto & { deviceId: string; deviceName?: string; deviceType?: string }) {
    return this.authService.googleCompleteConfirm(dto);
  }
}
