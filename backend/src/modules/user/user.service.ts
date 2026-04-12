import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { S3Service } from '../../infrastructure/s3.service';

// ─── Helpers: Date format DD-MM-YYYY ──────────────────────────────────────────

/**
 * Chuyển chuỗi ngày từ bất kỳ định dạng nào sang DD-MM-YYYY để lưu vào DynamoDB.
 * Chấp nhận: YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY.
 * Trả về chuỗi rỗng nếu không hợp lệ.
 */
function toStorageDate(raw: string | undefined): string {
  if (!raw || typeof raw !== 'string') return '';
  const s = raw.trim();

  // Đã đúng định dạng DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(s)) return s;

  // Định dạng YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [year, month, day] = s.split('-');
    return `${day}-${month}-${year}`;
  }

  // Định dạng DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    return s.replace(/\//g, '-');
  }

  return '';
}

// ─── Types ────────────────────────────────────────────────────────────────────

type UpdateProfileInput = {
  fullName?: string;
  gender?: boolean;
  dataOfBirth?: string;
  phone?: string;
  address?: string;
  bio?: string;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly db: DynamoDBService,
  ) {}

  // ── Private helpers ─────────────────────────────────────────────────────────

  private async getUserRecord(email: string): Promise<Record<string, any> | undefined> {
    const result = await this.db.docClient.send(
      new GetCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: 'METADATA' },
      }),
    );
    return result.Item as Record<string, any> | undefined;
  }

  /**
   * Chuẩn hóa record thô thành UserProfile.
   * - Chỉ dùng `fullName` (bỏ `fullname`).
   * - Chỉ dùng `avatarUrl` (bỏ `urlAvatar`).
   * - Chỉ dùng `backgroundUrl` (bỏ `urlBackground`).
   */
  private normalizeProfile(record: Record<string, any>) {
    const fullName = record.fullName || '';
    const avatarUrl = record.avatarUrl || '';
    const backgroundUrl = record.backgroundUrl || '';

    return {
      email: record.email ?? '',
      fullName,
      gender: record.gender ?? true,
      dataOfBirth: record.dataOfBirth ?? '',
      phone: record.phone ?? '',
      address: record.address ?? '',
      bio: record.bio ?? '',
      avatarUrl,
      backgroundUrl,
      createdAt: record.createdAt ?? '',
      updatedAt: record.updatedAt ?? '',
    };
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async getUserProfile(email: string) {
    const record = await this.getUserRecord(email);
    if (!record) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng.');
    }
    return { profile: this.normalizeProfile(record) };
  }

  async updateUserProfile(email: string, input: UpdateProfileInput) {
    const existingUser = await this.getUserRecord(email);
    if (!existingUser) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng.');
    }

    // Chuẩn hóa input
    const normalizedInput = {
      fullName:    typeof input.fullName    === 'string' ? input.fullName.trim()    : undefined,
      gender:      input.gender,
      dataOfBirth: toStorageDate(input.dataOfBirth),   // luôn lưu DD-MM-YYYY
      phone:       typeof input.phone       === 'string' ? input.phone.trim()       : undefined,
      address:     typeof input.address     === 'string' ? input.address.trim()     : undefined,
      bio:         typeof input.bio         === 'string' ? input.bio.trim()         : undefined,
    };

    const updateEntries = Object.entries(normalizedInput).filter(
      ([, value]) => value !== undefined && value !== '',
    );

    if (updateEntries.length === 0) {
      return this.getUserProfile(email);
    }

    const updateExpression: string[] = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = { '#updatedAt': 'updatedAt' };
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': new Date().toISOString(),
    };

    for (const [key, value] of updateEntries) {
      const nameKey = `#${key}`;
      updateExpression.push(`${nameKey} = :${key}`);
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[`:${key}`] = value;
    }

    try {
      await this.db.docClient.send(
        new UpdateCommand({
          TableName: this.db.tableName,
          Key: { PK: `USER#${email}`, SK: 'METADATA' },
          UpdateExpression: `SET ${updateExpression.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
        }),
      );
    } catch (error) {
      console.error('[UserService.updateUserProfile] Failed to update profile', {
        email,
        input: normalizedInput,
        error,
      });
      throw error;
    }

    return this.getUserProfile(email);
  }

  /**
   * Upload avatar lên S3 rồi lưu URL vào DynamoDB.
   * Đây là cách DUY NHẤT để cập nhật avatar — không cho phép dán URL tùy ý.
   */
  async uploadAvatar(email: string, file: Express.Multer.File) {
    if (!file) {
      this.logger.warn(`Upload avatar failed: No file provided for ${email}`);
      throw new BadRequestException('Vui lòng chọn một ảnh đại diện hợp lệ.');
    }

    this.logger.log(`[UserService.uploadAvatar] Processing avatar for ${email}`, {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.buffer?.length ?? 0,
    });

    let imageUrl: string;
    try {
      imageUrl = await this.s3Service.uploadFile(file, 'avatars');
    } catch (error) {
      console.error('[UserService.uploadAvatar] S3 upload failed', { email, error });
      throw error;
    }

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: 'METADATA' },
        // Chỉ cập nhật avatarUrl — không ghi urlAvatar
        UpdateExpression: 'SET avatarUrl = :avatarUrl, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':avatarUrl': imageUrl,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );

    const { profile } = await this.getUserProfile(email);
    return { message: 'Avatar updated successfully', profile };
  }

  /**
   * Upload ảnh nền lên S3 rồi lưu URL vào DynamoDB.
   */
  async uploadBackground(email: string, file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn một ảnh nền hợp lệ.');
    }

    console.log('[UserService.uploadBackground] Uploading background', {
      email,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.buffer?.length ?? 0,
    });

    let imageUrl: string;
    try {
      imageUrl = await this.s3Service.uploadFile(file, 'backgrounds');
    } catch (error) {
      console.error('[UserService.uploadBackground] S3 upload failed', { email, error });
      throw error;
    }

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: 'METADATA' },
        // Chỉ cập nhật backgroundUrl — không ghi urlBackground
        UpdateExpression: 'SET backgroundUrl = :backgroundUrl, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':backgroundUrl': imageUrl,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );

    const { profile } = await this.getUserProfile(email);
    return { message: 'Background updated successfully', profile };
  }
}
