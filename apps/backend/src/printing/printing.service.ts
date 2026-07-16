import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { newId, PrintJobStatus, DocumentType } from '@ado/shared';
import { PrismaService } from '../prisma/prisma.service';
import { BackgroundWorkerService } from '../common/worker/worker.service';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import type {
  CreatePrinterDto,
  UpdatePrinterDto,
  CreatePrintRouteDto,
} from './dto/printing.schemas';

export interface PrinterDriver {
  print(payload: any, connection: string, address: string | null): Promise<void>;
  discover(): Promise<any[]>;
  getCapabilities(): any;
}

class MockPrinterDriver implements PrinterDriver {
  private readonly logger = new Logger(MockPrinterDriver.name);

  async print(payload: any, connection: string, address: string | null): Promise<void> {
    this.logger.log(`[PRINT SIMULATION] connection=${connection}, address=${address}`);
    this.logger.log(`[PRINT CONTENT] ${JSON.stringify(payload, null, 2)}`);
  }

  async discover(): Promise<any[]> {
    return [{ id: 'mock-usb-1', name: 'Mock USB Thermal Printer' }];
  }

  getCapabilities() {
    return { cutter: true, drawer: true, qr: true };
  }
}

@Injectable()
export class PrintingService implements OnModuleInit {
  private readonly logger = new Logger(PrintingService.name);
  private readonly drivers = new Map<string, PrinterDriver>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly worker: BackgroundWorkerService,
  ) {}

  onModuleInit() {
    // Referans sürücüyü kaydet
    this.drivers.set('escpos-mock', new MockPrinterDriver());
    this.logger.log('Printer drivers initialized.');

    // Arka plan iş kuyruğu dinleyicisini kaydet
    this.worker.registerHandler(
      'print.job',
      async (payload: { jobId: string }, _branchId: string) => {
        await this.executePrintJob(payload.jobId);
      },
    );
  }

  // ===========================================================================
  // Printer CRUD
  // ===========================================================================
  async createPrinter(user: AuthUser, dto: CreatePrinterDto) {
    const id = newId();

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        // Diğer varsayılanları kaldır
        await tx.printer.updateMany({
          where: { branchId: user.branchId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.printer.create({
        data: {
          id,
          branchId: user.branchId,
          name: dto.name,
          driverId: dto.driverId,
          connection: dto.connection,
          address: dto.address ?? null,
          paperWidth: dto.paperWidth,
          isDefault: dto.isDefault,
          capabilities: dto.capabilities ?? null,
          isActive: dto.isActive,
          deviceId: user.deviceId ?? null,
        },
      });
    });
  }

  async updatePrinter(user: AuthUser, id: string, dto: UpdatePrinterDto) {
    const printer = await this.prisma.printer.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!printer) throw new NotFoundException('Yazıcı bulunamadı.');

    return this.prisma.$transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.printer.updateMany({
          where: { branchId: user.branchId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }

      const data: any = {
        version: { increment: 1 },
      };
      if (dto.name !== undefined) data.name = dto.name;
      if (dto.driverId !== undefined) data.driverId = dto.driverId;
      if (dto.connection !== undefined) data.connection = dto.connection;
      if (dto.address !== undefined) data.address = dto.address ?? null;
      if (dto.paperWidth !== undefined) data.paperWidth = dto.paperWidth;
      if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
      if (dto.capabilities !== undefined) data.capabilities = dto.capabilities ?? null;
      if (dto.isActive !== undefined) data.isActive = dto.isActive;

      return tx.printer.update({
        where: { id },
        data,
      });
    });
  }

  async deletePrinter(user: AuthUser, id: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!printer) throw new NotFoundException('Yazıcı bulunamadı.');

    await this.prisma.printer.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { success: true };
  }

  async listPrinters(user: AuthUser) {
    return this.prisma.printer.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      orderBy: { name: 'asc' },
    });
  }

  // ===========================================================================
  // Print Route CRUD
  // ===========================================================================
  async createRoute(user: AuthUser, dto: CreatePrintRouteDto) {
    // Yazıcıyı doğrula
    const printer = await this.prisma.printer.findFirst({
      where: { id: dto.printerId, branchId: user.branchId, deletedAt: null },
    });
    if (!printer) throw new NotFoundException('Yazıcı bulunamadı.');

    // Çakışan rotayı kontrol et
    const existing = await this.prisma.printRoute.findFirst({
      where: {
        branchId: user.branchId,
        documentType: dto.documentType,
        categoryId: dto.categoryId ?? null,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new ConflictException('Bu rota tipi için zaten bir yönlendirme tanımlı.');
    }

    const id = newId();
    return this.prisma.printRoute.create({
      data: {
        id,
        branchId: user.branchId,
        documentType: dto.documentType,
        printerId: dto.printerId,
        categoryId: dto.categoryId ?? null,
        deviceId: user.deviceId ?? null,
      },
    });
  }

  async deleteRoute(user: AuthUser, id: string) {
    const route = await this.prisma.printRoute.findFirst({
      where: { id, branchId: user.branchId, deletedAt: null },
    });
    if (!route) throw new NotFoundException('Rota bulunamadı.');

    await this.prisma.printRoute.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        version: { increment: 1 },
      },
    });
    return { success: true };
  }

  async listRoutes(user: AuthUser) {
    return this.prisma.printRoute.findMany({
      where: { branchId: user.branchId, deletedAt: null },
      include: { printer: true },
    });
  }

  // ===========================================================================
  // Print Job Lifecycle
  // ===========================================================================
  async enqueuePrintJob(
    branchId: string,
    printerId: string,
    documentType: string,
    payload: any,
    createdBy: string,
  ): Promise<string> {
    const id = newId();

    await this.prisma.printJob.create({
      data: {
        id,
        branchId,
        printerId,
        documentType,
        payload: JSON.stringify(payload),
        status: PrintJobStatus.Queued,
        createdBy,
      },
    });

    // Worker'a gönder
    await this.worker.enqueue(branchId, 'print.job', { jobId: id });
    return id;
  }

  private async executePrintJob(jobId: string) {
    const job = await this.prisma.printJob.findUnique({
      where: { id: jobId },
      include: { printer: true },
    });

    if (!job || job.status === PrintJobStatus.Done) return;

    await this.prisma.printJob.update({
      where: { id: jobId },
      data: { status: PrintJobStatus.Printing, attempts: { increment: 1 } },
    });

    const driver = this.drivers.get(job.printer.driverId);
    if (!driver) {
      const errorMsg = `Driver not found for printing: ${job.printer.driverId}`;
      this.logger.error(errorMsg);
      await this.prisma.printJob.update({
        where: { id: jobId },
        data: { status: PrintJobStatus.Failed, lastError: errorMsg },
      });
      throw new Error(errorMsg);
    }

    try {
      const parsedPayload = JSON.parse(job.payload);
      await driver.print(parsedPayload, job.printer.connection, job.printer.address);

      await this.prisma.printJob.update({
        where: { id: jobId },
        data: { status: PrintJobStatus.Done, printedAt: new Date() },
      });
    } catch (err: any) {
      const errorMsg = err?.message || String(err);
      await this.prisma.printJob.update({
        where: { id: jobId },
        data: { status: PrintJobStatus.Failed, lastError: errorMsg },
      });
      throw err;
    }
  }

  // ===========================================================================
  // Domain Event Abonesi
  // ===========================================================================
  @OnEvent('order.paid', { async: true })
  async handleOrderPaid(event: any) {
    const { orderId } = event.payload;
    this.logger.log(`Received order.paid event for order: ${orderId}`);

    // Sipariş verilerini DB'den çek (iptal/silinmiş kalemler fişe girmez)
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          where: { deletedAt: null, status: { not: 'cancelled' } },
          include: { product: true },
        },
      },
    });

    if (!order) {
      this.logger.error(`Order not found for printing receipt: ${orderId}`);
      return;
    }

    // order.paid her ödemede yayınlanır; müşteri fişi yalnız adisyon tamamen
    // ödenince (split'in son ödemesi) bir kez basılır — mükerrer fiş önlenir.
    if (!order.isPaid) return;

    // İlgili rotayı bul
    const route = await this.prisma.printRoute.findFirst({
      where: { branchId: event.branchId, documentType: DocumentType.Customer, deletedAt: null },
    });

    // Rota yoksa varsayılan yazıcıyı bul
    let printerId = route?.printerId;
    if (!printerId) {
      const defaultPrinter = await this.prisma.printer.findFirst({
        where: { branchId: event.branchId, isDefault: true, deletedAt: null },
      });
      printerId = defaultPrinter?.id;
    }

    if (!printerId) {
      this.logger.warn(
        `No print route or default printer configured for customer receipts in branch ${event.branchId}`,
      );
      return;
    }

    // Fiş içeriğini derle (PrintDocument yapısı)
    const printDoc = {
      title: 'MÜŞTERİ BİLGİ FİŞİ',
      orderNo: order.orderNo,
      date: order.openedAt.toISOString(),
      items: order.items.map((item: any) => ({
        name: item.productNameSnapshot || item.product.name,
        quantity: item.quantity / 1000,
        price: item.unitPrice / 100,
        total: item.lineTotal / 100,
      })),
      discount: (order.discountTotal || 0) / 100,
      grandTotal: (order.grandTotal || 0) / 100,
    };

    await this.enqueuePrintJob(
      event.branchId,
      printerId,
      DocumentType.Customer,
      printDoc,
      event.actorId || 'system',
    );
    await this.persistReceipt(order.id, order.orderNo, DocumentType.Customer, printerId, printDoc);
  }

  @OnEvent('order.item.sent', { async: true })
  async handleOrderItemSent(event: any) {
    const { orderId, items } = event.payload;
    this.logger.log(`Received order.item.sent for order: ${orderId} (${items.length} kalem)`);

    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      this.logger.error(`Order not found for kitchen ticket: ${orderId}`);
      return;
    }

    // Mutfak rotası → yoksa varsayılan yazıcı.
    const route = await this.prisma.printRoute.findFirst({
      where: { branchId: event.branchId, documentType: DocumentType.Kitchen, deletedAt: null },
    });
    let printerId = route?.printerId;
    if (!printerId) {
      const def = await this.prisma.printer.findFirst({
        where: { branchId: event.branchId, isDefault: true, deletedAt: null },
      });
      printerId = def?.id;
    }
    if (!printerId) {
      this.logger.warn(`No kitchen route or default printer for branch ${event.branchId}`);
      return;
    }

    // ponytail: bar/mutfak kategoriye göre ayrım sonraki iş; şimdilik hepsi mutfak fişi.
    const printDoc = {
      title: 'MUTFAK FİŞİ',
      orderNo: order.orderNo,
      date: new Date().toISOString(),
      items: items.map((i: { productName: string; quantity: number }) => ({
        name: i.productName,
        quantity: i.quantity / 1000,
      })),
    };

    await this.enqueuePrintJob(
      event.branchId,
      printerId,
      DocumentType.Kitchen,
      printDoc,
      event.actorId || 'system',
    );
    await this.persistReceipt(order.id, order.orderNo, DocumentType.Kitchen, printerId, printDoc);
  }

  // Basılan fişi kalıcı kaydeder (reprint + audit için). receiptNo: orderNo-<tip><sıra>.
  private async persistReceipt(
    orderId: string,
    orderNo: string,
    type: string,
    printerId: string,
    content: unknown,
  ): Promise<void> {
    const seq = await this.prisma.receipt.count({ where: { orderId, type } });
    await this.prisma.receipt.create({
      data: {
        id: newId(),
        orderId,
        receiptNo: `${orderNo}-${type[0]!.toUpperCase()}${seq + 1}`,
        type,
        printedAt: new Date(),
        printerId,
        contentSnapshot: JSON.stringify(content),
      },
    });
  }
}
