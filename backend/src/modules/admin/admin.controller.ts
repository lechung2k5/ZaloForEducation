import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  listUsers(@Query("search") search?: string) {
    return this.adminService.listUsers(search || "");
  }

  @Post("users")
  createUser(@Body() body: any) {
    return this.adminService.createUser(body);
  }

  @Patch("users/:email")
  updateUser(@Param("email") email: string, @Body() body: any) {
    return this.adminService.updateUser(decodeURIComponent(email), body);
  }

  @Patch("users/:email/lock")
  lockUser(@Param("email") email: string) {
    return this.adminService.setUserLock(decodeURIComponent(email), true);
  }

  @Patch("users/:email/unlock")
  unlockUser(@Param("email") email: string) {
    return this.adminService.setUserLock(decodeURIComponent(email), false);
  }

  @Delete("users/:email")
  deleteUser(@Param("email") email: string) {
    return this.adminService.deleteUser(decodeURIComponent(email));
  }

  @Post("notifications")
  createNotification(@Req() req, @Body() body: any) {
    return this.adminService.createNotification(req.user.email, body);
  }

  @Get("notifications")
  listNotifications() {
    return this.adminService.listNotifications();
  }

  @Get("statistics")
  getStatistics() {
    return this.adminService.getStatistics();
  }
}
