import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { networkInterfaces } from 'node:os';
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

  // Garsonun tablette gireceği sunucu adresi(leri). IP degisirse buradan gorulur.
  @Get('server-info')
  serverInfo() {
    const port = Number(process.env.API_PORT) || 3001;
    const addresses: string[] = [];
    for (const iface of Object.values(networkInterfaces())) {
      for (const net of iface ?? []) {
        if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
      }
    }
    return { port, addresses, urls: addresses.map((a) => `http://${a}:${port}`) };
  }

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
