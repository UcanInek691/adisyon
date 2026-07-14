import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  newId,
  createDomainEvent,
  DomainEventName,
  OrderStatus,
  OrderItemStatus,
  TableStatus,
} from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { EventBusService } from '../common/events/event-bus.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type {
  OpenOrderDto,
  AddItemDto,
  UpdateItemDto,
  VoidItemDto,
  CancelOrderDto,
  OrderQueryDto,
} from './dto/orders.schemas';

// Gun sonu saati (vars. 06:00 — CONVENTIONS.md). orderNo gunluk sirasi buna gore.
// Not: ileride ApplicationSetting'ten okunacak (Ayarlar modulu).
const DAY_END_HOUR = 6;

type TotalsInput = { lineTotal: number; lineDiscount: number; taxRatePermille: number };

/**
 * Siparis/Adisyon cekirdegi (PR1): adisyon ac, kalem ekle/guncelle/sil/void,
 * toplam hesabi, adisyon iptal. branchId izole, soft-delete, version++,
 * syncState, mutasyonlarda audit + domain event. clientOpId ile idempotent (offline).
 *
 * Fiyat/vergi/ad kalem eklenirken SNAPSHOT alinir -> urun sonradan degisse adisyon sabit.
 * KDV fiyata DAHIL: grandTotal = subtotal - discountTotal; taxTotal bilgi amacli (icerideki KDV).
 *
 * KAPSAM DISI (PR2): mutfaga gonder, adisyon-seviyesi indirim, held, canli WS masa katmani.
 * Odeme/kapatma ayri modul.
 */
@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  private provenance(user: AuthUser): { deviceId?: string } {
    return user.deviceId ? { deviceId: user.deviceId } : {};
  }

  // ===========================================================================
  // Adisyon
  // ===========================================================================
  async openOrder(user: AuthUser, dto: OpenOrderDto) {
    // Idempotency: ayni clientOpId ile tekrar gelirse mevcut adisyonu don.
    if (dto.clientOpId) {
      const existing = await this.prisma.order.findUnique({
        where: { clientOpId: dto.clientOpId },
      });
      if (existing) return this.orderWithItems(existing.id);
    }

    if (dto.tableId) {
      await this.tableOrThrow(user.branchId, dto.tableId);
      const open = await this.prisma.order.findFirst({
        where: {
          branchId: user.branchId,
          tableId: dto.tableId,
          status: OrderStatus.Open,
          deletedAt: null,
        },
      });
      if (open) {
        throw new ConflictException({
          code: 'TABLE_HAS_OPEN_ORDER',
          message: 'Masada zaten acik adisyon var.',
        });
      }
    }

    const id = newId();
    const created = await this.prisma.$transaction(async (tx) => {
      const orderNo = await this.generateOrderNo(tx, user.branchId);
      const order = await tx.order.create({
        data: {
          id,
          branchId: user.branchId,
          tableId: dto.tableId ?? null,
          orderNo,
          status: OrderStatus.Open,
          openedBy: user.userId,
          openedAt: new Date(),
          guestCount: dto.guestCount ?? 1,
          note: dto.note ?? null,
          ...(dto.clientOpId ? { clientOpId: dto.clientOpId } : {}),
          ...this.provenance(user),
        },
      });
      if (dto.tableId) {
        await tx.table.update({
          where: { id: dto.tableId },
          data: { status: TableStatus.Occupied, version: { increment: 1 }, syncState: 'pending' },
        });
      }
      return order;
    });

    await this.audit.record({
      branchId: user.branchId,
      action: 'order.open',
      entityType: 'order',
      entityId: id,
      userId: user.userId,
      newValue: created,
      ...this.provenance(user),
    });
    await this.publishOrderEvent(user, DomainEventName.OrderCreated, created);
    return this.orderWithItems(id);
  }

  listOrders(user: AuthUser, query: OrderQueryDto) {
    return this.prisma.order.findMany({
      where: {
        branchId: user.branchId,
        deletedAt: null,
        ...(query.tableId ? { tableId: query.tableId } : {}),
        ...(query.status ? { status: query.status } : {}),
        ...(query.open ? { status: OrderStatus.Open } : {}),
      },
      include: { items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
      orderBy: { openedAt: 'desc' },
    });
  }

  getOrder(user: AuthUser, id: string) {
    return this.orderWithItemsOrThrow(user.branchId, id);
  }

  async cancelOrder(user: AuthUser, id: string, dto: CancelOrderDto) {
    const order = await this.orderOrThrow(user.branchId, id);
    if (order.status !== OrderStatus.Open && order.status !== OrderStatus.Held) {
      throw new ConflictException({
        code: 'ORDER_NOT_CANCELABLE',
        message: 'Yalnizca acik/bekleyen adisyon iptal edilebilir.',
      });
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: {
        status: OrderStatus.Cancelled,
        closedBy: user.userId,
        closedAt: new Date(),
        note: dto.reason ?? order.note,
        version: { increment: 1 },
        syncState: 'pending',
      },
    });
    if (order.tableId) await this.freeTableIfNoOpenOrder(user.branchId, order.tableId);

    await this.audit.record({
      branchId: user.branchId,
      action: 'order.cancel',
      entityType: 'order',
      entityId: id,
      userId: user.userId,
      oldValue: order,
      newValue: updated,
      ...(dto.reason ? { reason: dto.reason } : {}),
      ...this.provenance(user),
    });
    await this.publishOrderEvent(user, DomainEventName.OrderUpdated, updated);
    return this.orderWithItems(id);
  }

  // ===========================================================================
  // Kalem
  // ===========================================================================
  async addItem(user: AuthUser, orderId: string, dto: AddItemDto) {
    await this.orderOpenOrThrow(user.branchId, orderId);

    if (dto.clientOpId) {
      const existing = await this.prisma.orderItem.findUnique({
        where: { clientOpId: dto.clientOpId },
      });
      if (existing) return this.orderWithItems(orderId); // idempotent replay
    }

    const product = await this.productForOrder(user.branchId, dto.productId);
    const gross = Math.round((product.salePrice * dto.quantity) / 1000);
    const lineTotal = gross; // lineDiscount 0 (satir indirimi PR2)

    const itemId = newId();
    const item = await this.prisma.orderItem.create({
      data: {
        id: itemId,
        orderId,
        productId: product.id,
        productNameSnapshot: product.name,
        unitPrice: product.salePrice,
        quantity: dto.quantity,
        taxRatePermille: product.tax.ratePermille,
        lineDiscount: 0,
        lineTotal,
        status: OrderItemStatus.Pending,
        addedBy: user.userId,
        ...(dto.clientOpId ? { clientOpId: dto.clientOpId } : {}),
        ...this.provenance(user),
      },
    });
    if (dto.note) {
      await this.prisma.orderItemNote.create({
        data: {
          id: newId(),
          orderItemId: itemId,
          note: dto.note,
          type: 'waiter',
          createdBy: user.userId,
          ...this.provenance(user),
        },
      });
    }

    const updated = await this.recompute(orderId);
    await this.audit.record({
      branchId: user.branchId,
      action: 'order.item.add',
      entityType: 'order_item',
      entityId: itemId,
      userId: user.userId,
      newValue: item,
      ...this.provenance(user),
    });
    await this.publishOrderItemEvent(user, DomainEventName.OrderItemAdded, {
      orderId,
      orderItemId: itemId,
      productId: product.id,
      quantity: dto.quantity,
      lineTotal,
    });
    await this.publishOrderEvent(user, DomainEventName.OrderUpdated, updated);
    return this.orderWithItems(orderId);
  }

  async updateItem(user: AuthUser, orderId: string, itemId: string, dto: UpdateItemDto) {
    await this.orderOpenOrThrow(user.branchId, orderId);
    const item = await this.itemOrThrow(orderId, itemId);
    this.assertItemEditable(item);

    const gross = Math.round((item.unitPrice * dto.quantity) / 1000);
    const lineTotal = gross - item.lineDiscount;
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        lineTotal,
        version: { increment: 1 },
        syncState: 'pending',
      },
    });
    const updated = await this.recompute(orderId);
    await this.audit.record({
      branchId: user.branchId,
      action: 'order.item.update',
      entityType: 'order_item',
      entityId: itemId,
      userId: user.userId,
      oldValue: item,
      ...this.provenance(user),
    });
    await this.publishOrderEvent(user, DomainEventName.OrderUpdated, updated);
    return this.orderWithItems(orderId);
  }

  async removeItem(user: AuthUser, orderId: string, itemId: string) {
    await this.orderOpenOrThrow(user.branchId, orderId);
    const item = await this.itemOrThrow(orderId, itemId);
    this.assertItemEditable(item);

    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: { deletedAt: new Date(), version: { increment: 1 }, syncState: 'pending' },
    });
    const updated = await this.recompute(orderId);
    await this.audit.record({
      branchId: user.branchId,
      action: 'order.item.remove',
      entityType: 'order_item',
      entityId: itemId,
      userId: user.userId,
      oldValue: item,
      ...this.provenance(user),
    });
    await this.publishOrderEvent(user, DomainEventName.OrderUpdated, updated);
    return this.orderWithItems(orderId);
  }

  // Void: gonderilmis/onaylanmis kalemi iptal eder (Owner). Satir kalir, status=cancelled.
  async voidItem(user: AuthUser, orderId: string, itemId: string, dto: VoidItemDto) {
    await this.orderOpenOrThrow(user.branchId, orderId);
    const item = await this.itemOrThrow(orderId, itemId);
    if (item.status === OrderItemStatus.Cancelled) {
      throw new ConflictException({
        code: 'ITEM_ALREADY_VOID',
        message: 'Kalem zaten iptal edilmis.',
      });
    }
    await this.prisma.orderItem.update({
      where: { id: itemId },
      data: {
        status: OrderItemStatus.Cancelled,
        voidedBy: user.userId,
        voidReason: dto.reason ?? null,
        version: { increment: 1 },
        syncState: 'pending',
      },
    });
    const updated = await this.recompute(orderId);
    await this.audit.record({
      branchId: user.branchId,
      action: 'order.item.void',
      entityType: 'order_item',
      entityId: itemId,
      userId: user.userId,
      oldValue: item,
      ...(dto.reason ? { reason: dto.reason } : {}),
      ...this.provenance(user),
    });
    await this.publishOrderItemEvent(user, DomainEventName.OrderItemVoided, {
      orderId,
      orderItemId: itemId,
      productId: item.productId,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    });
    await this.publishOrderEvent(user, DomainEventName.OrderUpdated, updated);
    return this.orderWithItems(orderId);
  }

  // ===========================================================================
  // Toplam motoru + yardimcilar
  // ===========================================================================
  private computeTotals(items: TotalsInput[]) {
    let subtotal = 0;
    let discountTotal = 0;
    let taxTotal = 0;
    for (const it of items) {
      const gross = it.lineTotal + it.lineDiscount;
      subtotal += gross;
      discountTotal += it.lineDiscount;
      // KDV fiyata dahil -> icerideki vergi: net * rate / (1000 + rate).
      taxTotal += Math.round((it.lineTotal * it.taxRatePermille) / (1000 + it.taxRatePermille));
    }
    const serviceCharge = 0;
    const coverCharge = 0;
    const grandTotal = subtotal - discountTotal + serviceCharge + coverCharge;
    return { subtotal, discountTotal, taxTotal, serviceCharge, coverCharge, grandTotal };
  }

  private async recompute(orderId: string) {
    const items = await this.prisma.orderItem.findMany({
      where: { orderId, deletedAt: null, status: { not: OrderItemStatus.Cancelled } },
      select: { lineTotal: true, lineDiscount: true, taxRatePermille: true },
    });
    const totals = this.computeTotals(items);
    return this.prisma.order.update({
      where: { id: orderId },
      data: { ...totals, version: { increment: 1 }, syncState: 'pending' },
    });
  }

  // orderNo = YYYYMMDD-#### (is-gunu bazli gunluk sira). Transaction icinde cagrilir
  // (SQLite tek-yazar -> sayac yarisi pratikte serilesir).
  private async generateOrderNo(
    tx: Parameters<Parameters<PrismaService['$transaction']>[0]>[0],
    branchId: string,
  ): Promise<string> {
    const now = new Date();
    const start = new Date(now);
    if (now.getHours() < DAY_END_HOUR) start.setDate(start.getDate() - 1);
    start.setHours(DAY_END_HOUR, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const dateStr =
      `${start.getFullYear()}` +
      `${String(start.getMonth() + 1).padStart(2, '0')}` +
      `${String(start.getDate()).padStart(2, '0')}`;
    const count = await tx.order.count({
      where: { branchId, openedAt: { gte: start, lt: end } },
    });
    return `${dateStr}-${String(count + 1).padStart(4, '0')}`;
  }

  private async freeTableIfNoOpenOrder(branchId: string, tableId: string): Promise<void> {
    const stillOpen = await this.prisma.order.count({
      where: { branchId, tableId, status: OrderStatus.Open, deletedAt: null },
    });
    if (stillOpen === 0) {
      await this.prisma.table.update({
        where: { id: tableId },
        data: { status: TableStatus.Empty, version: { increment: 1 }, syncState: 'pending' },
      });
    }
  }

  private assertItemEditable(item: { status: string }): void {
    // PR1: gonderilmemis (pending) kalem duzenlenebilir/silinebilir. Gonderilmis kalem
    // (sent/preparing/served) -> void gerekir. Iptal edilmis -> islenmez.
    if (item.status !== OrderItemStatus.Pending) {
      throw new ConflictException({
        code: 'ITEM_NOT_EDITABLE',
        message: 'Yalnizca gonderilmemis kalem duzenlenebilir; gonderilmisi void edin.',
      });
    }
  }

  private async orderOrThrow(branchId: string, id: string) {
    const row = await this.prisma.order.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!row)
      throw new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Adisyon bulunamadi.' });
    return row;
  }

  private async orderOpenOrThrow(branchId: string, id: string) {
    const order = await this.orderOrThrow(branchId, id);
    if (order.status !== OrderStatus.Open) {
      throw new ConflictException({ code: 'ORDER_NOT_OPEN', message: 'Adisyon acik degil.' });
    }
    return order;
  }

  private async orderWithItems(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } } },
    });
  }

  private async orderWithItemsOrThrow(branchId: string, id: string) {
    await this.orderOrThrow(branchId, id);
    return this.orderWithItems(id);
  }

  private async itemOrThrow(orderId: string, itemId: string) {
    const row = await this.prisma.orderItem.findFirst({
      where: { id: itemId, orderId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({ code: 'ORDER_ITEM_NOT_FOUND', message: 'Kalem bulunamadi.' });
    }
    return row;
  }

  private async productForOrder(branchId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, branchId, deletedAt: null },
      include: { tax: true },
    });
    if (!product) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Urun bulunamadi.' });
    }
    return product;
  }

  private async publishOrderEvent(
    user: AuthUser,
    name: (typeof DomainEventName)[keyof typeof DomainEventName],
    order: {
      id: string;
      orderNo: string;
      tableId: string | null;
      status: string;
      grandTotal: number;
    },
  ): Promise<void> {
    await this.events.publish(
      createDomainEvent(
        name,
        {
          orderId: order.id,
          orderNo: order.orderNo,
          ...(order.tableId ? { tableId: order.tableId } : {}),
          status: order.status,
          grandTotal: order.grandTotal,
        },
        {
          branchId: user.branchId,
          actorId: user.userId,
          ...(user.deviceId ? { deviceId: user.deviceId } : {}),
        },
      ),
    );
  }

  private async publishOrderItemEvent(
    user: AuthUser,
    name: (typeof DomainEventName)[keyof typeof DomainEventName],
    payload: {
      orderId: string;
      orderItemId: string;
      productId: string;
      quantity: number;
      lineTotal: number;
    },
  ): Promise<void> {
    await this.events.publish(
      createDomainEvent(name, payload, {
        branchId: user.branchId,
        actorId: user.userId,
        ...(user.deviceId ? { deviceId: user.deviceId } : {}),
      }),
    );
  }

  private async tableOrThrow(branchId: string, id: string) {
    const row = await this.prisma.table.findFirst({ where: { id, branchId, deletedAt: null } });
    if (!row) throw new NotFoundException({ code: 'TABLE_NOT_FOUND', message: 'Masa bulunamadi.' });
    return row;
  }
}
