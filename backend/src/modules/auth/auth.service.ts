import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../../infrastructure/email/email.service';
import { SessionService } from './session.service';
import { ChatGateway } from '../chat/chat.gateway';
import { PutCommand, GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { RegisterRequestDto, LoginRequestDto, User } from '@zalo-edu/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DynamoDBService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly jwtService: JwtService,
    private readonly sessionService: SessionService,
    private readonly chatGateway: ChatGateway,
  ) { }

  private validatePassword(password: string) {
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
      throw new BadRequestException(
        'Mật khẩu phải tối thiểu 8 ký tự, bao gồm chữ hoa, chữ thường, số và ký tự đặc biệt.'
      );
    }
  }

  private validateRegistrationData(dto: RegisterRequestDto) {
    if (!dto.phone || !/^(0|84)(3|5|7|8|9)([0-9]{8})$/.test(dto.phone)) {
      throw new BadRequestException('Số điện thoại không hợp lệ. Vui lòng nhập SĐT Việt Nam.');
    }

    if (!dto.fullName || dto.fullName.trim().split(/\s+/).length < 2) {
      throw new BadRequestException('Họ tên phải bao gồm ít nhất 2 từ.');
    }
    
    if (/[0-9!@#$%^&*(),.?":{}|<>]/.test(dto.fullName)) {
      throw new BadRequestException('Họ tên không được chứa số hoặc ký tự đặc biệt.');
    }

    this.validatePassword(dto.password);
  }

  async requestRegisterOtp(email: string) {
    const existingUser = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (existingUser.Item) {
      throw new BadRequestException('Email này đã được đăng ký.');
    }

    if (!email.endsWith('@gmail.com')) {
      throw new BadRequestException('Chỉ chấp nhận đăng ký bằng tài khoản Gmail.');
    }

    const code = await this.otpService.createOtp(email, 'register');
    const emailSent = await this.emailService.sendOtp(email, code, 'register');

    if (!emailSent) {
      throw new BadRequestException('Không thể gửi mail lúc này. Vui lòng thử lại.');
    }

    return { message: 'Mã OTP đã được gửi về Gmail của bạn.' };
  }

  async confirmRegister(dto: RegisterRequestDto) {
    this.validateRegistrationData(dto);
    await this.otpService.verifyOtp(dto.email, dto.otp);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const newUser: User = {
      id: `USER#${dto.email}`,
      email: dto.email,
      fullName: dto.fullName || '',
      gender: dto.gender ?? true,
      dataOfBirth: dto.dataOfBirth || '',
      phone: dto.phone || '',
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(dto.fullName || 'User')}&background=00418f&color=fff`,
      passwordHash,
      bio: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'active',
      isActive: true,
      lastLoginAt: new Date().toISOString(),
    };

    await this.db.docClient.send(new PutCommand({
      TableName: this.db.tableName,
      Item: {
        PK: newUser.id,
        SK: 'METADATA',
        ...newUser,
      },
    }));

    return { message: 'Đăng ký tài khoản thành công!' };
  }

  async login(dto: LoginRequestDto) {
    const result = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${dto.email}`, SK: 'METADATA' },
    }));

    const user = result.Item as User;
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không chính xác.');
    }

    // --- LOGIC: 1 THIẾT BỊ & REAL-TIME LOGOUT ---
    // Đảm bảo deviceId luôn có giá trị để tránh lỗi DynamoDB UpdateExpression
    const deviceId = dto.deviceId || `unknown-${Date.now()}`;

    // 2. Cập nhật deviceId mới vào User record (chỉ để track thiết bị cuối cùng)
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${dto.email}`, SK: 'METADATA' },
      UpdateExpression: 'SET currentDeviceId = :deviceId, lastLoginAt = :now',
      ExpressionAttributeValues: {
        ':deviceId': deviceId,
        ':now': new Date().toISOString(),
      },
    }));

    // 3. LOGIC: 1 THIẾT BỊ MỖI NỀN TẢNG (1 WEB + 1 APP)
    const activeSessions = await this.sessionService.getSessions(user.email);
    
    // Phân loại thiết bị: Ưu tiên prefix của deviceId để đảm bảo tính chính xác
    const isIncomingWeb = deviceId.startsWith('web-');
    const isIncomingApp = deviceId.startsWith('android-') || deviceId.startsWith('ios-');

    // Nếu không khớp prefix nhưng deviceType là mobile, giả định là App (để tương thích ngược)
    const isAppFinal = isIncomingApp || (!isIncomingWeb && dto.deviceType === 'mobile');
    const isWebFinal = isIncomingWeb || (!isAppFinal && (dto.deviceType === 'desktop' || dto.deviceType === 'web'));

    console.log(`[AUTH] Login detect: user=${user.email}, isApp=${isAppFinal}, isWeb=${isWebFinal}, deviceId=${deviceId}`);

    for (const oldId of activeSessions) {
      if (oldId === deviceId) continue;

      const oldSession = await this.sessionService.getSession(oldId);
      if (!oldSession) continue;

      const isOldWeb = oldId.startsWith('web-');
      const isOldApp = oldId.startsWith('android-') || oldId.startsWith('ios-') || (!isOldWeb && oldSession.deviceType === 'mobile');

      // Chỉ kick nếu cùng loại (Web kick Web, App kick App)
      if ((isAppFinal && isOldApp) || (isWebFinal && isOldWeb)) {
        console.log(`[AUTH] Conflict detected on ${isAppFinal ? 'APP' : 'WEB'} slot. Kicking: ${oldId}`);
        await this.sessionService.removeSession(user.email, oldId);
        this.chatGateway.notifyForceLogout(user.email, oldId);
        this.chatGateway.notifySessionsUpdate(user.email);
      }
    }

    // 4. Tạo/Cập nhật Session trong Redis & Lưu lịch sử thiết bị vào DynamoDB
    const metadata = { deviceName: dto.deviceName, deviceType: dto.deviceType };
    await this.sessionService.createSession(user.email, deviceId, metadata);

    await this.db.docClient.send(new PutCommand({
      TableName: this.db.tableName,
      Item: {
        PK: `USER#${user.email}`,
        SK: `DEVICE#${deviceId}`,
        email: user.email,
        deviceId,
        deviceName: dto.deviceName || 'Unknown Device',
        deviceType: dto.deviceType || 'unknown',
        lastLoginAt: new Date().toISOString(),
      },
    }));

    // 5. Thông báo cập nhật danh sách thiết bị thời gian thực
    this.chatGateway.notifySessionsUpdate(user.email);

    // 6. Trả về Token
    const payload = { sub: user.email, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        email: user.email,
        fullName: user.fullName,
      },
    };
  }

  // ===== QUÊN MẬT KHẨU =====

  async forgotPasswordRequestOtp(email: string) {
    // Kiểm tra email tồn tại
    const result = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!result.Item) {
      throw new BadRequestException('Email này chưa được đăng ký trong hệ thống.');
    }

    // Gửi OTP forgot_password qua email
    const code = await this.otpService.createOtp(email, 'forgot_password');
    await this.emailService.sendOtp(email, code, 'forgot_password');

    return { message: 'Mã OTP đã được gửi về Gmail của bạn. Vui lòng kiểm tra hộp thư.' };
  }

  async forgotPasswordVerifyOtp(email: string, otp: string) {
    // Xác thực OTP nhưng KHÔNG xóa (để bước reset vẫn dùng được)
    const savedCode = await this.otpService.getOtp(email);

    if (!savedCode || savedCode !== otp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
    }

    return { message: 'Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    this.validatePassword(newPassword);
    // Xác thực và xóa OTP
    await this.otpService.verifyOtp(email, otp);

    // Hash mật khẩu mới
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // Cập nhật DynamoDB
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET passwordHash = :hash',
      ExpressionAttributeValues: {
        ':hash': passwordHash,
      },
    }));

    return { message: 'Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.' };
  }

  async logout(email: string, deviceId: string) {
    await this.sessionService.removeSession(email, deviceId);
    this.chatGateway.notifyForceLogout(email, deviceId); 
    this.chatGateway.notifySessionsUpdate(email); // Real-time update list
    return { message: 'Đăng xuất thành công.' };
  }

  async logoutAll(email: string) {
    await this.sessionService.removeAllSessions(email);
    this.chatGateway.notifyForceLogout(email, 'ALL'); 
    this.chatGateway.notifySessionsUpdate(email); // Real-time update list
    return { message: 'Đã đăng xuất khỏi tất cả các thiết bị.' };
  }

  async getActiveSessions(email: string) {
    const deviceIds = await this.sessionService.getSessions(email);
    const sessions = [];

    console.log(`[AUTH] Fetching sessions for ${email}. Found in set: ${JSON.stringify(deviceIds)}`);

    for (const deviceId of deviceIds) {
      const session = await this.sessionService.getSession(deviceId);
      if (session) {
        sessions.push(session);
      } else {
        // Strict cleanup: Nếu ID có trong SET nhưng dữ liệu session đã hết hạn/mất, xóa khỏi SET luôn
        console.warn(`[AUTH] Cleaning up ghost session for ${deviceId}`);
        await this.sessionService.removeSession(email, deviceId);
      }
    }

    // Trả về danh sách đã sắp xếp: Mới nhất lên đầu
    const sorted = sessions.sort((a, b) => {
      const timeA = new Date(a.loginAt || a.lastActiveAt).getTime();
      const timeB = new Date(b.loginAt || b.lastActiveAt).getTime();
      return timeB - timeA;
    });

    return { sessions: sorted };
  }

  async resendOtp(email: string, type: 'register' | 'forgot_password') {
    const code = await this.otpService.createOtp(email, type);
    await this.emailService.sendOtp(email, code, type);
    return { message: 'Đã gửi lại mã OTP mới.' };
  }

  async verifyOtpGeneric(email: string, otp: string) {
    await this.otpService.verifyOtp(email, otp);
    return { message: 'Xác thực mã OTP thành công.' };
  }

  async refreshToken(email: string) {
    const payload = { sub: email, email };
    return {
      accessToken: this.jwtService.sign(payload)
    };
  }

  async testEmail(email: string) {
    await this.emailService.sendMail(
      email,
      'ZaloEdu - Test Email Configuration',
      '<h1>Cấu hình Email thành công!</h1><p>Bạn nhận được thư này tức là hệ thống SMTP đã hoạt động tốt.</p>'
    );
    return { message: 'Đã gửi email test thành công.' };
  }
}
