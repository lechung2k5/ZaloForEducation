import { Body, Controller, Get, Post, Put, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UserService } from './user.service';

type UploadedFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
};

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

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

  @Post('avatar/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@Req() req, @UploadedFile() file: UploadedFile) {
    return this.userService.uploadAvatar(req.user.email, file);
  }

  @Post('background/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadBackground(@Req() req, @UploadedFile() file: UploadedFile) {
    return this.userService.uploadBackground(req.user.email, file);
  }

  @Put('avatar')
  @UseGuards(JwtAuthGuard)
  async updateAvatar(@Req() req, @Body() body: any) {
    return this.userService.updateAvatar(req.user.email, body.imageUrl);
  }

  @Put('background')
  @UseGuards(JwtAuthGuard)
  async updateBackground(@Req() req, @Body() body: any) {
    return this.userService.updateBackground(req.user.email, body.imageUrl);
  }
}
