import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ChatModule } from "../chat/chat.module";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { AccessTrackingMiddleware } from "./access-tracking.middleware";

@Module({
  imports: [AuthModule, ChatModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AccessTrackingMiddleware],
})
export class AdminModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AccessTrackingMiddleware).forRoutes("*");
  }
}
