import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  DiskHealthIndicator,
  MemoryHealthIndicator,
} from '@nestjs/terminus';
import { parse } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { Public } from '../decorators/public.decorator';

// Disk kontrolu kok surucuye bakar: Windows'ta 'C:\\', Linux'ta '/'.
// (terminus 'path' olarak surucu koku bekler; './' Windows'ta gecersiz.)
const STORAGE_ROOT = parse(process.cwd()).root;

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaService: PrismaService,
    private readonly disk: DiskHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
  ) {}

  @Get()
  @Public() // Electron denetcisi token'siz izler (ROADMAP: Health Check).
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
      () => this.disk.checkStorage('storage', { path: STORAGE_ROOT, thresholdPercent: 0.95 }), // 95% disk usage threshold
    ]);
  }
}
