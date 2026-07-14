import { Module } from '@nestjs/common';
import { TablesService } from './tables.service';
import { HallsController, TablesController } from './tables.controller';

/** Masa/Salon modulu. PrismaModule + AuditModule + EventBusModule @Global. */
@Module({
  controllers: [HallsController, TablesController],
  providers: [TablesService],
  exports: [TablesService],
})
export class TablesModule {}
