import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AppConfigService } from '../config/app-config.service';

/** Access token icindeki iddialar (offline'da self-contained yetki icin perms gomulu). */
export interface AccessTokenPayload {
  sub: string;
  sid: string;
  username: string;
  role: string;
  branchId: string;
  deviceId?: string;
  perms: string[];
  typ: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  typ: 'refresh';
}

/** JWT imzalama/dogrulama. Access ve refresh ayri secret'larla. */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  signAccess(payload: Omit<AccessTokenPayload, 'typ'>, isWaiter: boolean): Promise<string> {
    return this.jwt.signAsync(
      { ...payload, typ: 'access' },
      {
        secret: this.config.accessSecret,
        expiresIn: isWaiter ? this.config.waiterAccessTtl : this.config.ownerAccessTtl,
      },
    );
  }

  signRefresh(payload: Omit<RefreshTokenPayload, 'typ'>): Promise<string> {
    return this.jwt.signAsync(
      { ...payload, typ: 'refresh' },
      { secret: this.config.refreshSecret, expiresIn: this.config.refreshTtl },
    );
  }

  verifyAccess(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, { secret: this.config.accessSecret });
  }

  verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, { secret: this.config.refreshSecret });
  }
}
