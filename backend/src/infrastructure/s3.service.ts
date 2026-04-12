import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Injectable()
export class S3Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-southeast-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async uploadFile(file: UploadedFile, folder: string = 'avatars'): Promise<string> {
    const bucketName = process.env.S3_BUCKET_NAME;
    const key = `${folder}/${randomUUID()}-${file.originalname}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        // ACL: 'public-read', // Tùy thuộc vào cấu hình bucket, có thể dùng policy thay thế
      })
    );

    const region = process.env.AWS_REGION || 'ap-southeast-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;
  }
}
