import { Controller, Get } from '@nestjs/common';
import { RequirePermissions } from '../decorators/permissions.decorator';
import { Permission } from '@ado/shared';
import { FeatureFlagService } from './feature-flags.service';

@Controller('settings/feature-flags')
export class FeatureFlagsController {
  constructor(private readonly featureFlagsService: FeatureFlagService) {}

  @Get()
  @RequirePermissions(Permission.SettingsManage)
  async getFlags() {
    const flags = await this.featureFlagsService.getAllFlags();
    return { success: true, data: flags };
  }
}
