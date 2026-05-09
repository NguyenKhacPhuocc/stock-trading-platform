import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { AppErrorKey } from '../errors/error-const';
import { resolveAppError } from '../errors/error-message';

/** Lỗi cùng envelope: s ≠ ok, ec mã lỗi (thường = HTTP status), em = thông báo */
export type ApiErrorEnvelope = {
  s: 'error';
  ec: number | string;
  em: string;
  d: null;
};

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const rawMessage =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Lỗi máy chủ nội bộ';

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url}`,
        exception as Error,
      );
    }

    const body = this.buildErrorEnvelope({
      status,
      request,
      source: rawMessage,
    });

    response.status(status).json(body);
  }

  private buildErrorEnvelope(args: {
    status: number;
    request: Request;
    source: unknown;
  }): ApiErrorEnvelope {
    const locale = this.resolveLocale(args.request);
    if (typeof args.source === 'object' && args.source !== null) {
      const rec = args.source as Record<string, unknown>;
      const appErrorKey = rec.appErrorKey;
      if (typeof appErrorKey === 'string') {
        const resolved = resolveAppError({
          key: appErrorKey as AppErrorKey,
          locale,
          params:
            typeof rec.appErrorParams === 'object' && rec.appErrorParams
              ? (rec.appErrorParams as Record<string, string | number | undefined>)
              : undefined,
        });
        return {
          s: 'error',
          ec: resolved.ec,
          em: resolved.em,
          d: null,
        };
      }
    }
    return {
      s: 'error',
      ec: args.status,
      em: this.extractMessage(args.source),
      d: null,
    };
  }

  private resolveLocale(request: Request): 'vi' | 'en' {
    const header = request.headers['accept-language'];
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) return 'vi';
    return raw.toLowerCase().startsWith('en') ? 'en' : 'vi';
  }

  private extractMessage(source: unknown): string {
    if (typeof source === 'string') return source;
    if (typeof source === 'object' && source !== null) {
      const rec = source as Record<string, unknown>;
      if ('message' in rec) {
        const value = rec.message;
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) {
          return value.map((x) => String(x)).join('; ');
        }
      }
    }
    return 'Lỗi máy chủ nội bộ';
  }
}
