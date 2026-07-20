import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { newId, StockMovementType } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type {
  CreateSupplierDto,
  UpdateSupplierDto,
  CreatePurchaseDto,
  CreateStockMovementDto,
} from './dto/inventory.schemas';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // Supplier CRUD
  // ===========================================================================
  async createSupplier(user: AuthUser, dto: CreateSupplierDto) {
    const id = newId();
    return this.prisma.supplier.create({
      data: {
        id,
        branchId: user.branchId,
        name: dto.name,
        phone: dto.phone ?? null,
        note: dto.note ?? null,
        deviceId: user.deviceId ?? null,
      },
    });
  }

  async updateSupplier(user: AuthUser, id: string, dto: UpdateSupplierDto) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Tedarikçi bulunamadı.');

    const data: any = {
      version: { increment: 1 },
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.note !== undefined) data.note = dto.note;

    return this.prisma.supplier.update({
      where: { id },
      data,
    });
  }

  async deleteSupplier(user: AuthUser, id: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Tedarikçi bulunamadı.');

    await this.prisma.supplier.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { success: true };
  }

  async listSuppliers(user: AuthUser) {
    return this.prisma.supplier.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  // ===========================================================================
  // Purchases (Stock Entry)
  // ===========================================================================
  async createPurchase(user: AuthUser, dto: CreatePurchaseDto) {
    // Tedarikçiyi doğrula
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: dto.supplierId, branchId: user.branchId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Tedarikçi bulunamadı.');

    const purchaseId = newId();

    return this.prisma.$transaction(async (tx) => {
      // 1. Alım (Purchase) kaydı oluştur
      const purchase = await tx.purchase.create({
        data: {
          id: purchaseId,
          branchId: user.branchId,
          supplierId: dto.supplierId,
          invoiceNo: dto.invoiceNo ?? null,
          total: dto.total,
          purchasedAt: new Date(dto.purchasedAt),
          createdBy: user.userId,
          deviceId: user.deviceId ?? null,
        },
      });

      // 2. Kalemleri ve Stok hareketlerini ekle
      for (const item of dto.items) {
        const itemId = newId();
        const lineTotal = (item.quantity / 1000) * item.unitCost;

        await tx.purchaseItem.create({
          data: {
            id: itemId,
            purchaseId,
            productId: item.productId,
            quantity: item.quantity,
            unitCost: item.unitCost,
            lineTotal: Math.round(lineTotal),
            deviceId: user.deviceId ?? null,
          },
        });

        // Ürünün alış maliyetini son fiyat olarak güncelle
        await tx.product.update({
          where: { id: item.productId },
          data: {
            purchasePrice: item.unitCost,
            version: { increment: 1 },
          },
        });

        // Stok Giriş Hareketi (Stock Movement)
        await tx.stockMovement.create({
          data: {
            id: newId(),
            branchId: user.branchId,
            productId: item.productId,
            type: StockMovementType.Purchase,
            quantity: item.quantity, // Pozitif giriş
            relatedPurchaseId: purchaseId,
            createdBy: user.userId,
            occurredAt: new Date(dto.purchasedAt),
            deviceId: user.deviceId ?? null,
          },
        });
      }

      return purchase;
    });
  }

  // ===========================================================================
  // Stock Movements (Adjustments/Waste)
  // ===========================================================================
  async createStockMovement(user: AuthUser, dto: CreateStockMovementDto) {
    const product = await this.prisma.product.findFirst({
      where: { id: dto.productId, branchId: user.branchId, deletedAt: null },
    });
    if (!product) throw new NotFoundException('Ürün bulunamadı.');

    return this.prisma.stockMovement.create({
      data: {
        id: newId(),
        branchId: user.branchId,
        productId: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        createdBy: user.userId,
        occurredAt: new Date(),
        deviceId: user.deviceId ?? null,
      },
    });
  }

  async getProductMovements(user: AuthUser, productId: string) {
    return this.prisma.stockMovement.findMany({
      where: { branchId: user.branchId, productId, deletedAt: null },
      orderBy: { occurredAt: 'desc' },
    });
  }

  // ===========================================================================
  // Domain Event Listeners (Otomatik Stok Düşümü)
  // ===========================================================================
  // Stok, kalem MUTFAGA GONDERILINCE (order.item.sent) dusulur; 'added'da DEGIL.
  // Boylece pending/taslak/offline kalemler (silinebilir, degistirilebilir) stok tutmaz
  // -> removeItem/updateItem stok sizintisi olusturmaz. Void -> iade (asagida).
  @OnEvent('order.item.sent', { async: true })
  async handleOrderItemSent(event: any) {
    const items: Array<{ productId: string; quantity: number; orderItemId: string }> =
      event.payload?.items ?? [];
    for (const it of items) {
      const product = await this.prisma.product.findUnique({ where: { id: it.productId } });
      if (!product || !product.trackStock) continue;

      this.logger.log(
        `Received order.item.sent. Deducting stock for product: ${it.productId}, quantity: ${it.quantity}`,
      );

      await this.prisma.stockMovement.create({
        data: {
          id: newId(),
          branchId: event.branchId,
          productId: it.productId,
          type: StockMovementType.Sale,
          quantity: -it.quantity, // Azaltma için negatif değer
          relatedOrderItemId: it.orderItemId,
          createdBy: event.actorId || 'system',
          occurredAt: new Date(),
          deviceId: event.deviceId ?? null,
        },
      });
    }
  }

  @OnEvent('order.item.voided', { async: true })
  async handleOrderItemVoided(event: any) {
    const { productId, quantity, orderItemId } = event.payload;

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || !product.trackStock) return;

    this.logger.log(
      `Received order.item.voided. Refunding stock for product: ${productId}, quantity: ${quantity}`,
    );

    await this.prisma.stockMovement.create({
      data: {
        id: newId(),
        branchId: event.branchId,
        productId,
        type: StockMovementType.Return,
        quantity: quantity, // Iade icin pozitif deger
        relatedOrderItemId: orderItemId,
        createdBy: event.actorId || 'system',
        occurredAt: new Date(),
        deviceId: event.deviceId ?? null,
      },
    });
  }
}
