import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType, ZodTypeDef } from 'zod';

/**
 * Govde/parametreyi Zod semasiyla dogrular. Hata ZodError firlatir ->
 * AllExceptionsFilter 422'ye cevirir. Tek sema kaynagi (backend+frontend).
 * Girdi tipi cikti tipinden bagimsiz (transform'lu semalar icin, or. query 'true' -> boolean).
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T, ZodTypeDef, unknown>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
