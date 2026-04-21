import { createParamDecorator, ExecutionContext } from '@nestjs/common';

interface RequestWithUser<TUser = unknown> {
  user?: TUser;
}

// Lấy user hiện tại từ JWT payload đã xác thực
export const CurrentUser = createParamDecorator(
  <T = unknown>(_data: unknown, ctx: ExecutionContext): T | undefined => {
    const request = ctx
      .switchToHttp()
      .getRequest<RequestWithUser<T> | undefined>();
    return request?.user;
  },
);
