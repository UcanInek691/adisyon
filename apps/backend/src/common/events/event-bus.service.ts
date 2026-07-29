import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { newId, type DomainEvent } from '@ado/shared';
import type { Prisma } from '@prisma/client';
import { BackgroundWorkerService } from '../worker/worker.service';

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
export class EventBusService implements OnModuleInit {
  private readonly logger = new Logger(EventBusService.name);

  constructor(
    private readonly emitter: EventEmitter2,
    private readonly worker: BackgroundWorkerService,
  ) {}

  onModuleInit() {
    this.worker.registerHandler('domain.event', async (payload) =>
      this.publish(payload as DomainEvent<string, unknown>, true),
    );
  }

  async publishDurable(
    tx: Prisma.TransactionClient,
    event: DomainEvent<string, unknown>,
  ): Promise<void> {
    await tx.backgroundJob.create({
      data: {
        id: newId(),
        branchId: event.branchId,
        taskName: 'domain.event',
        payload: JSON.stringify(event),
        status: 'pending',
        runAt: new Date(),
      },
    });
  }

  async publish<TName extends string, TPayload>(
    event: DomainEvent<TName, TPayload>,
    rethrow = false,
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
      if (rethrow) throw err;
    }
  }
}
