import { Module } from '@nestjs/common';
import { OrdersModule } from '../orders/orders.module';
import { SyncService } from './sync.service';
import { OfflineReviewsController, SyncController } from './sync.controller';

/** Istemci-offline senkron modulu (OFFLINE_DESIGN.md). PrismaModule + AuditModule @Global. */
@Module({
  imports: [OrdersModule],
  controllers: [SyncController, OfflineReviewsController],
  providers: [SyncService],
})
export class SyncModule {}
