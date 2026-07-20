import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { BackgroundWorkerService } from '../worker/worker.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private isProcessing = false;

  constructor(private readonly worker: BackgroundWorkerService) {}

  @Interval(5000) // Her 5 saniyede bir calisir
  async handleWorkerTick() {
    if (this.isProcessing) return;
    this.isProcessing = true;
    try {
      await this.worker.processNextJobs();
    } catch (err) {
      this.logger.error('Error in background worker tick:', err);
    } finally {
      this.isProcessing = false;
    }
  }
}
