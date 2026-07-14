import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomainEvent } from '@ado/shared';

/**
 * Merkezi domain event yayincisi. Moduller birbirini DOGRUDAN cagirmaz;
 * yan etkiler event uzerinden akar (OrderCreated -> Printer/Audit/Dashboard...).
 *
 * Ince sarmal: altta @nestjs/event-emitter (EventEmitter2). Dinleyiciler
 * `@OnEvent('entity.action')` kullanir. Detay: EVENT_BUS.md.
 *
 * Onemli: publish, kalicilastirmadan SONRA (post-commit yan etki) cagrilir.
 * Bir dinleyicinin hatasi yayinciyi VEYA diger dinleyicileri etkilemez (izolasyon).
 * Dinleyiciler hizli olmali ya da agir isi Background Worker'a devretmeli.
 */
@Injectable()
export class EventBusService {
  private readonly logger = new Logger(EventBusService.name);

  constructor(private readonly emitter: EventEmitter2) {}

  async publish<TName extends string, TPayload>(
    event: DomainEvent<TName, TPayload>,
  ): Promise<void> {
    try {
      // emitAsync tum dinleyicileri calistirir; bir dinleyici hata verse bile
      // digerleri calismis olur. Yine de yayinciyi korumak icin burada yutuyoruz.
      await this.emitter.emitAsync(event.name, event);
    } catch (err) {
      this.logger.error(
        `Event dinleyicisi hata verdi (name=${event.name}, eventId=${event.eventId}): ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
