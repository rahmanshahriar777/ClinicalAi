import type { Permission } from '@app/shared';
import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY, PERMISSIONS_KEY } from '../../common/decorators';
import { ForbiddenError, UnauthenticatedError } from '../../common/errors/app-error';

import type { RequestUser } from './auth.types';

/** Enforces @RequirePermissions() using the role → permission map from @app/shared. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;
    const required = this.reflector.getAllAndOverride<Permission[] | undefined>(PERMISSIONS_KEY, [ctx.getHandler(), ctx.getClass()]) ?? [];
    if (required.length === 0) return true;
    const user = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>().user;
    if (!user) throw new UnauthenticatedError();
    const missing = required.filter((p) => !user.permissions.includes(p));
    if (missing.length) throw new ForbiddenError(`Missing permission: ${missing.join(', ')}`);
    return true;
  }
}
