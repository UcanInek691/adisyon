import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../../common/decorators/permissions.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';

/** @RequirePermissions(...) ile istenen izinleri req.user.permissions'a gore denetler. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const granted = req.user?.permissions ?? [];
    const ok = required.every((p) => granted.includes(p));
    if (!ok) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Bu islem icin yetkiniz yok.',
      });
    }
    return true;
  }
}
