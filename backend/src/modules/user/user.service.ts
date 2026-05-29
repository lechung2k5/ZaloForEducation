import { GetCommand, UpdateCommand, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException, forwardRef } from '@nestjs/common';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { S3Service } from '../../infrastructure/s3.service';
import { ChatGateway } from '../chat/chat.gateway';
import { validateDobStrict } from '../../infrastructure/utils/date.util';
import { RedisService } from '../../infrastructure/redis.service';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UpdateProfileInput = {
  fullName?: string;
  gender?: boolean;
  dataOfBirth?: string;
  phone?: string;
  address?: string;
  bio?: string;
  showOnlineStatus?: boolean;
};

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly s3Service: S3Service,
    private readonly db: DynamoDBService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
    private readonly redisService: RedisService,
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
   */
  private normalizeProfile(record: Record<string, any>) {
    const fullName = record.fullName || record.fullname || '';
    const avatarUrl = record.avatarUrl || record.urlAvatar || '';
    const backgroundUrl = record.backgroundUrl || record.urlBackground || '';

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
      status: record.status || 'offline',
      showOnlineStatus: record.showOnlineStatus ?? true,
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
    
    const profile = this.normalizeProfile(record);
    
    // Check real-time presence in Redis (Normalize email to lowercase)
    const normalizedEmail = email.toLowerCase();
    const presenceKey = `presence:${normalizedEmail}`;
    const isOnline = await this.redisService.get(presenceKey);
    
    console.log(`[UserService] Presence CHECK for ${normalizedEmail} -> ${isOnline}`);
    
    if (isOnline === 'online') {
      profile.status = 'online' as any;
    }

    return { profile };
  }

  async getUserByPhone(phone: string) {
    let cleanPhone = (phone || '').trim().replace(/[\s-()]/g, '');
    if (cleanPhone.startsWith('+84')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith('84') && cleanPhone.length > 9) {
      cleanPhone = '0' + cleanPhone.slice(2);
    }

    if (!cleanPhone) return null;

    const res = await this.db.docClient.send(
      new ScanCommand({
        TableName: this.db.tableName,
        FilterExpression: 'begins_with(PK, :userPrefix) AND SK = :sk AND phone = :phone',
        ExpressionAttributeValues: {
          ':userPrefix': 'USER#',
          ':sk': 'METADATA',
          ':phone': cleanPhone,
        },
      })
    );

    if (!res.Items || res.Items.length === 0) {
      return null;
    }

    const record = res.Items[0];
    const profile = this.normalizeProfile(record);
    
    // Check presence
    const presenceKey = `presence:${profile.email.toLowerCase()}`;
    const isOnline = await this.redisService.get(presenceKey);
    if (isOnline === 'online') {
      profile.status = 'online' as any;
    }
    
    return { profile };
  }

  async updateUserProfile(email: string, input: UpdateProfileInput) {
    this.logger.log(`[UserService.updateUserProfile] Updating profile for ${email}`);

    const existingUser = await this.getUserRecord(email);
    if (!existingUser) {
      throw new NotFoundException('Không tìm thấy thông tin người dùng.');
    }

    // Chuẩn hóa input
    const normalizedInput = {
      fullName:    typeof input.fullName    === 'string' ? input.fullName.trim()    : undefined,
      gender:      input.gender,
      dataOfBirth: input.dataOfBirth ? validateDobStrict(input.dataOfBirth) : undefined,
      phone:       typeof input.phone       === 'string' ? input.phone.trim()       : undefined,
      address:     typeof input.address     === 'string' ? input.address.trim()     : undefined,
      bio:         typeof input.bio         === 'string' ? input.bio.trim()         : undefined,
      showOnlineStatus: input.showOnlineStatus !== undefined ? input.showOnlineStatus : undefined,
    };

    const updateEntries = Object.entries(normalizedInput).filter(
      ([, value]) => value !== undefined && value !== '',
    );
    // Note: boolean 'false' should not be filtered out by `value !== ''`
    // but the filter uses `!== ''` so `false !== ''` is true, which is correct.

    if (updateEntries.length === 0) {
      this.logger.warn(`[UserService.updateUserProfile] No valid fields to update for ${email}`);
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
      this.logger.error(`[UserService.updateUserProfile] DB Update Failed for ${email}`, error.stack);
      throw error;
    }

    const profileData = await this.getUserProfile(email);
    this.chatGateway.notifyProfileUpdate(email, profileData.profile);
    
    // Handle presence side-effect
    if (input.showOnlineStatus !== undefined) {
      const normalizedEmail = email.toLowerCase();
      const presenceKey = `presence:${normalizedEmail}`;
      if (input.showOnlineStatus === false) {
        await this.redisService.del(presenceKey);
        this.chatGateway.server.emit('presence_update', { email: normalizedEmail, status: 'offline' });
      } else {
        await this.redisService.set(presenceKey, 'online', 3600);
        this.chatGateway.server.emit('presence_update', { email: normalizedEmail, status: 'online' });
      }
    }

    return profileData;
  }

  async uploadAvatar(email: string, file: any) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn một ảnh đại diện hợp lệ.');
    }

    let imageUrl: string;
    try {
      imageUrl = await this.s3Service.uploadFile(file, 'avatars');
    } catch (error) {
      this.logger.error('[UserService.uploadAvatar] S3 failed', error.stack);
      throw error;
    }

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: 'METADATA' },
        UpdateExpression: 'SET avatarUrl = :avatarUrl, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':avatarUrl': imageUrl,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );

    const { profile } = await this.getUserProfile(email);
    this.chatGateway.notifyProfileUpdate(email, profile);
    return { message: 'Avatar updated successfully', profile };
  }

  async uploadBackground(email: string, file: any) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn một ảnh nền hợp lệ.');
    }

    let imageUrl: string;
    try {
      imageUrl = await this.s3Service.uploadFile(file, 'backgrounds');
    } catch (error) {
      this.logger.error('[UserService.uploadBackground] S3 failed', error.stack);
      throw error;
    }

    await this.db.docClient.send(
      new UpdateCommand({
        TableName: this.db.tableName,
        Key: { PK: `USER#${email}`, SK: 'METADATA' },
        UpdateExpression: 'SET backgroundUrl = :backgroundUrl, updatedAt = :updatedAt',
        ExpressionAttributeValues: {
          ':backgroundUrl': imageUrl,
          ':updatedAt': new Date().toISOString(),
        },
      }),
    );

    const { profile } = await this.getUserProfile(email);
    this.chatGateway.notifyProfileUpdate(email, profile);
    return { message: 'Background updated successfully', profile };
  }
}
