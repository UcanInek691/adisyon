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
