import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';

@Injectable()
export class ProfileCompleteGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // Nếu không có user hoặc token lỏng lẻo thì JwtAuthGuard đã chặn rồi.
    // Nếu có user và user có claim isPending = true, nghĩa là chưa xong profile.
    if (user && user.isPending === true) {
      // Cho phép một số route đặc biệt nếu cần (trong trường hợp apply Global)
      // Hiện tại ta sẽ apply thủ công hoặc check route tại đây.
      
      const allowedPaths = [
        '/users/profile',
        '/auth/google-complete/confirm',
        '/auth/google-complete/request-otp',
      ];
      
      const path = request.url;
      if (allowedPaths.some(p => path.startsWith(p))) {
        return true;
      }

      throw new ForbiddenException(
        'Vui lòng hoàn thiện hồ sơ để sử dụng tính năng này.'
      );
    }

    return true;
  }
}
