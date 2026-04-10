import { Controller, Get, Put, Body, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserService } from './user.service';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('profile')
  async getProfile() {
    return this.userService.getUserProfile();
  }

  @Post('avatar/upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    return this.userService.uploadAvatar(file);
  }

  @Put('avatar')
  async updateAvatar(@Body() body: any) {
    return this.userService.updateAvatar(body.imageUrl);
  }
}
