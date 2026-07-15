import { Global, Module } from '@nestjs/common';
import { FeatureFlagService } from './feature-flags.service';
import { FeatureFlagsController } from './feature-flags.controller';

@Global()
@Module({
  providers: [FeatureFlagService],
  controllers: [FeatureFlagsController],
  exports: [FeatureFlagService],
})
export class FeatureFlagsModule {}
