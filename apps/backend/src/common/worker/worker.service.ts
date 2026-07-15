import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { newId } from '@ado/shared';
import { PrismaService } from '../../prisma/prisma.service';

export type JobHandler = (payload: any, branchId: string) => Promise<void>;

@Injectable()
export class BackgroundWorkerService implements OnModuleInit {
  private readonly logger = new Logger(BackgroundWorkerService.name);
  private readonly handlers = new Map<string, JobHandler>();

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.logger.log('Background Worker Service initialized');
  }

  registerHandler(taskName: string, handler: JobHandler) {
    if (this.handlers.has(taskName)) {
      this.logger.warn(`Handler for task "${taskName}" is already registered. Overwriting.`);
    }
    this.handlers.set(taskName, handler);
    this.logger.log(`Task handler registered: ${taskName}`);
  }

  async enqueue(
    branchId: string,
    taskName: string,
    payload: any,
    delaySeconds = 0,
  ): Promise<string> {
    const id = newId();
    const runAt = new Date(Date.now() + delaySeconds * 1000);
    const serializedPayload = JSON.stringify(payload);

    await this.prisma.backgroundJob.create({
      data: {
        id,
        branchId,
        taskName,
        payload: serializedPayload,
        status: 'pending',
        runAt,
      },
    });

    this.logger.debug(`Enqueued job ${taskName} (${id}) to run at ${runAt.toISOString()}`);
    return id;
  }

  async processNextJobs(): Promise<number> {
    const now = new Date();
    // En fazla 5 isi ayni anda alalim
    const jobs = await this.prisma.backgroundJob.findMany({
      where: {
        status: 'pending',
        runAt: { lte: now },
      },
      orderBy: { runAt: 'asc' },
      take: 5,
    });

    if (jobs.length === 0) return 0;

    this.logger.debug(`Found ${jobs.length} jobs to process.`);

    for (const job of jobs) {
      await this.runJob(job.id);
    }

    return jobs.length;
  }

  private async runJob(id: string) {
    // Kilitliyoruz
    const job = await this.prisma.$transaction(async (tx) => {
      const current = await tx.backgroundJob.findUnique({
        where: { id },
      });

      if (!current || current.status !== 'pending') {
        return null;
      }

      return tx.backgroundJob.update({
        where: { id },
        data: {
          status: 'running',
          lockedAt: new Date(),
          attempts: { increment: 1 },
        },
      });
    });

    if (!job) return;

    this.logger.log(`Running job "${job.taskName}" (${job.id}), attempt #${job.attempts}`);

    const handler = this.handlers.get(job.taskName);
    if (!handler) {
      const errMsg = `No handler registered for task "${job.taskName}"`;
      this.logger.error(errMsg);
      await this.handleJobFailure(job.id, job.attempts, job.maxAttempts, errMsg);
      return;
    }

    try {
      const parsedPayload = JSON.parse(job.payload);
      await handler(parsedPayload, job.branchId);

      // Basariyla bitti
      await this.prisma.backgroundJob.update({
        where: { id: job.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
        },
      });
      this.logger.log(`Job "${job.taskName}" (${job.id}) completed successfully.`);
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      this.logger.error(`Job "${job.taskName}" (${job.id}) failed with error: ${errMsg}`);
      await this.handleJobFailure(job.id, job.attempts, job.maxAttempts, errMsg);
    }
  }

  private async handleJobFailure(id: string, attempts: number, maxAttempts: number, error: string) {
    if (attempts < maxAttempts) {
      // Yeniden dene
      const backoffSeconds = 5 * attempts; // exponential backoff
      const nextRun = new Date(Date.now() + backoffSeconds * 1000);
      await this.prisma.backgroundJob.update({
        where: { id },
        data: {
          status: 'pending',
          runAt: nextRun,
          lastError: error,
          lockedAt: null,
        },
      });
      this.logger.warn(
        `Job ${id} scheduled for retry at ${nextRun.toISOString()} (backoff: ${backoffSeconds}s)`,
      );
    } else {
      // Kalici basarisiz
      await this.prisma.backgroundJob.update({
        where: { id },
        data: {
          status: 'failed',
          failedAt: new Date(),
          lastError: error,
        },
      });
      this.logger.error(`Job ${id} failed permanently after ${attempts} attempts.`);
    }
  }
}
