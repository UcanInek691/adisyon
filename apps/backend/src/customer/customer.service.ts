import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { newId, DebtTxnType, CashTxnType } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type {
  CreateCustomerDto,
  UpdateCustomerDto,
  AddDebtDto,
  PayDebtDto,
} from './dto/customer.schemas';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ===========================================================================
  // Customer CRUD
  // ===========================================================================
  async createCustomer(user: AuthUser, dto: CreateCustomerDto) {
    const id = newId();
    const accountId = newId();

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          id,
          branchId: user.branchId,
          name: dto.name,
          phone: dto.phone ?? null,
          address: dto.address ?? null,
          taxNo: dto.taxNo ?? null,
          nationalId: dto.nationalId ?? null,
          note: dto.note ?? null,
          deviceId: user.deviceId ?? null,
        },
      });

      // Veresiye borç hesabı aç (Debt account)
      await tx.debtAccount.create({
        data: {
          id: accountId,
          customerId: id,
          balance: 0,
          currency: 'TRY',
          deviceId: user.deviceId ?? null,
        },
      });

      return customer;
    });
  }

  async updateCustomer(user: AuthUser, id: string, dto: UpdateCustomerDto) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı.');

    const data: any = {
      version: { increment: 1 },
    };
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.taxNo !== undefined) data.taxNo = dto.taxNo;
    if (dto.nationalId !== undefined) data.nationalId = dto.nationalId;
    if (dto.note !== undefined) data.note = dto.note;

    return this.prisma.customer.update({
      where: { id },
      data,
    });
  }

  async deleteCustomer(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı.');

    await this.prisma.customer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { success: true };
  }

  async listCustomers(user: AuthUser) {
    return this.prisma.customer.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { debtAccount: true },
      orderBy: { name: 'asc' },
    });
  }

  async getCustomer(user: AuthUser, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
      include: {
        debtAccount: {
          include: {
            transactions: {
              where: { deletedAt: null },
              orderBy: { occurredAt: 'desc' },
            },
          },
        },
      },
    });
    if (!customer) throw new NotFoundException('Müşteri bulunamadı.');
    return customer;
  }

  // ===========================================================================
  // Veresiye Borç & Tahsilat İşlemleri
  // ===========================================================================
  async addDebt(user: AuthUser, customerId: string, dto: AddDebtDto) {
    const account = await this.prisma.debtAccount.findUnique({
      where: { customerId },
    });
    if (!account) throw new NotFoundException('Müşteri veresiye hesabı bulunamadı.');

    return this.prisma.$transaction(async (tx) => {
      const txn = await tx.debtTransaction.create({
        data: {
          id: newId(),
          debtAccountId: account.id,
          type: DebtTxnType.DebtAdd,
          amount: dto.amount,
          createdBy: user.userId,
          note: dto.note ?? 'Manuel borç ekleme',
          occurredAt: new Date(),
          deviceId: user.deviceId ?? null,
        },
      });

      await tx.debtAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: dto.amount },
          version: { increment: 1 },
        },
      });

      return txn;
    });
  }

  async payDebt(user: AuthUser, customerId: string, dto: PayDebtDto) {
    const account = await this.prisma.debtAccount.findUnique({
      where: { customerId },
      include: { customer: true },
    });
    if (!account) throw new NotFoundException('Müşteri veresiye hesabı bulunamadı.');

    return this.prisma.$transaction(async (tx) => {
      // 1. Borç ödemesini kaydet
      const txn = await tx.debtTransaction.create({
        data: {
          id: newId(),
          debtAccountId: account.id,
          type: DebtTxnType.Payment,
          amount: -dto.amount, // Ödeme borcu azaltır
          createdBy: user.userId,
          note: dto.note ?? 'Veresiye tahsilatı',
          occurredAt: new Date(),
          deviceId: user.deviceId ?? null,
        },
      });

      // 2. Cari bakiyeyi güncelle
      await tx.debtAccount.update({
        where: { id: account.id },
        data: {
          balance: { decrement: dto.amount },
          version: { increment: 1 },
        },
      });

      // 3. Eğer ödeme Cash veya Card ile yapıldıysa, kasaya girdi olarak ekle
      const activeSession = await tx.cashSession.findFirst({
        where: { branchId: user.branchId, status: 'open', deletedAt: null },
      });

      if (activeSession) {
        await tx.cashTransaction.create({
          data: {
            id: newId(),
            cashSessionId: activeSession.id,
            type: CashTxnType.Income,
            amount: dto.amount,
            method: dto.method,
            createdBy: user.userId,
            note: `${account.customer.name} veresiye tahsilatı`,
            deviceId: user.deviceId ?? null,
          },
        });
      }

      return txn;
    });
  }

  // ===========================================================================
  // Domain Event Listener
  // ===========================================================================
  @OnEvent('order.paid', { async: true })
  async handleOrderPaid(event: any) {
    const { amount, method, orderId, customerId } = event.payload;
    if (method !== 'debt') return;

    if (!customerId) {
      this.logger.error(`Received order.paid event with method 'debt' but no customerId provided for order: ${orderId}`);
      return;
    }

    const account = await this.prisma.debtAccount.findUnique({
      where: { customerId },
    });

    if (!account) {
      this.logger.error(`DebtAccount not found for customer: ${customerId}`);
      return;
    }

    this.logger.log(`Received order.paid (debt) event. Accruing veresiye debt for customer: ${customerId}, order: ${orderId}`);

    await this.prisma.$transaction(async (tx) => {
      await tx.debtTransaction.create({
        data: {
          id: newId(),
          debtAccountId: account.id,
          type: DebtTxnType.DebtAdd,
          amount,
          relatedOrderId: orderId,
          createdBy: event.actorId || 'system',
          note: `Adisyon borç kaydı (Ref No: ${orderId})`,
          occurredAt: new Date(),
          deviceId: event.deviceId ?? null,
        },
      });

      await tx.debtAccount.update({
        where: { id: account.id },
        data: {
          balance: { increment: amount },
          version: { increment: 1 },
        },
      });
    });
  }
}
