import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('sales/daily')
  @RequirePermissions(Permission.ReportView)
  getDailySales(
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.reportsService.getDailySales(
      user,
      start || new Date().toISOString(),
      end || new Date().toISOString(),
    );
  }

  @Get('sales/products')
  @RequirePermissions(Permission.ReportView)
  getProductSales(
    @CurrentUser() user: AuthUser,
    @Query('start') start: string,
    @Query('end') end: string,
  ) {
    return this.reportsService.getProductSales(
      user,
      start || new Date().toISOString(),
      end || new Date().toISOString(),
    );
  }

  // Gun sonu (Z) ozeti. date=YYYY-MM-DD (yoksa bugunun is-gunu).
  @Get('end-of-day')
  @RequirePermissions(Permission.ReportView)
  getEndOfDay(@CurrentUser() user: AuthUser, @Query('date') date: string) {
    return this.reportsService.getEndOfDay(user, date || '');
  }

  // Ara rapor (X): acik kasa oturumunun anlik ozeti (kasayi kapatmaz).
  @Get('shift')
  @RequirePermissions(Permission.ReportView)
  getShiftReport(@CurrentUser() user: AuthUser) {
    return this.reportsService.getShiftReport(user);
  }

  // Gun sonu gecmisi: kapanmis kasa oturumlari (saklanan Z rakamlari).
  @Get('end-of-day/history')
  @RequirePermissions(Permission.ReportView)
  getEndOfDayHistory(@CurrentUser() user: AuthUser) {
    return this.reportsService.getEndOfDayHistory(user);
  }

  @Get('customers/debt')
  @RequirePermissions(Permission.ReportView)
  getCustomerDebts(@CurrentUser() user: AuthUser) {
    return this.reportsService.getCustomerDebts(user);
  }

  @Get('inventory/stock')
  @RequirePermissions(Permission.ReportView)
  getInventoryStocks(@CurrentUser() user: AuthUser) {
    return this.reportsService.getInventoryStocks(user);
  }
}
