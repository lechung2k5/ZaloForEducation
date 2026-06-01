import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { RedisService } from "../../infrastructure/redis.service";

@Injectable()
export class AccessTrackingMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}

  async use(req: Request, _res: Response, next: NextFunction) {
    if (req.method !== "OPTIONS" && !req.path.startsWith("/admin/statistics")) {
      const today = new Date().toISOString().slice(0, 10);
      await this.redisService.incr("analytics:visits:total");
      await this.redisService.incr(`analytics:visits:${today}`);
    }
    next();
  }
}
