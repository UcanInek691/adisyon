import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { businessDayWindow } from './reports.calc';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Gun sonu (Z) ozeti: tek is-gunu icin satis + odeme + kasa oturumu + gider/gelir.
  // Sahibin gunu kapatirken okudugu tek rapor. Veresiye ayri raporda (customers/debt).
  async getEndOfDay(user: AuthUser, date: string) {
    const { day, start, end } = businessDayWindow(date);

    const ordersSummary = await this.prisma.order.aggregate({
      where: {
        branchId: user.branchId,
        status: 'completed',
        openedAt: { gte: start, lt: end },
        deletedAt: null,
      },
      _count: { id: true },
      _sum: { subtotal: true, discountTotal: true, grandTotal: true },
    });

    const paymentsByMethod = await this.prisma.payment.groupBy({
      by: ['method'],
      where: {
        order: { branchId: user.branchId },
        paidAt: { gte: start, lt: end },
        deletedAt: null,
      },
      _sum: { amount: true },
    });

    const sessions = await this.prisma.cashSession.findMany({
      where: { branchId: user.branchId, businessDay: day, deletedAt: null },
      orderBy: { openedAt: 'asc' },
    });

    const expenses = await this.prisma.expense.aggregate({
      where: { branchId: user.branchId, spentAt: { gte: start, lt: end }, deletedAt: null },
      _sum: { amount: true },
    });
    const incomes = await this.prisma.income.aggregate({
      where: { branchId: user.branchId, receivedAt: { gte: start, lt: end }, deletedAt: null },
      _sum: { amount: true },
    });

    return {
      businessDay: day,
      sales: {
        count: ordersSummary._count.id || 0,
        grossKurus: ordersSummary._sum.subtotal || 0,
        discountKurus: ordersSummary._sum.discountTotal || 0,
        netKurus: ordersSummary._sum.grandTotal || 0,
      },
      payments: paymentsByMethod.map((p) => ({ method: p.method, totalKurus: p._sum.amount || 0 })),
      cash: {
        sessions: sessions.map((s) => ({
          id: s.id,
          status: s.status,
          openedAt: s.openedAt,
          closedAt: s.closedAt,
          openingFloatKurus: s.openingFloat,
          expectedKurus: s.expectedAmount,
          countedKurus: s.countedAmount,
          differenceKurus: s.difference,
        })),
        differenceTotalKurus: sessions.reduce((sum, s) => sum + (s.difference ?? 0), 0),
      },
      expensesKurus: expenses._sum.amount || 0,
      incomesKurus: incomes._sum.amount || 0,
    };
  }

  // Gun sonu gecmisi: kapanmis kasa oturumlarini (her biri bir gun-sonu kaydi)
  // saklanan Z rakamlariyla listeler. Recompute yok -> kapanista dondurulan
  // beklenen/sayilan/fark aynen okunur. Detay icin getEndOfDay(businessDay).
  async getEndOfDayHistory(user: AuthUser, limit = 90) {
    const sessions = await this.prisma.cashSession.findMany({
      where: { branchId: user.branchId, status: 'closed', deletedAt: null },
      orderBy: { closedAt: 'desc' },
      take: limit,
    });
    return sessions.map((s) => ({
      id: s.id,
      businessDay: s.businessDay,
      openedAt: s.openedAt,
      closedAt: s.closedAt,
      openingFloatKurus: s.openingFloat,
      expectedKurus: s.expectedAmount ?? 0,
      countedKurus: s.countedAmount ?? 0,
      differenceKurus: s.difference ?? 0,
    }));
  }

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
        status: { not: 'cancelled' }, // void edilmis kalem satisa sayilmaz
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
        status: { not: 'cancelled' }, // void edilmis kalem satisa sayilmaz
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
