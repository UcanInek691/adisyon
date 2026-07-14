import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';

/** Global denetim modulu; AuditService her modulde enjekte edilebilir. */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
