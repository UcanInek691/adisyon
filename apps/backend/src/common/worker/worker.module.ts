import { Global, Module } from '@nestjs/common';
import { BackgroundWorkerService } from './worker.service';

@Global()
@Module({
  providers: [BackgroundWorkerService],
  exports: [BackgroundWorkerService],
})
export class BackgroundWorkerModule {}
