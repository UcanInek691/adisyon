import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { TokenService } from '../token.service';

/** Bearer access token dogrular; req.user'i doldurur. @Public() ile atlanir. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      throw new UnauthorizedException({
        code: 'NO_TOKEN',
        message: 'Kimlik dogrulama gerekli.',
      });
    }

    try {
      const payload = await this.tokens.verifyAccess(header.slice('Bearer '.length));
      const user: AuthUser = {
        userId: payload.sub,
        username: payload.username,
        role: payload.role,
        branchId: payload.branchId,
        permissions: payload.perms ?? [],
        ...(payload.deviceId ? { deviceId: payload.deviceId } : {}),
      };
      req.user = user;
      return true;
    } catch {
      throw new UnauthorizedException({
        code: 'INVALID_TOKEN',
        message: 'Gecersiz veya suresi dolmus oturum.',
      });
    }
  }
}
