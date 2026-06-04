import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

export type EncryptedTextPayload = {
  alg: 'aes-256-gcm';
  v: 1;
  iv: string;
  tag: string;
  data: string;
};

@Injectable()
export class MessageEncryptionService {
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret =
      this.configService.get<string>('MESSAGE_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      'UniChat_message_encryption_fallback';

    this.key = createHash('sha256').update(secret).digest();
  }

  encryptText(value: unknown): EncryptedTextPayload | null {
    if (typeof value !== 'string' || value.length === 0) return null;

    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      alg: 'aes-256-gcm',
      v: 1,
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
      data: data.toString('base64'),
    };
  }

  decryptText(payload: unknown): string | null {
    const encrypted = payload as Partial<EncryptedTextPayload> | null;
    if (
      !encrypted ||
      encrypted.alg !== 'aes-256-gcm' ||
      encrypted.v !== 1 ||
      !encrypted.iv ||
      !encrypted.tag ||
      !encrypted.data
    ) {
      return null;
    }

    try {
      const decipher = createDecipheriv(
        'aes-256-gcm',
        this.key,
        Buffer.from(encrypted.iv, 'base64'),
      );
      decipher.setAuthTag(Buffer.from(encrypted.tag, 'base64'));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encrypted.data, 'base64')),
        decipher.final(),
      ]);
      return decrypted.toString('utf8');
    } catch {
      return null;
    }
  }
}
