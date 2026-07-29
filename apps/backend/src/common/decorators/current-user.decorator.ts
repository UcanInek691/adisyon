import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Access token'dan cozulmus, istek boyunca gecerli kimlik. */
export interface AuthUser {
  userId: string;
  sessionId: string;
  username: string;
  role: string;
  branchId: string;
  deviceId?: string;
  permissions: string[];
}

/** Controller'da mevcut kullaniciyi enjekte eder: `@CurrentUser() user: AuthUser`. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    return req.user;
  },
);
