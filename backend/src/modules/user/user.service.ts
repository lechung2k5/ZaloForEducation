import { GetCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { S3Service } from '../../infrastructure/s3.service';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

type UpdateProfileInput = {
  fullName?: string;
  gender?: boolean;
  dataOfBirth?: string;
  phone?: string;
  address?: string;
  bio?: string;
};

type UserProfile = {
  email: string;
  fullName: string;
  fullname: string;
  gender?: boolean;
  dataOfBirth?: string;
  phone?: string;
  address?: string;
  bio?: string;
  avatarUrl?: string;
  urlAvatar?: string;
  backgroundUrl?: string;
  urlBackground?: string;
  createdAt?: string;
  updatedAt?: string;
};

@Injectable()
export class UserService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly db: DynamoDBService
  ) {}

  private async getUserRecord(email: string) {
    const result = await this.db.docClient.send(new GetCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
    }));

    return result.Item as Record<string, any> | undefined;
  }

  private normalizeProfile(record: Record<string, any>): UserProfile {
    const fullName = record.fullName || record.fullname || '';
    const avatarUrl = record.avatarUrl || record.urlAvatar || '';
    const backgroundUrl = record.backgroundUrl || record.urlBackground || '';

    return {
      email: record.email,
      fullName,
      fullname: fullName,
      gender: record.gender,
      dataOfBirth: record.dataOfBirth,
      phone: record.phone,
      address: record.address,
      bio: record.bio,
      avatarUrl,
      urlAvatar: avatarUrl,
      backgroundUrl,
      urlBackground: backgroundUrl,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

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

    const normalizedInput: UpdateProfileInput = {
      fullName: typeof input.fullName === 'string' ? input.fullName.trim() : input.fullName,
      gender: input.gender,
      dataOfBirth: typeof input.dataOfBirth === 'string' ? input.dataOfBirth.trim() : input.dataOfBirth,
      phone: typeof input.phone === 'string' ? input.phone.trim() : input.phone,
      address: typeof input.address === 'string' ? input.address.trim() : input.address,
      bio: typeof input.bio === 'string' ? input.bio.trim() : input.bio,
    };

    const updateEntries = Object.entries({
      fullName: normalizedInput.fullName,
      gender: normalizedInput.gender,
      dataOfBirth: normalizedInput.dataOfBirth,
      phone: normalizedInput.phone,
      address: normalizedInput.address,
      bio: normalizedInput.bio,
    }).filter(([, value]) => value !== undefined);

    if (updateEntries.length === 0) {
      return this.getUserProfile(email);
    }

    const updateExpression = ['#updatedAt = :updatedAt'];
    const expressionAttributeNames: Record<string, string> = {
      '#updatedAt': 'updatedAt',
    };
    const expressionAttributeValues: Record<string, any> = {
      ':updatedAt': new Date().toISOString(),
    };

    updateEntries.forEach(([key, value]) => {
      const nameKey = `#${key}`;
      updateExpression.push(`${nameKey} = :${key}`);
      expressionAttributeNames[nameKey] = key;
      expressionAttributeValues[`:${key}`] = value;
    });

    try {
      await this.db.docClient.send(new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: 'METADATA' },
        UpdateExpression: `SET ${updateExpression.join(', ')}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
        ConditionExpression: 'attribute_exists(PK) AND attribute_exists(SK)',
      }));
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

  async uploadAvatar(email: string, file: UploadedFile) {
    if (!file) {
      console.error('[UserService.uploadAvatar] Missing file in request', { email });
      throw new BadRequestException('Vui lòng chọn một ảnh đại diện hợp lệ.');
    }

    console.log('[UserService.uploadAvatar] Uploading avatar', {
      email,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.buffer?.length || 0,
    });

    let imageUrl: string;
    try {
      imageUrl = await this.s3Service.uploadFile(file);
    } catch (error) {
      console.error('[UserService.uploadAvatar] S3 upload failed', {
        email,
        originalname: file.originalname,
        mimetype: file.mimetype,
        error,
      });
      throw error;
    }

    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET urlAvatar = :avatarUrl, avatarUrl = :avatarUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':avatarUrl': imageUrl,
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return { message: 'Avatar updated successfully', ...await this.getUserProfile(email), avatarUrl: imageUrl };
  }

  async uploadBackground(email: string, file: UploadedFile) {
    if (!file) {
      console.error('[UserService.uploadBackground] Missing file in request', { email });
      throw new BadRequestException('Vui lòng chọn một ảnh nền hợp lệ.');
    }

    console.log('[UserService.uploadBackground] Uploading background', {
      email,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.buffer?.length || 0,
    });

    let imageUrl: string;
    try {
      imageUrl = await this.s3Service.uploadFile(file, 'backgrounds');
    } catch (error) {
      console.error('[UserService.uploadBackground] S3 upload failed', {
        email,
        originalname: file.originalname,
        mimetype: file.mimetype,
        error,
      });
      throw error;
    }

    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET urlBackground = :backgroundUrl, backgroundUrl = :backgroundUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':backgroundUrl': imageUrl,
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return { message: 'Background updated successfully', ...await this.getUserProfile(email), backgroundUrl: imageUrl };
  }

  async updateAvatar(email: string, imageUrl: string) {
    if (!imageUrl) {
      throw new BadRequestException('URL ảnh không hợp lệ.');
    }

    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET urlAvatar = :avatarUrl, avatarUrl = :avatarUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':avatarUrl': imageUrl,
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return { message: 'Avatar updated', ...await this.getUserProfile(email), avatarUrl: imageUrl };
  }

  async updateBackground(email: string, imageUrl: string) {
    if (!imageUrl) {
      throw new BadRequestException('URL ảnh nền không hợp lệ.');
    }

    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET urlBackground = :backgroundUrl, backgroundUrl = :backgroundUrl, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':backgroundUrl': imageUrl,
        ':updatedAt': new Date().toISOString(),
      },
    }));

    return { message: 'Background updated', ...await this.getUserProfile(email), backgroundUrl: imageUrl };
  }

  async deleteAccount(email: string) {
    const user = await this.getUserRecord(email);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    // Soft delete: set deletedAt timestamp and lock the account
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'SET deletedAt = :deletedAt, lockStatus = :lockStatus, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':deletedAt': new Date().toISOString(),
        ':lockStatus': 'locked',
        ':updatedAt': new Date().toISOString(),
      },
    }));

    console.log(`[UserService.deleteAccount] Account deleted (soft delete) for ${email}`);

    return { message: 'Tài khoản đã bị xóa thành công. Tất cả dữ liệu liên quan sẽ được xóa sau 30 ngày.' };
  }

  async reactivateAccount(email: string) {
    const user = await this.getUserRecord(email);
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản người dùng.');
    }

    if (!user.deletedAt) {
      throw new BadRequestException('Tài khoản này không bị xóa, không cần kích hoạt lại.');
    }

    // Reactivate: remove deletedAt and unlock
    await this.db.docClient.send(new UpdateCommand({
      TableName: this.db.tableName,
      Key: { PK: `USER#${email}`, SK: 'METADATA' },
      UpdateExpression: 'REMOVE deletedAt SET lockStatus = :lockStatus, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':lockStatus': 'active',
        ':updatedAt': new Date().toISOString(),
      },
    }));

    console.log(`[UserService.reactivateAccount] Account reactivated for ${email}`);

    return { message: 'Tài khoản đã được khôi phục thành công.' };
  }
}
