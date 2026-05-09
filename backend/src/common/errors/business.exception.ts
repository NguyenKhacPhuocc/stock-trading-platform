import { HttpException, HttpStatus } from '@nestjs/common';
import type { AppErrorKey } from './error-const';

type BusinessErrorPayload = {
  appErrorKey: AppErrorKey;
  appErrorParams?: Record<string, string | number | undefined>;
};

export class BusinessException extends HttpException {
  constructor(
    appErrorKey: AppErrorKey,
    appErrorParams?: Record<string, string | number | undefined>,
    httpStatus: number = HttpStatus.BAD_REQUEST,
  ) {
    const payload: BusinessErrorPayload = { appErrorKey, appErrorParams };
    super(payload, httpStatus);
  }
}
