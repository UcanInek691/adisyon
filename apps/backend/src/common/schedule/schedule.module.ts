import { Module } from '@nestjs/common';
import { ScheduleModule as NestScheduleModule } from '@nestjs/schedule';
import { SchedulerService } from './schedule.service';

@Module({
  imports: [NestScheduleModule.forRoot()],
  providers: [SchedulerService],
  exports: [SchedulerService],
})
export class ScheduleModule {}
