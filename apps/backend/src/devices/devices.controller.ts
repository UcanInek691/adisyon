import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { Permission } from '@ado/shared';
import { DevicesService } from './devices.service';
import { ZodValidationPipe } from '../common/http/zod-validation.pipe';
import { RequirePermissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import {
  registerDeviceSchema,
  trustDeviceSchema,
  type RegisterDeviceDto,
  type TrustDeviceDto,
} from './dto/devices.schemas';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devices: DevicesService) {}

  @Post()
  @RequirePermissions(Permission.SettingsManage)
  register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(registerDeviceSchema)) dto: RegisterDeviceDto,
  ) {
    return this.devices.register(user, dto);
  }

  @Get()
  @RequirePermissions(Permission.SettingsManage)
  list(@CurrentUser() user: AuthUser) {
    return this.devices.list(user);
  }

  @Patch(':id/trust')
  @RequirePermissions(Permission.SettingsManage)
  setTrust(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(new ZodValidationPipe(trustDeviceSchema)) dto: TrustDeviceDto,
  ) {
    return this.devices.setTrust(user, id, dto.isTrusted);
  }

  @Delete(':id')
  @RequirePermissions(Permission.SettingsManage)
  remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.devices.remove(user, id);
  }
}
