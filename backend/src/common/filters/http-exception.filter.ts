import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/** Lỗi cùng envelope: s ≠ ok, ec mã lỗi (thường = HTTP status), em = thông báo */
export type ApiErrorEnvelope = {
  s: 'error';
  ec: number;
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

    const body: ApiErrorEnvelope = {
      s: 'error',
      ec: status,
      em: this.extractMessage(rawMessage),
      d: null,
    };

    response.status(status).json(body);
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
