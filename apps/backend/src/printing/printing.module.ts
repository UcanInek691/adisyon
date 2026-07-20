import { Module } from '@nestjs/common';
import { PrintingService } from './printing.service';
import { PrintingController } from './printing.controller';

@Module({
  providers: [PrintingService],
  controllers: [PrintingController],
  exports: [PrintingService],
})
export class PrintingModule {}
