import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(); // Cho phép React Native và Web kết nối
  await app.listen(3000);
  console.log('ZaloEdu Backend is running on: http://localhost:3000');
}
bootstrap();
