import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { newId, CashTxnType } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type { OpenSessionDto, CloseSessionDto, CreateCashTransactionDto } from './dto/cash.schemas';

@Injectable()
export class CashService {
  private readonly logger = new Logger(CashService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // Cash Session Management
  // ===========================================================================
  async openSession(user: AuthUser, dto: OpenSessionDto) {
    const existing = await this.prisma.cashSession.findFirst({
      where: { branchId: user.branchId, status: 'open', deletedAt: null },
    });
    if (existing) {
      throw new ConflictException('Zaten açık bir kasa oturumu mevcut.');
    }

    const id = newId();
    // İş günü saati (06:00 sınırına göre business day).
    // Örnek: Gece 02:00 ise dünün tarihi iş günü kabul edilir.
    const now = new Date();
    const currentHour = now.getHours();
    const businessDate = new Date(now);
    if (currentHour < 6) {
      businessDate.setDate(businessDate.getDate() - 1);
    }
    const businessDay = businessDate.toISOString().split('T')[0] ?? '';

    return this.prisma.$transaction(async (tx) => {
      const session = await tx.cashSession.create({
        data: {
          id,
          branchId: user.branchId,
          sessionDevice: user.deviceId || 'main-terminal',
          openedBy: user.userId,
          openedAt: now,
          openingFloat: dto.openingFloat,
          status: 'open',
          businessDay,
        },
      });

      // Açılış işlemi için kasa hareketi kaydı (Opening transaction)
      await tx.cashTransaction.create({
        data: {
          id: newId(),
          cashSessionId: id,
          type: CashTxnType.Opening,
          amount: dto.openingFloat,
          method: 'cash',
          createdBy: user.userId,
          note: 'Kasa açılış bakiyesi',
        },
      });

      return session;
    });
  }

  async closeSession(user: AuthUser, dto: CloseSessionDto) {
    const session = await this.prisma.cashSession.findFirst({
      where: { branchId: user.branchId, status: 'open', deletedAt: null },
    });
    if (!session) {
      throw new NotFoundException('Açık kasa oturumu bulunamadı.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Beklenen tutar = Kasa açılış + tüm hareketler
      const txs = await tx.cashTransaction.findMany({
        where: { cashSessionId: session.id, deletedAt: null },
      });

      const totalTransactions = txs.reduce((sum, t) => {
        // Açılış hareketi zaten dahildir. Diğerlerini de topla.
        if (t.type === CashTxnType.Opening) return sum;
        return sum + t.amount;
      }, 0);

      const expectedAmount = session.openingFloat + totalTransactions;
      const difference = dto.countedAmount - expectedAmount;

      // Kapanış hareketi ekle
      await tx.cashTransaction.create({
        data: {
          id: newId(),
          cashSessionId: session.id,
          type: CashTxnType.Closing,
          amount: dto.countedAmount,
          method: 'cash',
          createdBy: user.userId,
          note: `Kasa kapanış sayımı. Fark: ${difference / 100} TL`,
        },
      });

      return tx.cashSession.update({
        where: { id: session.id },
        data: {
          status: 'closed',
          closedAt: new Date(),
          closedBy: user.userId,
          countedAmount: dto.countedAmount,
          expectedAmount,
          difference,
          version: { increment: 1 },
        },
      });
    });
  }

  async getActiveSession(user: AuthUser) {
    const session = await this.prisma.cashSession.findFirst({
      where: { branchId: user.branchId, status: 'open', deletedAt: null },
      include: {
        transactions: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!session) throw new NotFoundException('Aktif kasa oturumu bulunamadı.');
    return session;
  }

  // ===========================================================================
  // Cash Transactions
  // ===========================================================================
  async createTransaction(user: AuthUser, dto: CreateCashTransactionDto) {
    const session = await this.prisma.cashSession.findFirst({
      where: { branchId: user.branchId, status: 'open', deletedAt: null },
    });
    if (!session) {
      throw new ConflictException('İşlem yapabilmek için önce kasa oturumu açmalısınız.');
    }

    return this.prisma.cashTransaction.create({
      data: {
        id: newId(),
        cashSessionId: session.id,
        type: dto.type,
        amount: dto.amount,
        method: dto.method,
        createdBy: user.userId,
        note: dto.note ?? null,
      },
    });
  }

  // ===========================================================================
  // Domain Event Listener
  // ===========================================================================
  @OnEvent('order.paid', { async: true })
  async handleOrderPaid(event: any) {
    const { amount, method, paymentId } = event.payload;
    this.logger.log(
      `Received order.paid event. Logging cash transaction for payment: ${paymentId}`,
    );

    const session = await this.prisma.cashSession.findFirst({
      where: { branchId: event.branchId, status: 'open', deletedAt: null },
    });

    if (!session) {
      this.logger.warn(
        `Received order.paid event but no active CashSession found for branch ${event.branchId}`,
      );
      return;
    }

    await this.prisma.cashTransaction.create({
      data: {
        id: newId(),
        cashSessionId: session.id,
        type: CashTxnType.Sale,
        amount,
        method,
        relatedPaymentId: paymentId,
        createdBy: event.actorId || 'system',
        note: `Sipariş satışı (Ödeme Ref: ${paymentId})`,
      },
    });
  }
}
