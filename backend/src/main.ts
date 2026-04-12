import { NestFactory } from '@nestjs/core';
import 'reflect-metadata';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = Number(process.env.PORT) || 3000;

  try {
    await app.listen(port, '0.0.0.0');
    console.log(`\x1b[32m[ZaloEdu] Backend is running on: http://localhost:${port}\x1b[0m`);
    console.log(`\x1b[33m[ZaloEdu] External access (Mobile): http://192.168.4.13:${port}\x1b[0m`);
  } catch (err: any) {
    console.error(`\x1b[31m[ZaloEdu] Failed to start server on port ${port}: ${err.message}\x1b[0m`);
    console.error(`\x1b[33mTip: run "npm run kill-port -w backend" and start again.\x1b[0m`);
    process.exit(1);
  }
}
bootstrap();
