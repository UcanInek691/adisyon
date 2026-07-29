import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/** Prisma baglantisini Nest yasam dongusune baglar (connect/disconnect). */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma baglandi (SQLite).');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
