import { Injectable } from '@nestjs/common';
import { S3Service } from '../../infrastructure/s3.service';
import { DynamoDBService } from '../../infrastructure/dynamodb.service';
import { UpdateCommand } from '@aws-sdk/lib-dynamodb';

@Injectable()
export class UserService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly db: DynamoDBService
  ) {}

  async getUserProfile() {
    // Mock for now, but in real app you'd get from DB using current user ID
    return {
      fullname: 'Student Name',
      email: 'student.name@university.edu',
      avatarUrl: 'https://i.pravatar.cc/150',
    };
  }

  async uploadAvatar(file: Express.Multer.File) {
    const imageUrl = await this.s3Service.uploadFile(file);
    // In real app, you would associate this with the logged-in user ID
    return { message: 'Avatar uploaded successfully', avatarUrl: imageUrl };
  }

  async updateAvatar(imageUrl: string) {
    // Logic to update user record in DynamoDB (example PK)
    // await this.db.docClient.send(new UpdateCommand({ ... }));
    return { message: 'Avatar updated', avatarUrl: imageUrl };
  }
}
