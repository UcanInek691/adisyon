import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  newId,
  createDomainEvent,
  DomainEventName,
  OrderStatus,
  PaymentDirection,
  TableStatus,
} from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { EventBusService } from '../common/events/event-bus.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { RecordPaymentDto, ReversePaymentDto } from './dto/payments.schemas';
import { settlePayment } from './payments.calc';

/**
 * Odeme modulu (PR3): adisyona odeme al (append-only, cift-cekim idempotent),
 * nakit para ustu, split/kismi odeme (toplam >= grandTotal olunca kapanis),
 * masayi bosalt, `order.paid` yayinla (kasa/veresiye/yazdirma dinler).
 *
 * Okuma+dogrulama+yazma TEK transaction: kismi odemede iki es zamanli istegin
 * ayni bakiyeyi gorup fazla-odeme yapmasi (race) engellenir.
 *
 * KAPSAM DISI (sonraki PR): iade/reversal (sema destekler), adisyon indirim.
 */
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  private provenance(user: AuthUser): { deviceId?: string } {
    return user.deviceId ? { deviceId: user.deviceId } : {};
  }

  async recordPayment(user: AuthUser, orderId: string, dto: RecordPaymentDto) {
    // Idempotency (offline replay): ayni anahtar -> mevcut durumu don.
    const dup = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (dup) return this.orderWithPayments(dup.orderId);

    const paymentId = newId();
    let payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: orderId, branchId: user.branchId, deletedAt: null },
        });
        if (!order) {
          throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Adisyon bulunamadi.' });
        }
        if (order.status !== OrderStatus.Open) {
          throw new ConflictException({ code: 'ORDER_NOT_OPEN', message: 'Adisyon acik degil.' });
        }

        const agg = await tx.payment.aggregate({
          where: { orderId, direction: PaymentDirection.Charge, deletedAt: null },
          _sum: { amount: true },
        });
        const alreadyPaid = agg._sum.amount ?? 0;
        const remaining = order.grandTotal - alreadyPaid;
        if (remaining <= 0) {
          throw new ConflictException({
            code: 'ORDER_ALREADY_PAID',
            message: 'Adisyon zaten tamamen odendi.',
          });
        }
        if (dto.amount > remaining) {
          throw new BadRequestException({
            code: 'BILL_OVERPAY',
            message: `Odeme tutari kalan bakiyeyi (${remaining}) asamaz.`,
          });
        }

        const { received, change, fullyPaid } = settlePayment({
          grandTotal: order.grandTotal,
          alreadyPaid,
          amount: dto.amount,
          method: dto.method,
          ...(dto.received !== undefined ? { received: dto.received } : {}),
        });

        const p = await tx.payment.create({
          data: {
            id: paymentId,
            orderId,
            method: dto.method,
            direction: PaymentDirection.Charge,
            amount: dto.amount,
            received,
            change,
            reference: dto.reference ?? null,
            takenBy: user.userId,
            paidAt: new Date(),
            idempotencyKey: dto.idempotencyKey,
            ...this.provenance(user),
          },
        });

        if (fullyPaid) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              isPaid: true,
              status: OrderStatus.Completed,
              closedBy: user.userId,
              closedAt: new Date(),
              version: { increment: 1 },
              syncState: 'pending',
            },
          });
          // Baska acik adisyon yoksa masayi bosalt (split adisyon guvenligi).
          if (order.tableId) {
            const stillOpen = await tx.order.count({
              where: {
                branchId: user.branchId,
                tableId: order.tableId,
                status: OrderStatus.Open,
                deletedAt: null,
              },
            });
            if (stillOpen === 0) {
              await tx.table.update({
                where: { id: order.tableId },
                data: {
                  status: TableStatus.Empty,
                  version: { increment: 1 },
                  syncState: 'pending',
                },
              });
            }
          }
        }
        return p;
      });
    } catch (e) {
      // Yaris: ayni idempotencyKey araya girdi -> idempotent don.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return this.orderWithPayments(orderId);
      }
      throw e;
    }

    await this.audit.record({
      branchId: user.branchId,
      action: 'payment.take',
      entityType: 'payment',
      entityId: paymentId,
      userId: user.userId,
      newValue: payment,
      ...this.provenance(user),
    });

    // order.paid: her odemede yayinlanir -> kasa/veresiye/yazdirma dinleyicileri.
    await this.events.publish(
      createDomainEvent(
        DomainEventName.OrderPaid,
        {
          orderId,
          paymentId,
          amount: dto.amount,
          method: dto.method,
          ...(dto.customerId ? { customerId: dto.customerId } : {}),
        },
        {
          branchId: user.branchId,
          actorId: user.userId,
          ...(user.deviceId ? { deviceId: user.deviceId } : {}),
        },
      ),
    );

    return this.orderWithPayments(orderId);
  }

  async reversePayment(user: AuthUser, orderId: string, paymentId: string, dto: ReversePaymentDto) {
    // Idempotency: ayni anahtar -> mevcut durumu don.
    const dup = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
    });
    if (dup) return this.orderWithPayments(dup.orderId);

    const refundId = newId();
    let refund;
    try {
      refund = await this.prisma.$transaction(async (tx) => {
        const order = await tx.order.findFirst({
          where: { id: orderId, branchId: user.branchId, deletedAt: null },
        });
        if (!order) {
          throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Adisyon bulunamadi.' });
        }

        const original = await tx.payment.findFirst({
          where: { id: paymentId, orderId, direction: PaymentDirection.Charge, deletedAt: null },
        });
        if (!original) {
          throw new NotFoundException({ code: 'PAYMENT_NOT_FOUND', message: 'Odeme bulunamadi.' });
        }

        const alreadyReversed = await tx.payment.findFirst({
          where: { reversesPaymentId: paymentId, deletedAt: null },
        });
        if (alreadyReversed) {
          throw new ConflictException({
            code: 'PAYMENT_ALREADY_REVERSED',
            message: 'Bu odeme zaten iade edilmis.',
          });
        }
        if (original.method === 'debt' && !dto.customerId) {
          throw new BadRequestException({
            code: 'CUSTOMER_REQUIRED',
            message: 'Veresiye odemenin iadesi icin customerId zorunlu.',
          });
        }

        // Ters kayit (append-only): orijinali degistirmeyiz, telafi kaydi ekleriz.
        const refundPayment = await tx.payment.create({
          data: {
            id: refundId,
            orderId,
            method: original.method,
            direction: PaymentDirection.Refund,
            amount: original.amount,
            received: 0,
            change: 0,
            reference: dto.reason ?? null,
            takenBy: user.userId,
            paidAt: new Date(),
            reversesPaymentId: original.id,
            idempotencyKey: dto.idempotencyKey,
            ...this.provenance(user),
          },
        });

        // Kalan odeme = charge toplami - refund toplami. Adisyon kapaliyken
        // tam odemenin altina duserse yeniden acilir (duzeltme mumkun olsun).
        const charges = await tx.payment.aggregate({
          where: { orderId, direction: PaymentDirection.Charge, deletedAt: null },
          _sum: { amount: true },
        });
        const refunds = await tx.payment.aggregate({
          where: { orderId, direction: PaymentDirection.Refund, deletedAt: null },
          _sum: { amount: true },
        });
        const netPaid = (charges._sum.amount ?? 0) - (refunds._sum.amount ?? 0);

        if (order.isPaid && netPaid < order.grandTotal) {
          await tx.order.update({
            where: { id: orderId },
            data: {
              isPaid: false,
              status: OrderStatus.Open,
              closedBy: null,
              closedAt: null,
              version: { increment: 1 },
              syncState: 'pending',
            },
          });
          if (order.tableId) {
            await tx.table.update({
              where: { id: order.tableId },
              data: {
                status: TableStatus.Occupied,
                version: { increment: 1 },
                syncState: 'pending',
              },
            });
          }
        }
        return refundPayment;
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        return this.orderWithPayments(orderId);
      }
      throw e;
    }

    await this.audit.record({
      branchId: user.branchId,
      action: 'payment.refund',
      entityType: 'payment',
      entityId: refundId,
      userId: user.userId,
      newValue: refund,
      ...(dto.reason ? { reason: dto.reason } : {}),
      ...this.provenance(user),
    });

    // order.refunded -> kasa (nakit cikisi) / veresiye (borc geri alma) dinleyicileri.
    await this.events.publish(
      createDomainEvent(
        DomainEventName.OrderRefunded,
        {
          orderId,
          paymentId: refundId,
          originalPaymentId: paymentId,
          amount: refund.amount,
          method: refund.method,
          ...(dto.customerId ? { customerId: dto.customerId } : {}),
        },
        {
          branchId: user.branchId,
          actorId: user.userId,
          ...(user.deviceId ? { deviceId: user.deviceId } : {}),
        },
      ),
    );

    return this.orderWithPayments(orderId);
  }

  listPayments(user: AuthUser, orderId: string) {
    return this.prisma.payment.findMany({
      where: { orderId, order: { branchId: user.branchId }, deletedAt: null },
      orderBy: { paidAt: 'asc' },
    });
  }

  private async orderWithPayments(orderId: string) {
    return this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        payments: { where: { deletedAt: null }, orderBy: { paidAt: 'asc' } },
      },
    });
  }
}
