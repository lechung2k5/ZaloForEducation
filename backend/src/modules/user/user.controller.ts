import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Patch,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  constructor(private readonly userService: UserService) {}

  // ─── Profile ──────────────────────────────────────────────────────────────

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req) {
    return this.userService.getUserProfile(req.user.email);
  }

  @Put('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Req() req, @Body() body: any) {
    return this.userService.updateUserProfile(req.user.email, body);
  }

  @Post('push-token')
  @UseGuards(JwtAuthGuard)
  async registerPushToken(@Req() req, @Body() body: any) {
    return this.userService.registerPushToken(req.user.email, body);
  }

  @Delete('push-token')
  @UseGuards(JwtAuthGuard)
  async unregisterPushToken(@Req() req, @Body() body: any) {
    return this.userService.unregisterPushToken(req.user.email, body);
  }

  // ─── Avatar — chỉ cho phép upload qua S3, không nhận URL tùy ý ───────────

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Req() req) {
    return this.userService.listNotifications(req.user.email);
  }

  @Patch('notifications/read-all')
  @UseGuards(JwtAuthGuard)
  async markNotificationsRead(@Req() req) {
    return this.userService.markAllNotificationsRead(req.user.email);
  }

  @Post('avatar/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Req() req, @UploadedFile() file: any) {
    this.logger.log(`[UserController.uploadAvatar] Incoming request from ${req.user?.email}`);
    this.logger.log(`[UserController.uploadAvatar] Headers: ${JSON.stringify(req.headers)}`);
    this.logger.log(`[UserController.uploadAvatar] File: ${file ? file.originalname : 'UNDEFINED'}`);

    return this.userService.uploadAvatar(req.user.email, file);
  }

  // ─── Background ───────────────────────────────────────────────────────────

  @Post('background/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBackground(@Req() req, @UploadedFile() file: any) {
    return this.userService.uploadBackground(req.user.email, file);
  }
}
