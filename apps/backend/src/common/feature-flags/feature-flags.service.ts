import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class FeatureFlagService implements OnModuleInit {
  private readonly logger = new Logger(FeatureFlagService.name);
  private cachedFlags: Record<string, boolean> = {};
  private isLoaded = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.reloadFlags();
  }

  async reloadFlags() {
    try {
      const license = await this.prisma.licenseInfo.findFirst({
        where: { deletedAt: null },
      });

      if (!license || !license.features) {
        this.cachedFlags = {};
      } else {
        this.cachedFlags = JSON.parse(license.features);
      }
      this.isLoaded = true;
      this.logger.log(`Loaded feature flags: ${JSON.stringify(this.cachedFlags)}`);
    } catch (err) {
      this.logger.error('Failed to load feature flags from license info', err);
      this.cachedFlags = {};
    }
  }

  async isEnabled(featureKey: string): Promise<boolean> {
    if (!this.isLoaded) {
      await this.reloadFlags();
    }
    return !!this.cachedFlags[featureKey];
  }

  async getAllFlags(): Promise<Record<string, boolean>> {
    if (!this.isLoaded) {
      await this.reloadFlags();
    }
    return this.cachedFlags;
  }
}
