import { Global, Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import { EventLoggerSubscriber } from './event-logger.subscriber';
import { EventsController } from './events.controller';
import { BackgroundWorkerModule } from '../worker/worker.module';

/**
 * Global domain event altyapisi. EventBusService her modulde enjekte edilebilir;
 * dinleyiciler `@OnEvent('entity.action')` ile abone olur.
 *
 * wildcard + '.' delimiter: 'product.created' gibi ad-alanli event'ler ve '**'
 * ile hepsini dinleme (EventLoggerSubscriber) desteklenir. Detay: EVENT_BUS.md.
 */
@Global()
@Module({
  imports: [
    BackgroundWorkerModule,
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      // Bir dinleyici digerlerini durdurmasin diye hata firlatma davranisini kapatma;
      // izolasyon EventBusService.publish icinde try/catch ile yapiliyor.
      ignoreErrors: false,
    }),
  ],
  controllers: [EventsController],
  providers: [EventBusService, EventLoggerSubscriber],
  exports: [EventBusService],
})
export class EventBusModule {}
