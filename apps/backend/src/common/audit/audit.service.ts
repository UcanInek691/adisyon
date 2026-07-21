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

  // Denetim kaydi okuma (raporlar > kayit gecmisi). Salt-okuma; en yeni ustte.
  // Filtreler opsiyonel: entityType, action, userId, tarih araligi (from/to).
  // userId->displayName ayri sorguyla iliştirilir (AuditLog'da user iliskisi yok).
  async list(
    branchId: string,
    opts: {
      entityType?: string;
      action?: string;
      userId?: string;
      from?: string;
      to?: string;
      limit?: number;
    } = {},
  ) {
    const limit = Math.min(Math.max(opts.limit ?? 200, 1), 2000);
    const createdAt =
      opts.from || opts.to
        ? {
            ...(opts.from ? { gte: new Date(opts.from) } : {}),
            ...(opts.to ? { lte: new Date(opts.to) } : {}),
          }
        : undefined;
    const rows = await this.prisma.auditLog.findMany({
      where: {
        branchId,
        ...(opts.entityType ? { entityType: opts.entityType } : {}),
        ...(opts.action ? { action: opts.action } : {}),
        ...(opts.userId ? { userId: opts.userId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { id: 'desc' }, // ULID monotonic -> en yeni
      take: limit,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        userId: true,
        oldValue: true,
        newValue: true,
        reason: true,
        origin: true,
        createdAt: true,
      },
    });

    // userId -> displayName eslemesi (silinmis kullanici olabilir -> userId fallback).
    const userIds = [...new Set(rows.map((r) => r.userId).filter((v): v is string => !!v))];
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true },
        })
      : [];
    const nameById = new Map(users.map((u) => [u.id, u.displayName]));
    return rows.map((r) => ({
      ...r,
      userName: r.userId ? (nameById.get(r.userId) ?? r.userId) : null,
    }));
  }
}
