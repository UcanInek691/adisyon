import { Global, Module } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

/** Global config modulu; AppConfigService her yerde enjekte edilebilir. */
@Global()
@Module({
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class ConfigModule {}
