import { Injectable, BadRequestException, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import * as bcrypt from 'bcrypt';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { OtpService } from '../otp/otp.service';
import { EmailService } from '../../infrastructure/email/email.service';
import { SessionService } from './session.service';
import { ChatGateway } from '../chat/chat.gateway';
import { PutCommand, GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { RegisterRequestDto, LoginRequestDto, User } from '@zalo-edu/shared';
import { RedisService } from '../../infrastructure/redis.service';
import { validateDobStrict } from '../../infrastructure/utils/date.util';
import { DeviceService } from './device.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly db: DynamoDBService,
    private readonly sessionService: SessionService,
    private readonly deviceService: DeviceService,
    private readonly otpService: OtpService,
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
    @Inject(forwardRef(() => ChatGateway))
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
      dataOfBirth: validateDobStrict(dto.dataOfBirth),
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

    const deviceId = dto.deviceId || `unknown-${Date.now()}`;
    const platform = dto.platform || (dto.deviceType === 'web' ? 'web' : 'mobile');
    
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${dto.email}`, SK: 'METADATA' },
      UpdateExpression: 'SET currentDeviceId = :deviceId, lastLoginAt = :now',
      ExpressionAttributeValues: {
        ':deviceId': deviceId,
        ':now': new Date().toISOString(),
      },
    }));

    const activeSessions = await this.sessionService.getSessions(user.email);

    for (const oldId of activeSessions) {
      if (oldId === deviceId) continue;

      const oldSession = await this.sessionService.getSession(user.email, oldId);
      const oldPlatform = oldSession?.platform || 'mobile';

      if (oldPlatform !== platform) {
        continue;
      }
      
      await this.deviceService.markAsLoggedOut(user.email, oldId, {
        deviceName: oldSession?.deviceName,
        deviceType: oldSession?.deviceType,
      });

      await this.sessionService.removeSession(user.email, oldId);
      this.chatGateway.notifyForceLogout(user.email, oldId, 'Một thiết bị khác vừa đăng nhập và thay thế phiên làm việc này.');
    }

    const metadata = { deviceName: dto.deviceName, deviceType: dto.deviceType, platform };
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
        updatedAt: new Date().toISOString(),
        status: 'ACTIVE',
      },
    }));

    this.chatGateway.notifySessionsUpdate(user.email);

    const payload = { sub: user.email, email: user.email, deviceId: deviceId };
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        backgroundUrl: user.backgroundUrl || '',
        phone: user.phone,
        gender: user.gender,
        dataOfBirth: user.dataOfBirth,
        bio: user.bio,
      },
    };
  }

  async forgotPasswordRequestOtp(email: string) {
    const result = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!result.Item) {
      throw new BadRequestException('Email này chưa được đăng ký trong hệ thống.');
    }

    const code = await this.otpService.createOtp(email, 'forgot_password');
    await this.emailService.sendOtp(email, code, 'forgot_password');

    return { message: 'Mã OTP đã được gửi về Gmail của bạn. Vui lòng kiểm tra hộp thư.' };
  }

  async forgotPasswordVerifyOtp(email: string, otp: string) {
    const savedCode = await this.otpService.getOtp(email);

    if (!savedCode || savedCode !== otp) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
    }

    return { message: 'Xác thực OTP thành công. Vui lòng đặt mật khẩu mới.' };
  }

  async resetPassword(email: string, otp: string, newPassword: string) {
    this.validatePassword(newPassword);
    await this.otpService.verifyOtp(email, otp);

    const passwordHash = await bcrypt.hash(newPassword, 12);

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
    const session = await this.sessionService.getSession(email, deviceId);

    await this.sessionService.removeSession(email, deviceId);

    await this.deviceService.markAsLoggedOut(email, deviceId, {
      deviceName: session?.deviceName,
      deviceType: session?.deviceType,
    });

    this.chatGateway.notifyForceLogout(email, deviceId, 'Phiên đăng nhập đã kết thúc thành công.');
    this.chatGateway.notifySessionsUpdate(email);
    return { message: 'Đăng xuất thành công.' };
  }

  async logoutAll(email: string) {
    const activeDeviceIds = await this.sessionService.getSessions(email);
    for (const deviceId of activeDeviceIds) {
      const session = await this.sessionService.getSession(email, deviceId);
      await this.sessionService.removeSession(email, deviceId);
      await this.deviceService.markAsLoggedOut(email, deviceId, {
        deviceName: session?.deviceName,
        deviceType: session?.deviceType,
      });
    }

    this.chatGateway.notifyForceLogout(email, 'all', 'Tất cả các phiên đăng nhập đã bị đăng xuất định kỳ hoặc bởi người dùng.');
    this.chatGateway.notifySessionsUpdate(email);
    return { message: 'Đã đăng xuất khỏi tất cả các thiết bị.' };
  }

  async requestChangePassword(email: string, currentPassword: string, newPassword: string) {
    // 1. Lấy thông tin User
    const result = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    const user = result.Item as User;
    if (!user) throw new BadRequestException('Người dùng không tồn tại.');

    // 2. Kiểm tra mật khẩu hiện tại
    const isPasswordValid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new BadRequestException('Mật khẩu hiện tại không chính xác.');
    }

    // 3. Kiểm tra mật khẩu mới
    if (currentPassword === newPassword) {
      throw new BadRequestException('Mật khẩu mới không được trùng với mật khẩu cũ.');
    }
    this.validatePassword(newPassword);

    // 4. Hash mật khẩu mới và lưu vào Redis (TTL 5p giống OTP)
    const nextHash = await bcrypt.hash(newPassword, 12);
    await this.redisService.set(`CHANGE_PASS_PENDING#${email}`, nextHash, 300);

    // 5. Tạo OTP
    const code = await this.otpService.createOtp(email, 'change_password');
    await this.emailService.sendOtp(email, code, 'change_password');

    return { message: 'Mã xác thực đã được gửi về email của bạn.' };
  }

  async confirmChangePassword(email: string, otp: string) {
    // 1. Xác thực OTP
    await this.otpService.verifyOtp(email, otp);

    // 2. Lấy mật khẩu mới từ Redis
    const nextHash = await this.redisService.get(`CHANGE_PASS_PENDING#${email}`);
    if (!nextHash) {
      throw new BadRequestException('Yêu cầu đổi mật khẩu đã hết hạn. Vui lòng thực hiện lại.');
    }

    // 3. Cập nhật DynamoDB
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET passwordHash = :hash, updatedAt = :now',
      ExpressionAttributeValues: {
        ':hash': nextHash,
        ':now': new Date().toISOString(),
      },
    }));

    // 4. Cleanup Redis
    await this.redisService.del(`CHANGE_PASS_PENDING#${email}`);

    // 5. Đăng xuất toàn bộ thiết bị (Supreme Security)
    await this.logoutAll(email);

    return { message: 'Đổi mật khẩu thành công! Tất cả thiết bị đã được đăng xuất để bảo mật.' };
  }

  async getActiveSessions(email: string) {
    const deviceIds = await this.sessionService.getSessions(email);
    const sessions = [];

    for (const deviceId of deviceIds) {
      const session = await this.sessionService.getSession(email, deviceId);
      if (session) {
        sessions.push(session);
      } else {
        await this.sessionService.removeSession(email, deviceId);
      }
    }

    // 2. Lấy lịch sử đăng xuất từ DeviceService
    const loginHistory = await this.deviceService.getLoginHistory(email);

    const sorted = sessions.sort((a, b) => {
      const timeA = new Date(a.loginAt || a.lastActiveAt).getTime();
      const timeB = new Date(b.loginAt || b.lastActiveAt).getTime();
      return timeB - timeA;
    });

    return {
      activeDevices: sorted,
      loginHistory
    };
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

  async refreshToken(email: string, deviceId: string) {
    const session = await this.sessionService.getSession(email, deviceId);

    if (!session) {
      throw new UnauthorizedException('SESSION_INVALIDATED');
    }

    const payload = { sub: email, email, deviceId };
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

  // ===== QR LOGIN LOGIC =====

  async generateQrCodeId() {
    const qrCodeId = uuidv4();
    const redisKey = `qr_login:${qrCodeId}`;
    await this.redisService.set(redisKey, 'PENDING', 300); // 5 mins
    return { qrCodeId };
  }

  async confirmQrCode(email: string, qrCodeId: string) {
    const redisKey = `qr_login:${qrCodeId}`;
    const status = await this.redisService.get(redisKey);

    if (!status) {
      throw new BadRequestException('Mã QR đã hết hạn hoặc không tồn tại.');
    }

    if (status !== 'PENDING') {
      throw new BadRequestException('Mã QR này đã được sử dụng.');
    }

    // 1. Lấy thông tin User
    const result = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    const user = result.Item as User;
    if (!user) {
      throw new BadRequestException('Người dùng không tồn tại.');
    }

    // 2. Tạo phiên làm việc Web mới
    const deviceId = `web-${uuidv4().split('-')[0]}`;
    const platform = 'web';
    const metadata = {
      deviceName: 'Web Browser (QR Login)',
      deviceType: 'web',
      platform
    };

    // 3. Tạo session mới TRƯỚC để web có token hợp lệ
    await this.sessionService.createSession(user.email, deviceId, metadata);

    // Sau đó mới kick session cũ cùng platform
    // Thứ tự này quan trọng: web phải nhận login_success trước force_logout
    const activeSessions = await this.sessionService.getSessions(email);
    for (const oldId of activeSessions) {
      if (oldId === deviceId) continue; // Bỏ qua session vừa tạo

      const oldSession = await this.sessionService.getSession(email, oldId);
      if (oldSession?.platform === 'web') {
        console.log(`[QR] Kicking old web session: ${oldId}`);
        await this.sessionService.removeSession(email, oldId);
        // Delay 2s để web kịp nhận login_success và lưu token
        // trước khi nhận force_logout từ session cũ
        setTimeout(() => {
          this.chatGateway.notifyForceLogout(email, oldId);
        }, 2000);
      }
    }

    // 4. Lưu vào DynamoDB
    await this.db.docClient.send(new PutCommand({
      TableName: this.db.tableName,
      Item: {
        PK: `USER#${user.email}`,
        SK: `DEVICE#${deviceId}`,
        email: user.email,
        deviceId,
        deviceName: metadata.deviceName,
        deviceType: metadata.deviceType,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'ACTIVE',
      },
    }));

    // 5. Tạo Tokens
    const payload = { sub: user.email, email: user.email, deviceId: deviceId };
    const tokens = {
      accessToken: this.jwtService.sign(payload),
      user: {
        email: user.email,
        fullName: user.fullName,
        avatarUrl: user.avatarUrl,
        backgroundUrl: user.backgroundUrl || '',
        phone: user.phone,
      },
    };

    // 6. Thông báo cho Web qua Socket
    this.chatGateway.server.to(qrCodeId).emit('login_success', tokens);
    this.chatGateway.notifySessionsUpdate(email);

    // 7. Vô hiệu hóa mã QR ngay lập tức
    await this.redisService.del(redisKey);

    return { message: 'Đăng nhập thành công trên trình duyệt.' };
  }
}
