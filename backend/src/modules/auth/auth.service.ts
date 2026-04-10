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
  ) {}

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

    // 1. Nếu đang có thiết bị khác đăng nhập, gửi tín hiệu logout cho nó
    if (user.currentDeviceId && user.currentDeviceId !== deviceId) {
      this.chatGateway.notifyForceLogout(user.email, deviceId);
    }

    // 2. Cập nhật deviceId mới vào User record
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${dto.email}`, SK: 'METADATA' },
      UpdateExpression: 'SET currentDeviceId = :deviceId, lastLoginAt = :now',
      ExpressionAttributeValues: {
        ':deviceId': deviceId,
        ':now': new Date().toISOString(),
      },
    }));

    // 3. Tạo Session quản lý trong DB
    await this.sessionService.createSession(user.email, deviceId);

    // 4. Trả về Token
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
}
