import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';

/** Siparis/Adisyon modulu. PrismaModule + AuditModule + EventBusModule @Global. */
@Module({
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
