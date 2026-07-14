import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { newId, createDomainEvent, DomainEventName } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { EventBusService } from '../common/events/event-bus.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateProductDto,
  UpdateProductDto,
  ProductQueryDto,
  CreateUnitDto,
  UpdateUnitDto,
  CreateTaxDto,
  UpdateTaxDto,
} from './dto/catalog.schemas';

/**
 * Katalog: Kategori / Urun / Birim / Vergi CRUD.
 * Ortak kurallar: her islem branchId ile izole, soft-delete (deletedAt),
 * her mutasyonda version++ + syncState='pending' (Faz 2 outbox) + audit kaydi.
 * Para/oran integer (kurus/binde) -> DTO seviyesinde zorlanir (float yok).
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventBusService,
  ) {}

  // Mutasyonlarda yazilan ortak provenance alanlari.
  private provenance(user: AuthUser): { deviceId?: string } {
    return user.deviceId ? { deviceId: user.deviceId } : {};
  }

  // Urun domain event'i yayinlar (audit yaninda; yan etkiler icin -> EVENT_BUS.md).
  private async publishProductEvent(
    user: AuthUser,
    name: (typeof DomainEventName)[keyof typeof DomainEventName],
    product: { id: string; name: string; categoryId: string; salePrice: number },
  ): Promise<void> {
    await this.events.publish(
      createDomainEvent(
        name,
        {
          productId: product.id,
          name: product.name,
          categoryId: product.categoryId,
          salePrice: product.salePrice,
        },
        {
          branchId: user.branchId,
          actorId: user.userId,
          ...(user.deviceId ? { deviceId: user.deviceId } : {}),
        },
      ),
    );
  }

  // ===========================================================================
  // Kategori
  // ===========================================================================
  listCategories(user: AuthUser) {
    return this.prisma.category.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getCategory(user: AuthUser, id: string) {
    return this.categoryOrThrow(user.branchId, id);
  }

  async createCategory(user: AuthUser, dto: CreateCategoryDto) {
    if (dto.parentId) await this.categoryOrThrow(user.branchId, dto.parentId);

    const id = newId();
    const created = await this.prisma.category.create({
      data: {
        id,
        branchId: user.branchId,
        name: dto.name,
        parentId: dto.parentId ?? null,
        sortOrder: dto.sortOrder ?? 0,
        color: dto.color ?? null,
        isActive: dto.isActive ?? true,
        ...this.provenance(user),
      },
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'category.create',
      entityType: 'category',
      entityId: id,
      userId: user.userId,
      newValue: created,
      ...this.provenance(user),
    });
    return created;
  }

  async updateCategory(user: AuthUser, id: string, dto: UpdateCategoryDto) {
    const before = await this.categoryOrThrow(user.branchId, id);
    if (dto.parentId) {
      if (dto.parentId === id) {
        throw new ConflictException({
          code: 'CATEGORY_PARENT_SELF',
          message: 'Kategori kendi ust kategorisi olamaz.',
        });
      }
      await this.categoryOrThrow(user.branchId, dto.parentId);
    }

    const after = await this.prisma.category.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        version: { increment: 1 },
        syncState: 'pending',
      },
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'category.update',
      entityType: 'category',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      newValue: after,
      ...this.provenance(user),
    });
    return after;
  }

  async deleteCategory(user: AuthUser, id: string) {
    const before = await this.categoryOrThrow(user.branchId, id);

    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({
        where: { branchId: user.branchId, parentId: id, deletedAt: null },
      }),
      this.prisma.product.count({
        where: { branchId: user.branchId, categoryId: id, deletedAt: null },
      }),
    ]);
    if (childCount > 0 || productCount > 0) {
      throw new ConflictException({
        code: 'CATEGORY_NOT_EMPTY',
        message: 'Alt kategori veya urun iceren kategori silinemez.',
      });
    }

    const after = await this.softDelete('category', id);
    await this.audit.record({
      branchId: user.branchId,
      action: 'category.delete',
      entityType: 'category',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      ...this.provenance(user),
    });
    return after;
  }

  // ===========================================================================
  // Urun
  // ===========================================================================
  listProducts(user: AuthUser, query: ProductQueryDto) {
    return this.prisma.product.findMany({
      where: {
        branchId: user.branchId,
        deletedAt: null,
        ...(query.favorite !== undefined ? { isFavorite: query.favorite } : {}),
        ...(query.active !== undefined ? { isActive: query.active } : {}),
        ...(query.categoryId ? { categoryId: query.categoryId } : {}),
        ...(query.barcode ? { barcode: query.barcode } : {}),
        ...(query.search ? { name: { contains: query.search } } : {}),
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async getProduct(user: AuthUser, id: string) {
    return this.productOrThrow(user.branchId, id);
  }

  async createProduct(user: AuthUser, dto: CreateProductDto) {
    await this.assertProductRefs(user.branchId, dto.categoryId, dto.unitId, dto.taxId, dto.brandId);

    const id = newId();
    const created = await this.prisma.product.create({
      data: {
        id,
        branchId: user.branchId,
        categoryId: dto.categoryId,
        unitId: dto.unitId,
        taxId: dto.taxId,
        brandId: dto.brandId ?? null,
        name: dto.name,
        barcode: dto.barcode ?? null,
        sku: dto.sku ?? null,
        purchasePrice: dto.purchasePrice ?? 0,
        salePrice: dto.salePrice,
        trackStock: dto.trackStock ?? false,
        minStock: dto.minStock ?? null,
        isActive: dto.isActive ?? true,
        isFavorite: dto.isFavorite ?? false,
        sortOrder: dto.sortOrder ?? 0,
        ...this.provenance(user),
      },
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'product.create',
      entityType: 'product',
      entityId: id,
      userId: user.userId,
      newValue: created,
      ...this.provenance(user),
    });
    await this.publishProductEvent(user, DomainEventName.ProductCreated, created);
    return created;
  }

  async updateProduct(user: AuthUser, id: string, dto: UpdateProductDto) {
    const before = await this.productOrThrow(user.branchId, id);
    await this.assertProductRefs(user.branchId, dto.categoryId, dto.unitId, dto.taxId, dto.brandId);

    const after = await this.prisma.product.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
        ...(dto.unitId !== undefined ? { unitId: dto.unitId } : {}),
        ...(dto.taxId !== undefined ? { taxId: dto.taxId } : {}),
        ...(dto.brandId !== undefined ? { brandId: dto.brandId } : {}),
        ...(dto.barcode !== undefined ? { barcode: dto.barcode } : {}),
        ...(dto.sku !== undefined ? { sku: dto.sku } : {}),
        ...(dto.purchasePrice !== undefined ? { purchasePrice: dto.purchasePrice } : {}),
        ...(dto.salePrice !== undefined ? { salePrice: dto.salePrice } : {}),
        ...(dto.trackStock !== undefined ? { trackStock: dto.trackStock } : {}),
        ...(dto.minStock !== undefined ? { minStock: dto.minStock } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        ...(dto.isFavorite !== undefined ? { isFavorite: dto.isFavorite } : {}),
        ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
        version: { increment: 1 },
        syncState: 'pending',
      },
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'product.update',
      entityType: 'product',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      newValue: after,
      ...this.provenance(user),
    });
    await this.publishProductEvent(user, DomainEventName.ProductUpdated, after);
    return after;
  }

  async deleteProduct(user: AuthUser, id: string) {
    const before = await this.productOrThrow(user.branchId, id);
    const after = await this.softDelete('product', id);
    await this.audit.record({
      branchId: user.branchId,
      action: 'product.delete',
      entityType: 'product',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      ...this.provenance(user),
    });
    await this.publishProductEvent(user, DomainEventName.ProductDeleted, before);
    return after;
  }

  // ===========================================================================
  // Birim
  // ===========================================================================
  listUnits(user: AuthUser) {
    return this.prisma.unit.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async getUnit(user: AuthUser, id: string) {
    return this.unitOrThrow(user.branchId, id);
  }

  async createUnit(user: AuthUser, dto: CreateUnitDto) {
    const id = newId();
    const created = await this.prisma.unit.create({
      data: {
        id,
        branchId: user.branchId,
        name: dto.name,
        abbreviation: dto.abbreviation ?? null,
        ...this.provenance(user),
      },
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'unit.create',
      entityType: 'unit',
      entityId: id,
      userId: user.userId,
      newValue: created,
      ...this.provenance(user),
    });
    return created;
  }

  async updateUnit(user: AuthUser, id: string, dto: UpdateUnitDto) {
    const before = await this.unitOrThrow(user.branchId, id);
    const after = await this.prisma.unit.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.abbreviation !== undefined ? { abbreviation: dto.abbreviation } : {}),
        version: { increment: 1 },
        syncState: 'pending',
      },
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'unit.update',
      entityType: 'unit',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      newValue: after,
      ...this.provenance(user),
    });
    return after;
  }

  async deleteUnit(user: AuthUser, id: string) {
    const before = await this.unitOrThrow(user.branchId, id);
    const inUse = await this.prisma.product.count({
      where: { branchId: user.branchId, unitId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'UNIT_IN_USE',
        message: 'Urun tarafindan kullanilan birim silinemez.',
      });
    }
    const after = await this.softDelete('unit', id);
    await this.audit.record({
      branchId: user.branchId,
      action: 'unit.delete',
      entityType: 'unit',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      ...this.provenance(user),
    });
    return after;
  }

  // ===========================================================================
  // Vergi
  // ===========================================================================
  listTaxes(user: AuthUser) {
    return this.prisma.tax.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { ratePermille: 'asc' },
    });
  }

  async getTax(user: AuthUser, id: string) {
    return this.taxOrThrow(user.branchId, id);
  }

  async createTax(user: AuthUser, dto: CreateTaxDto) {
    const id = newId();
    const created = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.tax.updateMany({
          where: { branchId: user.branchId, isDefault: true, deletedAt: null },
          data: { isDefault: false, version: { increment: 1 }, syncState: 'pending' },
        });
      }
      return tx.tax.create({
        data: {
          id,
          branchId: user.branchId,
          name: dto.name,
          ratePermille: dto.ratePermille,
          isDefault: dto.isDefault ?? false,
          ...this.provenance(user),
        },
      });
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'tax.create',
      entityType: 'tax',
      entityId: id,
      userId: user.userId,
      newValue: created,
      ...this.provenance(user),
    });
    return created;
  }

  async updateTax(user: AuthUser, id: string, dto: UpdateTaxDto) {
    const before = await this.taxOrThrow(user.branchId, id);
    const after = await this.prisma.$transaction(async (tx) => {
      if (dto.isDefault === true) {
        await tx.tax.updateMany({
          where: {
            branchId: user.branchId,
            isDefault: true,
            deletedAt: null,
            id: { not: id },
          },
          data: { isDefault: false, version: { increment: 1 }, syncState: 'pending' },
        });
      }
      return tx.tax.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.ratePermille !== undefined ? { ratePermille: dto.ratePermille } : {}),
          ...(dto.isDefault !== undefined ? { isDefault: dto.isDefault } : {}),
          version: { increment: 1 },
          syncState: 'pending',
        },
      });
    });
    await this.audit.record({
      branchId: user.branchId,
      action: 'tax.update',
      entityType: 'tax',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      newValue: after,
      ...this.provenance(user),
    });
    return after;
  }

  async deleteTax(user: AuthUser, id: string) {
    const before = await this.taxOrThrow(user.branchId, id);
    const inUse = await this.prisma.product.count({
      where: { branchId: user.branchId, taxId: id, deletedAt: null },
    });
    if (inUse > 0) {
      throw new ConflictException({
        code: 'TAX_IN_USE',
        message: 'Urun tarafindan kullanilan vergi silinemez.',
      });
    }
    const after = await this.softDelete('tax', id);
    await this.audit.record({
      branchId: user.branchId,
      action: 'tax.delete',
      entityType: 'tax',
      entityId: id,
      userId: user.userId,
      oldValue: before,
      ...this.provenance(user),
    });
    return after;
  }

  // ===========================================================================
  // Ortak yardimcilar
  // ===========================================================================
  private async categoryOrThrow(branchId: string, id: string) {
    const row = await this.prisma.category.findFirst({
      where: { id, branchId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({ code: 'CATEGORY_NOT_FOUND', message: 'Kategori bulunamadi.' });
    }
    return row;
  }

  private async productOrThrow(branchId: string, id: string) {
    const row = await this.prisma.product.findFirst({
      where: { id, branchId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({ code: 'PRODUCT_NOT_FOUND', message: 'Urun bulunamadi.' });
    }
    return row;
  }

  private async unitOrThrow(branchId: string, id: string) {
    const row = await this.prisma.unit.findFirst({
      where: { id, branchId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({ code: 'UNIT_NOT_FOUND', message: 'Birim bulunamadi.' });
    }
    return row;
  }

  private async taxOrThrow(branchId: string, id: string) {
    const row = await this.prisma.tax.findFirst({
      where: { id, branchId, deletedAt: null },
    });
    if (!row) {
      throw new NotFoundException({ code: 'TAX_NOT_FOUND', message: 'Vergi bulunamadi.' });
    }
    return row;
  }

  // Urun FK'lari (kategori/birim/vergi zorunlu, marka opsiyonel) ayni branch'te mi?
  private async assertProductRefs(
    branchId: string,
    categoryId?: string,
    unitId?: string,
    taxId?: string,
    brandId?: string | null,
  ): Promise<void> {
    if (categoryId !== undefined) await this.categoryOrThrow(branchId, categoryId);
    if (unitId !== undefined) await this.unitOrThrow(branchId, unitId);
    if (taxId !== undefined) await this.taxOrThrow(branchId, taxId);
    if (brandId) {
      const brand = await this.prisma.brand.findFirst({
        where: { id: brandId, branchId, deletedAt: null },
      });
      if (!brand) {
        throw new NotFoundException({ code: 'BRAND_NOT_FOUND', message: 'Marka bulunamadi.' });
      }
    }
  }

  // Ortak soft-delete: deletedAt + version++ + syncState.
  private softDelete(model: 'category' | 'product' | 'unit' | 'tax', id: string) {
    const data = {
      deletedAt: new Date(),
      version: { increment: 1 },
      syncState: 'pending',
    };
    switch (model) {
      case 'category':
        return this.prisma.category.update({ where: { id }, data });
      case 'product':
        return this.prisma.product.update({ where: { id }, data });
      case 'unit':
        return this.prisma.unit.update({ where: { id }, data });
      case 'tax':
        return this.prisma.tax.update({ where: { id }, data });
    }
  }
}
