import { Injectable, NotFoundException } from '@nestjs/common';
import { newId } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { RegisterDeviceDto } from './dto/devices.schemas';

/** Cihaz kayit/listeleme. Lisansta cihaz limiti yok ama cihazlar kaydedilir (SYSTEM_ANALYSIS §8). */
@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  // Ayni fingerprint tekrar gelirse lastSeenAt tazelenir (idempotent kayit).
  async register(user: AuthUser, dto: RegisterDeviceDto) {
    const now = new Date();
    const existing = await this.prisma.device.findFirst({
      where: { branchId: user.branchId, fingerprintHash: dto.fingerprintHash, deletedAt: null },
    });
    if (existing) {
      return this.prisma.device.update({
        where: { id: existing.id },
        data: {
          name: dto.name,
          platform: dto.platform ?? existing.platform,
          lastSeenAt: now,
          version: { increment: 1 },
          syncState: 'pending',
        },
      });
    }
    return this.prisma.device.create({
      data: {
        id: newId(),
        branchId: user.branchId,
        name: dto.name,
        fingerprintHash: dto.fingerprintHash,
        platform: dto.platform ?? null,
        firstSeenAt: now,
        lastSeenAt: now,
      },
    });
  }

  list(user: AuthUser) {
    return this.prisma.device.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async setTrust(user: AuthUser, id: string, isTrusted: boolean) {
    await this.deviceOrThrow(user.branchId, id);
    return this.prisma.device.update({
      where: { id },
      data: { isTrusted, version: { increment: 1 }, syncState: 'pending' },
    });
  }

  async remove(user: AuthUser, id: string) {
    await this.deviceOrThrow(user.branchId, id);
    await this.prisma.device.update({
      where: { id },
      data: { deletedAt: new Date(), version: { increment: 1 }, syncState: 'pending' },
    });
    return { success: true };
  }

  private async deviceOrThrow(branchId: string, id: string) {
    const row = await this.prisma.device.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!row)
      throw new NotFoundException({ code: 'DEVICE_NOT_FOUND', message: 'Cihaz bulunamadi.' });
    return row;
  }
}
