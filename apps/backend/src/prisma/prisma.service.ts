import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Prisma baglantisini Nest yasam dongusune baglar (connect/disconnect). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    await this.ensureSchema();
    this.logger.log('Prisma baglandi (SQLite).');
  }

  /**
   * Kurulum verisini KORUYAN guncellemede, template.db migration'lari mevcut
   * ado.db'ye uygulanmaz. Prisma client yeni kolonlari bekledigi icin sorgular
   * patlar. Burada eksik (additive) kolonlari idempotent olarak tamamlariz.
   * ponytail: kolon-bazli guard; migration'lar cogalinca bundle'a `migrate deploy`.
   */
  private async ensureSchema(): Promise<void> {
    const cols = await this.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info('orders')`);
    if (!cols.some((c) => c.name === 'type')) {
      await this.$executeRawUnsafe(
        `ALTER TABLE "orders" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'dine_in'`,
      );
      this.logger.warn("orders.type kolonu eksikti -> eklendi (varsayilan 'dine_in').");
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
