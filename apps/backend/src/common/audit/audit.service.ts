import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { newId } from '@ado/shared';
import { PrismaService } from '../../prisma/prisma.service';

const GENESIS_HASH = '0'.repeat(64);

export interface AuditEntry {
  branchId: string;
  action: string;
  entityType: string;
  entityId: string;
  userId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
  deviceId?: string;
  origin?: string; // AuditOrigin: online (vars.) | offline — OFFLINE_DESIGN.md §12
  clientOpId?: string; // offline replay'de iliskili mutasyon ULID
}

/**
 * Append-only, hash-zincirli denetim kaydi. Her kayit bir onceki kaydin
 * hash'ini icerir -> gecmise mudahale zinciri kirar. AUDIT_LOG.md / CONVENTIONS.md.
 * Not: tam imzali arsiv ve zincir dogrulama uclari ayri increment'te.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<string> {
    const oldValue = entry.oldValue === undefined ? null : JSON.stringify(entry.oldValue);
    const newValue = entry.newValue === undefined ? null : JSON.stringify(entry.newValue);

    return this.prisma.$transaction(async (tx) => {
      const last = await tx.auditLog.findFirst({
        where: { branchId: entry.branchId },
        orderBy: { id: 'desc' }, // ULID monotonic -> en son kayit
        select: { hash: true },
      });
      const prevHash = last?.hash ?? GENESIS_HASH;

      const id = newId();
      const createdAt = new Date();
      const payload = JSON.stringify([
        prevHash,
        id,
        entry.branchId,
        entry.userId ?? '',
        entry.action,
        entry.entityType,
        entry.entityId,
        oldValue ?? '',
        newValue ?? '',
        entry.reason ?? '',
        createdAt.toISOString(),
      ]);
      const hash = createHash('sha256').update(payload).digest('hex');

      await tx.auditLog.create({
        data: {
          id,
          branchId: entry.branchId,
          userId: entry.userId ?? null,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          oldValue,
          newValue,
          reason: entry.reason ?? null,
          prevHash,
          hash,
          createdAt,
          ...(entry.deviceId ? { deviceId: entry.deviceId } : {}),
          ...(entry.origin ? { origin: entry.origin } : {}),
          ...(entry.clientOpId ? { clientOpId: entry.clientOpId } : {}),
        },
      });
      return hash;
    });
  }
}
