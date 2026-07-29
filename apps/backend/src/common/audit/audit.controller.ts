import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { CurrentUser, type AuthUser } from '../decorators/current-user.decorator';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { AuditService } from './audit.service';

/**
 * Denetim kaydi okuma ucu (raporlar > kayit gecmisi).
 * Silinen/eklenen/degistirilen her sey (urun, kategori, siparis, ayar...) burada.
 */
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions(Permission.ReportView)
  list(
    @CurrentUser() user: AuthUser,
    @Query('entityType') entityType?: string,
    @Query('action') action?: string,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
  ) {
    return this.audit.list(user.branchId, {
      ...(entityType ? { entityType } : {}),
      ...(action ? { action } : {}),
      ...(userId ? { userId } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      ...(limit ? { limit: Number(limit) } : {}),
    });
  }

  @Get('verify')
  @RequirePermissions(Permission.AuditView)
  verify(@CurrentUser() user: AuthUser) {
    return this.audit.verify(user.branchId);
  }
}
