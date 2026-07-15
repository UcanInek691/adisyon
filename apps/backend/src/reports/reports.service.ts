import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDailySales(user: AuthUser, start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Completed orders count and sum
    const ordersSummary = await this.prisma.order.aggregate({
      where: {
        branchId: user.branchId,
        status: 'completed',
        openedAt: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _count: { id: true },
      _sum: { grandTotal: true, discountTotal: true },
    });

    // Payments by method
    const paymentsByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: { branchId: user.branchId },
        paidAt: { gte: startDate, lte: endDate },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    // Sales by product categories
    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          branchId: user.branchId,
          status: 'completed',
          openedAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        product: { include: { category: true } },
      },
    });

    const categoryBreakdown: Record<string, number> = {};
    for (const item of items) {
      const catName = item.product?.category?.name || 'Kategorisiz';
      categoryBreakdown[catName] = (categoryBreakdown[catName] || 0) + item.lineTotal;
    }

    return {
      salesCount: ordersSummary._count.id || 0,
      salesTotalKurus: ordersSummary._sum.grandTotal || 0,
      discountTotalKurus: ordersSummary._sum.discountTotal || 0,
      payments: paymentsByMethod.map((p) => ({
        method: p.method,
        totalKurus: p._sum.amount || 0,
      })),
      categoryBreakdown: Object.entries(categoryBreakdown).map(([category, totalKurus]) => ({
        category,
        totalKurus,
      })),
    };
  }

  async getProductSales(user: AuthUser, start: string, end: string) {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const items = await this.prisma.orderItem.findMany({
      where: {
        order: {
          branchId: user.branchId,
          status: 'completed',
          openedAt: { gte: startDate, lte: endDate },
          deletedAt: null,
        },
        deletedAt: null,
      },
      include: {
        product: true,
      },
    });

    const productSales: Record<
      string,
      { name: string; quantityMilis: number; totalKurus: number }
    > = {};
    for (const item of items) {
      const prodId = item.productId;
      if (!productSales[prodId]) {
        productSales[prodId] = {
          name: item.productNameSnapshot || item.product.name,
          quantityMilis: 0,
          totalKurus: 0,
        };
      }
      productSales[prodId].quantityMilis += item.quantity;
      productSales[prodId].totalKurus += item.lineTotal;
    }

    return Object.values(productSales).sort((a, b) => b.totalKurus - a.totalKurus);
  }

  async getCustomerDebts(user: AuthUser) {
    const accounts = await this.prisma.debtAccount.findMany({
      where: {
        customer: { branchId: user.branchId, isActive: true, deletedAt: null },
      },
      include: {
        customer: true,
      },
    });

    return accounts
      .map((acc) => ({
        customerId: acc.customerId,
        customerName: acc.customer.name,
        phone: acc.customer.phone,
        balanceKurus: acc.balance,
      }))
      .sort((a, b) => b.balanceKurus - a.balanceKurus);
  }

  async getInventoryStocks(user: AuthUser) {
    const products = await this.prisma.product.findMany({
      where: {
        branchId: user.branchId,
        trackStock: true,
        deletedAt: null,
      },
      include: {
        unit: true,
        stockMovements: {
          where: { deletedAt: null },
        },
      },
    });

    return products.map((prod) => {
      const currentStockMilis = prod.stockMovements.reduce((sum, mov) => sum + mov.quantity, 0);
      return {
        productId: prod.id,
        name: prod.name,
        unit: prod.unit.name,
        minStockMilis: prod.minStock,
        currentStockMilis,
        costPriceKurus: prod.purchasePrice,
        stockValueKurus: (currentStockMilis / 1000) * prod.purchasePrice,
      };
    });
  }
}
