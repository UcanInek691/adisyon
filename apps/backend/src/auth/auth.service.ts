import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { newId, SystemRole } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppConfigService } from '../config/app-config.service';
import { parseDurationMs } from '../common/util/duration';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { TokenService } from './token.service';
import type { LoginDto, LoginPinDto, RefreshDto } from './dto/auth.schemas';

/** Istek ust verisi (oturum kaydi icin). */
export interface RequestMeta {
  ip?: string;
  userAgent?: string;
}

/** Login/refresh yaniti (istemciye donen). */
export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    username: string;
    displayName: string;
    role: string;
    branchId: string;
  };
  permissions: string[];
}

const userWithRole = {
  role: { include: { rolePermissions: { include: { permission: true } } } },
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly config: AppConfigService,
  ) {}

  // --- Owner: kullanici adi + sifre ------------------------------------------
  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findFirst({
      where: { username: dto.username, deletedAt: null },
      include: userWithRole,
    });

    if (!user || !user.isActive || !user.passwordHash) {
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Kullanici adi veya sifre hatali.',
      });
    }
    this.assertNotLocked(user.lockedUntil);

    const ok = await argonVerify(user.passwordHash, dto.password);
    if (!ok) {
      await this.registerFailedLogin(user.id, user.failedLoginCount);
      throw new UnauthorizedException({
        code: 'INVALID_CREDENTIALS',
        message: 'Kullanici adi veya sifre hatali.',
      });
    }

    await this.registerSuccessfulLogin(user.id);
    return this.issue(user, undefined, meta);
  }

  // --- Waiter: PIN (+ deviceId) ----------------------------------------------
  async loginPin(dto: LoginPinDto, meta: RequestMeta): Promise<AuthResult> {
    const candidates = await this.prisma.user.findMany({
      where: { deletedAt: null, isActive: true, pinHash: { not: null } },
      include: userWithRole,
    });

    let matched: (typeof candidates)[number] | undefined;
    for (const candidate of candidates) {
      if (candidate.pinHash && (await argonVerify(candidate.pinHash, dto.pin))) {
        matched = candidate;
        break;
      }
    }

    if (!matched) {
      // Kaba-kuvveti yavaslatmak icin kucuk sabit gecikme.
      await new Promise((r) => setTimeout(r, 300));
      throw new UnauthorizedException({ code: 'INVALID_PIN', message: 'PIN hatali.' });
    }

    const deviceId = dto.deviceId
      ? await this.ensureDevice(dto.deviceId, matched.branchId, dto.deviceName)
      : undefined;

    await this.registerSuccessfulLogin(matched.id);
    return this.issue(matched, deviceId, meta);
  }

  // --- Access token yenileme -------------------------------------------------
  async refresh(dto: RefreshDto): Promise<{ accessToken: string }> {
    let payload: Awaited<ReturnType<TokenService['verifyRefresh']>>;
    try {
      payload = await this.tokens.verifyRefresh(dto.refreshToken);
    } catch {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Oturum gecersiz.' });
    }

    const session = await this.prisma.session.findUnique({ where: { id: payload.sid } });
    if (!session || session.revokedAt || session.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Oturum sonlanmis.' });
    }
    const valid = await argonVerify(session.refreshTokenHash, dto.refreshToken);
    if (!valid) {
      throw new UnauthorizedException({ code: 'INVALID_TOKEN', message: 'Oturum gecersiz.' });
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: userWithRole,
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException({ code: 'USER_INACTIVE', message: 'Kullanici pasif.' });
    }

    const perms = this.permsOf(user);
    const isWaiter = user.role.name === SystemRole.Waiter;
    const accessToken = await this.tokens.signAccess(
      {
        sub: user.id,
        username: user.username,
        role: user.role.name,
        branchId: user.branchId,
        perms,
        ...(session.sessionDeviceId ? { deviceId: session.sessionDeviceId } : {}),
      },
      isWaiter,
    );
    return { accessToken };
  }

  // --- Cikis: kullanicinin aktif oturumlarini iptal --------------------------
  async logout(user: AuthUser): Promise<{ revoked: number }> {
    const res = await this.prisma.session.updateMany({
      where: { userId: user.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { revoked: res.count };
  }

  // --- Mevcut kullanici + izinler --------------------------------------------
  async me(user: AuthUser): Promise<AuthResult['user'] & { permissions: string[] }> {
    const found = await this.prisma.user.findFirst({
      where: { id: user.userId, deletedAt: null },
      include: userWithRole,
    });
    if (!found) {
      throw new UnauthorizedException({ code: 'USER_NOT_FOUND', message: 'Kullanici bulunamadi.' });
    }
    return {
      id: found.id,
      username: found.username,
      displayName: found.displayName,
      role: found.role.name,
      branchId: found.branchId,
      permissions: this.permsOf(found),
    };
  }

  // --- Yardimcilar -----------------------------------------------------------
  private permsOf(user: { role: { rolePermissions: Array<{ permission: { key: string } }> } }): string[] {
    return user.role.rolePermissions.map((rp) => rp.permission.key);
  }

  private assertNotLocked(lockedUntil: Date | null): void {
    if (lockedUntil && lockedUntil.getTime() > Date.now()) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_LOCKED',
        message: 'Hesap gecici olarak kilitli. Lutfen sonra tekrar deneyin.',
      });
    }
  }

  private async registerFailedLogin(userId: string, currentCount: number): Promise<void> {
    const nextCount = currentCount + 1;
    const lock = nextCount >= this.config.failedLoginMax;
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLoginCount: nextCount,
        lockedUntil: lock ? new Date(Date.now() + this.config.lockMinutes * 60_000) : null,
      },
    });
    if (lock) this.logger.warn(`Hesap kilitlendi: ${userId}`);
  }

  private async registerSuccessfulLogin(userId: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
    });
  }

  private async ensureDevice(
    deviceId: string,
    branchId: string,
    name: string | undefined,
  ): Promise<string> {
    const existing = await this.prisma.device.findUnique({ where: { id: deviceId } });
    const now = new Date();
    if (existing) {
      await this.prisma.device.update({ where: { id: deviceId }, data: { lastSeenAt: now } });
    } else {
      await this.prisma.device.create({
        data: {
          id: deviceId,
          branchId,
          name: name ?? 'Waiter Tablet',
          fingerprintHash: '',
          platform: 'browser',
          firstSeenAt: now,
          lastSeenAt: now,
        },
      });
    }
    return deviceId;
  }

  /** Token'lari uretir ve oturum kaydini olusturur. */
  private async issue(
    user: {
      id: string;
      username: string;
      displayName: string;
      branchId: string;
      role: { name: string; rolePermissions: Array<{ permission: { key: string } }> };
    },
    deviceId: string | undefined,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const perms = this.permsOf(user);
    const isWaiter = user.role.name === SystemRole.Waiter;
    const sid = newId();

    const refreshToken = await this.tokens.signRefresh({ sub: user.id, sid });
    const refreshTokenHash = await argonHash(refreshToken);
    const now = new Date();
    await this.prisma.session.create({
      data: {
        id: sid,
        userId: user.id,
        refreshTokenHash,
        issuedAt: now,
        expiresAt: new Date(now.getTime() + parseDurationMs(this.config.refreshTtl)),
        ...(deviceId ? { sessionDeviceId: deviceId } : {}),
        ...(meta.ip ? { ip: meta.ip } : {}),
        ...(meta.userAgent ? { userAgent: meta.userAgent } : {}),
      },
    });

    const accessToken = await this.tokens.signAccess(
      {
        sub: user.id,
        username: user.username,
        role: user.role.name,
        branchId: user.branchId,
        perms,
        ...(deviceId ? { deviceId } : {}),
      },
      isWaiter,
    );

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role.name,
        branchId: user.branchId,
      },
      permissions: perms,
    };
  }
}
