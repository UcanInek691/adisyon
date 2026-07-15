import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, DiskHealthIndicator, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../../prisma/prisma.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaService: PrismaService,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      async () => {
        try {
          await this.prismaService.$queryRawUnsafe('SELECT 1');
          return { database: { status: 'up' } };
        } catch (err: any) {
          return { database: { status: 'down', message: err.message } };
        }
      },
      () => this.memory.checkHeap('memory_heap', 150 * 1024 * 1024), // 150MB heap limit
      () => this.disk.checkStorage('storage', { path: './', thresholdPercent: 0.95 }), // 95% disk usage threshold
    ]);
  }
}
