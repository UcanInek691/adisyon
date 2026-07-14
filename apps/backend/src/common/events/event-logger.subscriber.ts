import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import type { DomainEvent } from '@ado/shared';

/**
 * Tum domain event'lerini debug seviyesinde loglar (wildcard '**').
 * Kalici gozlemlenebilirlik + event akisinin dogrulanmasi.
 * Asla hata firlatmaz (yayinciyi korur).
 */
@Injectable()
export class EventLoggerSubscriber {
  private readonly logger = new Logger('DomainEvents');

  @OnEvent('**', { async: true })
  handle(event: DomainEvent): void {
    try {
      this.logger.debug(
        `${event.name} eventId=${event.eventId} branch=${event.branchId}` +
          `${event.actorId ? ` actor=${event.actorId}` : ''}`,
      );
    } catch {
      // Loglama asla event akisini bozmaz.
    }
  }
}
