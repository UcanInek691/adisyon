import { BadRequestException, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { newId, SystemRole } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { generateRecoveryCode, normalizeRecoveryCode } from './recovery.code';

const ENABLED_KEY = 'auth.recovery.enabled';
const HASH_KEY = 'auth.recovery.codeHash';

/**
 * "Sifremi unuttum" — cevrimdisi kasa icin kurtarma kodu yontemi.
 *
 * Akis: sahibi Ayarlar > Guvenlik'ten kod uretir, kagida yazar. Sifresini
 * unuttugunda giris ekraninda kodu + yeni sifreyi girer.
 *
 * KAPALI GELIR: `auth.recovery.enabled` ayari true degilse hem uc reddeder hem
 * de giris ekraninda baglanti gorunmez.
 *
 * Guvenlik notlari:
 *  - kodun yalnizca ARGON2 OZETI saklanir; duz metin bir kez gosterilir
 *  - kod TEK KULLANIMLIK: basarili sifirlamadan sonra ozet silinir
 *  - sifirlama tum oturumlari iptal eder (calinan kod ile acilan oturum kalmasin)
 *  - her uretim/sifirlama denetim kaydina yazilir
 */
@Injectable()
export class RecoveryService {
  private readonly logger = new Logger(RecoveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- ayar okuma/yazma (SettingsService AuthUser ister; burada sube id ile) ---
  private async readSetting(branchId: string, key: string): Promise<unknown> {
    const row = await this.prisma.applicationSetting.findUnique({
      where: { branchId_key: { branchId, key } },
    });
    if (!row || row.deletedAt) return undefined;
    try {
      return JSON.parse(row.value);
    } catch {
      return undefined;
    }
  }

  private async writeSetting(branchId: string, key: string, value: unknown): Promise<void> {
    const serialized = JSON.stringify(value ?? null);
    const existing = await this.prisma.applicationSetting.findUnique({
      where: { branchId_key: { branchId, key } },
    });
    if (existing) {
      await this.prisma.applicationSetting.update({
        where: { id: existing.id },
        data: { value: serialized, version: { increment: 1 }, syncState: 'pending' },
      });
      return;
    }
    await this.prisma.applicationSetting.create({
      data: { id: newId(), branchId, key, value: serialized },
    });
  }

  private async isEnabled(branchId: string): Promise<boolean> {
    return (await this.readSetting(branchId, ENABLED_KEY)) === true;
  }

  /**
   * Giris ekrani icin: "Sifremi unuttum" baglantisi gosterilsin mi.
   * Tek subeli kurulum -> ilk ayar satiri yeterli. Kimlik gerektirmez ama
   * yalnizca bir boolean sizdirir.
   */
  async publicStatus(): Promise<{ enabled: boolean }> {
    const row = await this.prisma.applicationSetting.findFirst({
      where: { key: ENABLED_KEY, deletedAt: null },
    });
    if (!row) return { enabled: false };
    try {
      return { enabled: JSON.parse(row.value) === true };
    } catch {
      return { enabled: false };
    }
  }

  /** Sahibi icin durum: acik mi, kod uretilmis mi. Kodun kendisi DONMEZ. */
  async status(user: AuthUser): Promise<{ enabled: boolean; hasCode: boolean }> {
    const stored = await this.readSetting(user.branchId, HASH_KEY);
    return {
      enabled: await this.isEnabled(user.branchId),
      hasCode: typeof stored === 'string' && stored !== '',
    };
  }

  /**
   * Yeni kurtarma kodu uretir; duz metni SADECE burada doner (bir daha
   * gosterilemez). Onceki kod gecersiz olur.
   */
  async generate(user: AuthUser): Promise<{ code: string }> {
    const code = generateRecoveryCode();
    const normalized = normalizeRecoveryCode(code);
    if (!normalized) throw new BadRequestException('Kurtarma kodu üretilemedi.');

    await this.writeSetting(user.branchId, HASH_KEY, await argonHash(normalized));
    await this.audit.record({
      branchId: user.branchId,
      action: 'auth.recovery.generate',
      entityType: 'setting',
      entityId: HASH_KEY,
      userId: user.userId,
      reason: 'Kurtarma kodu üretildi',
      ...(user.deviceId ? { deviceId: user.deviceId } : {}),
    });
    this.logger.warn(`Kurtarma kodu yeniden uretildi (kullanici=${user.userId}).`);
    return { code };
  }

  /** Kurtarma ozelligini ac/kapat (kapatinca kod da silinir). */
  async setEnabled(user: AuthUser, enabled: boolean): Promise<{ enabled: boolean }> {
    await this.writeSetting(user.branchId, ENABLED_KEY, enabled);
    if (!enabled) await this.writeSetting(user.branchId, HASH_KEY, null);
    await this.audit.record({
      branchId: user.branchId,
      action: 'auth.recovery.toggle',
      entityType: 'setting',
      entityId: ENABLED_KEY,
      userId: user.userId,
      newValue: { enabled },
      ...(user.deviceId ? { deviceId: user.deviceId } : {}),
    });
    return { enabled };
  }

  /**
   * Kurtarma kodu ile OWNER sifresini sifirlar. Kimlik dogrulamasi gerektirmez
   * (@Public) — bu yuzden her adim ayri ayri dogrulanir.
   */
  async resetPassword(username: string, code: string, newPassword: string): Promise<{ ok: true }> {
    // Ayni hata mesaji: kullanici adinin var olup olmadigi sizdirilmez.
    const fail = () =>
      new ForbiddenException({
        code: 'RECOVERY_FAILED',
        message: 'Kurtarma kodu veya kullanıcı adı hatalı.',
      });

    const normalized = normalizeRecoveryCode(code);
    if (!normalized) throw fail();

    const user = await this.prisma.user.findFirst({
      where: {
        username,
        deletedAt: null,
        isActive: true,
        role: { name: SystemRole.Owner, isSystem: true },
      },
    });
    if (!user) throw fail();
    if (!(await this.isEnabled(user.branchId))) {
      throw new ForbiddenException({
        code: 'RECOVERY_DISABLED',
        message: 'Şifre kurtarma bu kurulumda kapalı.',
      });
    }

    const codeSetting = await this.prisma.applicationSetting.findUnique({
      where: { branchId_key: { branchId: user.branchId, key: HASH_KEY } },
    });
    let stored: unknown;
    try {
      stored = codeSetting ? JSON.parse(codeSetting.value) : undefined;
    } catch {
      stored = undefined;
    }
    if (typeof stored !== 'string' || stored === '') throw fail();
    if (!(await argonVerify(stored, normalized))) throw fail();

    const passwordHash = await argonHash(newPassword);
    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.applicationSetting.updateMany({
        where: {
          id: codeSetting!.id,
          version: codeSetting!.version,
          value: codeSetting!.value,
          deletedAt: null,
        },
        data: { value: 'null', version: { increment: 1 }, syncState: 'pending' },
      });
      if (consumed.count !== 1) throw fail();
      await tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          failedLoginCount: 0,
          lockedUntil: null,
          version: { increment: 1 },
          syncState: 'pending',
        },
      });
      // Calinan kodla acilmis olabilecek oturumlar dahil hepsi kapatilir.
      await tx.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });

    await this.audit.record({
      branchId: user.branchId,
      action: 'auth.recovery.reset',
      entityType: 'user',
      entityId: user.id,
      userId: user.id,
      reason: 'Şifre kurtarma kodu ile sıfırlandı',
    });
    this.logger.warn(`Sifre kurtarma kodu ile sifirlandi: ${username}`);
    return { ok: true };
  }
}
