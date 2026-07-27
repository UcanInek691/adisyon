import { Body, Controller, Get, Post } from '@nestjs/common';
import { z } from 'zod';
import { Permission } from '@ado/shared';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { LicenseService } from './license.service';

const activateSchema = z.object({ licenseKey: z.string().min(20).max(4096) });
type ActivateDto = z.infer<typeof activateSchema>;

@Controller('license')
export class LicenseController {
  constructor(private readonly license: LicenseService) {}

  // Durumu her giris yapmis kullanici gorebilir (uyari seridi icin); yalnizca
  // ETKINLESTIRME sahiplik izni ister.
  @Get()
  getStatus(@CurrentUser() user: AuthUser) {
    return this.license.getStatus(user.branchId);
  }

  @Post('activate')
  @RequirePermissions(Permission.LicenseManage)
  activate(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(activateSchema)) dto: ActivateDto,
  ) {
    return this.license.activate(user, dto.licenseKey);
  }
}
