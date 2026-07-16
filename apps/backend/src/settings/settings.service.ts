import { Injectable } from '@nestjs/common';
import { newId } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

/** Uygulama ayarlari (branch bazli key-value, value = JSON). */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(user: AuthUser) {
    const rows = await this.prisma.applicationSetting.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { key: 'asc' },
    });
    return rows.map((r) => ({ key: r.key, value: JSON.parse(r.value), updatedAt: r.updatedAt }));
  }

  async set(user: AuthUser, key: string, value: unknown) {
    const serialized = JSON.stringify(value ?? null);
    const existing = await this.prisma.applicationSetting.findUnique({
      where: { branchId_key: { branchId: user.branchId, key } },
    });
    if (existing) {
      return this.prisma.applicationSetting.update({
        where: { id: existing.id },
        data: {
          value: serialized,
          updatedBy: user.userId,
          version: { increment: 1 },
          syncState: 'pending',
        },
      });
    }
    return this.prisma.applicationSetting.create({
      data: {
        id: newId(),
        branchId: user.branchId,
        key,
        value: serialized,
        updatedBy: user.userId,
        deviceId: user.deviceId ?? null,
      },
    });
  }
}
