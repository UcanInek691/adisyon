import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { TokenService } from '../token.service';
import { PrismaService } from '../../prisma/prisma.service';

/** Bearer access token dogrular; req.user'i doldurur. @Public() ile atlanir. */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      throw new UnauthorizedException({
        code: 'NO_TOKEN',
        message: 'Kimlik dogrulama gerekli.',
      });
    }

    try {
      const payload = await this.tokens.verifyAccess(token);
      const session = await this.prisma.session.findFirst({
        where: {
          id: payload.sid,
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          user: {
            branchId: payload.branchId,
            isActive: true,
            deletedAt: null,
          },
        },
        select: { id: true },
      });
      if (!session) throw new Error('revoked session');
      const user: AuthUser = {
        userId: payload.sub,
        sessionId: payload.sid,
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
