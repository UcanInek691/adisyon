import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { map, type Observable } from 'rxjs';

/** Basarili yanitlari ortak zarfa sarar. API_DESIGN.md §2. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<Request & { id?: string }>();
    return next.handle().pipe(
      map((data: unknown) => ({
        success: true,
        data: data ?? null,
        meta: {
          requestId: req.id ?? null,
          serverTime: new Date().toISOString(),
        },
      })),
    );
  }
}
