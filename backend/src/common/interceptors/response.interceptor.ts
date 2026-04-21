import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Envelope thống nhất cho mọi API (kiểu broker): s / ec / em / d */
export type ApiEnvelope<T> = {
  s: 'ok';
  ec: 0;
  em: '';
  d: T;
};

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiEnvelope<T | null>
> {
  intercept(
    _ctx: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiEnvelope<T | null>> {
    return next.handle().pipe(
      map((data: T) => ({
        s: 'ok',
        ec: 0,
        em: '',
        d: (data ?? null) as T | null,
      })),
    );
  }
}
