import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../const';
import { ROLES_KEY } from '../decorators/roles.decorator';

interface RequestWithUser {
  user?: { role?: UserRole };
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredRoles) return true;

    const request = context
      .switchToHttp()
      .getRequest<RequestWithUser | undefined>();
    const role = request?.user?.role;

    return role !== undefined && requiredRoles.includes(role);
  }
}
