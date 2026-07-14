import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Govde/parametreyi Zod semasiyla dogrular. Hata ZodError firlatir ->
 * AllExceptionsFilter 422'ye cevirir. Tek sema kaynagi (backend+frontend).
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    return this.schema.parse(value);
  }
}
