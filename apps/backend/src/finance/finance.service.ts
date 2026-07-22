import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { newId, CashTxnType } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type {
  CreateExpenseCategoryDto,
  CreateExpenseDto,
  CreateIncomeDto,
} from './dto/finance.schemas';

// Yeni kurulumda gider eklenebilmesi icin sart olan varsayilan kategoriler.
// Gider formu kategori ZORUNLU tutar; hic kategori yoksa gider eklenemez
// (kok neden). catalog.defaults ile ayni desen. Kullanici Ayarlar'dan ekler.
const DEFAULT_EXPENSE_CATEGORIES = [
  'Kira',
  'Personel / Maaş',
  'Elektrik / Su / Doğalgaz',
  'Malzeme / Gıda Alımı',
  'Bakım / Onarım',
  'Diğer',
];

/**
 * Gelir/Gider modulu. Gider kategorileri + gider/gelir kaydi. affectsCash ise
 * acik kasa oturumuna isaretli hareket yazar (Gider -, Gelir +). Kasa kapaliysa
 * yalniz finans kaydi tutulur (cekmece etkilenmez).
 */
@Injectable()
export class FinanceService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  // Acilista: gider-kategorisi tablosu bos olan her sube icin varsayilanlari ekle
  // (catalog.defaults birim/vergi ile ayni mantik). Idempotent (count===0).
  async onModuleInit(): Promise<void> {
    const branches = await this.prisma.branch.findMany({ select: { id: true } });
    for (const { id: branchId } of branches) {
      const count = await this.prisma.expenseCategory.count({
        where: { branchId, deletedAt: null },
      });
      if (count === 0) {
        await this.prisma.expenseCategory.createMany({
          data: DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ id: newId(), branchId, name })),
        });
      }
    }
  }

  createCategory(user: AuthUser, dto: CreateExpenseCategoryDto) {
    return this.prisma.expenseCategory.create({
      data: {
        id: newId(),
        branchId: user.branchId,
        name: dto.name,
        deviceId: user.deviceId ?? null,
      },
    });
  }

  listCategories(user: AuthUser) {
    return this.prisma.expenseCategory.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  async createExpense(user: AuthUser, dto: CreateExpenseDto) {
    const cat = await this.prisma.expenseCategory.findFirst({
      where: { id: dto.categoryId, branchId: user.branchId, deletedAt: null },
    });
    if (!cat) {
      throw new NotFoundException({
        code: 'CATEGORY_NOT_FOUND',
        message: 'Gider kategorisi bulunamadi.',
      });
    }
    const affectsCash = dto.affectsCash ?? true;
    return this.prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          id: newId(),
          branchId: user.branchId,
          categoryId: dto.categoryId,
          amount: dto.amount,
          description: dto.description ?? null,
          spentAt: dto.spentAt ? new Date(dto.spentAt) : new Date(),
          affectsCash,
          createdBy: user.userId,
          deviceId: user.deviceId ?? null,
        },
      });
      if (affectsCash) {
        await this.logCash(tx, user, CashTxnType.Expense, -dto.amount, `Gider: ${cat.name}`);
      }
      return expense;
    });
  }

  listExpenses(user: AuthUser) {
    return this.prisma.expense.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { spentAt: 'desc' },
    });
  }

  async createIncome(user: AuthUser, dto: CreateIncomeDto) {
    const affectsCash = dto.affectsCash ?? true;
    return this.prisma.$transaction(async (tx) => {
      const income = await tx.income.create({
        data: {
          id: newId(),
          branchId: user.branchId,
          category: dto.category ?? null,
          amount: dto.amount,
          description: dto.description ?? null,
          receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
          affectsCash,
          createdBy: user.userId,
          deviceId: user.deviceId ?? null,
        },
      });
      if (affectsCash) {
        await this.logCash(tx, user, CashTxnType.Income, dto.amount, dto.description ?? 'Gelir');
      }
      return income;
    });
  }

  listIncomes(user: AuthUser) {
    return this.prisma.income.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { receivedAt: 'desc' },
    });
  }

  // Acik kasa oturumuna isaretli hareket yaz (yoksa sessizce atla).
  private async logCash(
    tx: Prisma.TransactionClient,
    user: AuthUser,
    type: string,
    amount: number,
    note: string,
  ): Promise<void> {
    const session = await tx.cashSession.findFirst({
      where: { branchId: user.branchId, status: 'open', deletedAt: null },
    });
    if (!session) return;
    await tx.cashTransaction.create({
      data: {
        id: newId(),
        cashSessionId: session.id,
        type,
        amount,
        method: 'cash',
        createdBy: user.userId,
        note,
      },
    });
  }
}
