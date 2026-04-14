import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { LoginRequestDto, RegisterRequestDto, User } from '@zalo-edu/shared';
import * as bcrypt from 'bcrypt';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { EmailService } from '../../infrastructure/email/email.service';
import { ChatGateway } from '../chat/chat.gateway';
import { OtpService } from '../otp/otp.service';
import { SessionService } from './session.service';

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
    await this.otpService.verifyOtp(dto.email, dto.otp);
    const passwordHash = await bcrypt.hash(dto.password, 12);

    const newUser: User = {
      id: `USER#${dto.email}`,
      email: dto.email,
      fullName: dto.fullName || '',
      gender: dto.gender ?? true,
      dataOfBirth: dto.dataOfBirth || '',
      phone: dto.phone || '',
      passwordHash,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      status: 'active',
      lockStatus: 'active',
      lockedUntil: undefined,
      deletedAt: undefined,
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

    // Check if account is deleted
    if (user.deletedAt) {
      throw new UnauthorizedException('Tài khoản này đã bị xóa.');
    }

    // Check if account is locked
    if (user.lockStatus === 'locked') {
      return {
        locked: true,
        email: user.email,
        message: 'Tài khoản đang bị khóa. Vui lòng xác nhận OTP qua email để mở khóa.',
      };
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
    
    // Phân loại thiết bị đang đăng nhập
    const isIncomingApp = deviceId.startsWith('android-') || deviceId.startsWith('ios-') || dto.deviceType === 'mobile';
    const isIncomingWeb = deviceId.startsWith('web-') || dto.deviceType === 'desktop' || dto.deviceType === 'web';

    console.log(`[AUTH] Login detect: user=${user.email}, isApp=${isIncomingApp}, isWeb=${isIncomingWeb}, type=${dto.deviceType}`);

    for (const oldId of activeSessions) {
      if (oldId === deviceId) continue;

      // Lấy thông tin chi tiết của session cũ để phân loại chính xác
      const oldSession = await this.sessionService.getSession(oldId);
      if (!oldSession) continue;

      const isOldApp = oldId.startsWith('android-') || oldId.startsWith('ios-') || oldSession.deviceType === 'mobile';
      const isOldWeb = oldId.startsWith('web-') || oldSession.deviceType === 'desktop' || oldSession.deviceType === 'web';

      console.log(`[AUTH] Comparing with old session: ${oldId}, isOldApp=${isOldApp}, isOldWeb=${isOldWeb}`);

      if ((isIncomingApp && isOldApp) || (isIncomingWeb && isOldWeb)) {
        console.log(`[AUTH] Matches conflict rule. Kicking: ${oldId}`);
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
        fullname: user.fullName,
        avatarUrl: user.avatarUrl || user.urlAvatar || '',
        urlAvatar: user.urlAvatar || user.avatarUrl || '',
        backgroundUrl: user.backgroundUrl || user.urlBackground || '',
        urlBackground: user.urlBackground || user.backgroundUrl || '',
        gender: user.gender,
        dataOfBirth: user.dataOfBirth,
        phone: user.phone,
        address: user.address,
        bio: user.bio,
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

  // ===== ACCOUNT LOCK/UNLOCK =====

  /**
   * Lock an account until user confirms unlock OTP.
   */
  async lockAccount(email: string, reason: string = 'Yêu cầu từ người dùng') {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET lockStatus = :lockStatus, lockReason = :reason REMOVE lockedUntil',
      ExpressionAttributeValues: {
        ':lockStatus': 'locked',
        ':reason': reason,
      },
    }));

    // Logout all sessions
    await this.logoutAll(email);

    console.log(`[AUTH] Account locked for ${email}`);

    return {
      message: `Tài khoản đã được khóa thành công do ${reason}.`,
    };
  }

  async requestLockOtp(email: string) {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    const userRecord = user.Item as User;
    if (userRecord.lockStatus === 'locked') {
      throw new BadRequestException('Tài khoản hiện đang bị khóa.');
    }

    const code = await this.otpService.createOtp(email, 'lock_account');
    const emailSent = await this.emailService.sendOtp(email, code, 'lock_account');

    if (!emailSent) {
      throw new BadRequestException('Không thể gửi email xác nhận lúc này. Vui lòng thử lại sau.');
    }

    return { message: 'Mã OTP khóa tài khoản đã được gửi về email của bạn.' };
  }

  async confirmLockOtp(email: string, otp: string, reason: string = 'Yêu cầu từ người dùng') {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    const userRecord = user.Item as User;
    if (userRecord.lockStatus === 'locked') {
      throw new BadRequestException('Tài khoản hiện đang bị khóa.');
    }

    await this.otpService.verifyOtp(email, otp);
    return this.lockAccount(email, reason);
  }

  /**
   * Unlock an account
   * @param email User email
   */
  async unlockAccount(email: string) {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET lockStatus = :lockStatus REMOVE lockedUntil, lockReason',
      ExpressionAttributeValues: {
        ':lockStatus': 'active',
      },
    }));

    console.log(`[AUTH] Account unlocked for ${email}`);

    return { message: 'Tài khoản đã được mở khóa thành công.' };
  }

  /**
   * Delete account (soft delete)
   * @param email User email
   */
  async deleteAccount(email: string) {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    // Soft delete: set deletedAt timestamp
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET deletedAt = :deletedAt, lockStatus = :lockStatus',
      ExpressionAttributeValues: {
        ':deletedAt': new Date().toISOString(),
        ':lockStatus': 'locked',
      },
    }));

    // Logout all sessions
    await this.logoutAll(email);

    console.log(`[AUTH] Account deleted (soft delete) for ${email}`);

    return { message: 'Tài khoản đã bị xóa. Tất cả phiên đăng nhập đã được hủy.' };
  }

  // ===== UNLOCK ACCOUNT WITH OTP =====

  /**
   * Request OTP to unlock a locked account
   * @param email User email
   */
  async requestUnlockOtp(email: string) {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    const userRecord = user.Item as User;

    // Check if account is actually locked
    if (userRecord.lockStatus !== 'locked') {
      throw new BadRequestException('Tài khoản không bị khóa.');
    }

    // Create OTP for account unlock
    const code = await this.otpService.createOtp(email, 'unlock_account');

    // Send OTP via email
    const emailSent = await this.emailService.sendOtp(email, code, 'unlock_account');

    if (!emailSent) {
      throw new BadRequestException('Không thể gửi email xác nhận lúc này. Vui lòng thử lại sau.');
    }

    console.log(`[AUTH] Unlock OTP sent to ${email}`);

    return {
      message: 'Mã OTP xác nhận đã được gửi về email của bạn. Vui lòng kiểm tra hộp thư.',
      email: email,
    };
  }

  /**
   * Confirm unlock with OTP
   * @param email User email
   * @param otp OTP code
   */
  async confirmUnlockOtp(email: string, otp: string) {
    const user = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    if (!user.Item) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    const userRecord = user.Item as User;

    // Check if account is actually locked
    if (userRecord.lockStatus !== 'locked') {
      throw new BadRequestException('Tài khoản không bị khóa.');
    }

    try {
      await this.otpService.verifyOtp(email, otp);
    } catch (error) {
      throw new BadRequestException('Mã OTP không chính xác hoặc đã hết hạn.');
    }

    // Unlock the account
    await this.unlockAccount(email);

    console.log(`[AUTH] Account unlocked for ${email} via OTP`);

    return {
      message: 'Tài khoản đã được mở khóa thành công! Bạn có thể đăng nhập lại ngay bây giờ.',
      email: email,
    };
  }
}
