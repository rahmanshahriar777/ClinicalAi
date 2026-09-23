import type { Permission } from '@app/shared';
import { createParamDecorator, type ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

import type { RequestUser } from '../../modules/auth/auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
/** Skip authentication for this handler (health checks, login, registration). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const PERMISSIONS_KEY = 'permissions';
/** Require every listed permission (blueprint §11.2). Row-level checks are done in services. */
export const RequirePermissions = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);

/** Injects the authenticated user attached by JwtAuthGuard. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestUser => {
  const req = ctx.switchToHttp().getRequest<Request & { user: RequestUser }>();
  return req.user;
});

export interface ClientInfo {
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

/** Injects request metadata used for audit logging. */
export const Client = createParamDecorator((_data: unknown, ctx: ExecutionContext): ClientInfo => {
  const req = ctx.switchToHttp().getRequest<Request & { id?: string }>();
  return {
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'],
    requestId: (req.headers['x-request-id'] as string | undefined) ?? req.id,
  };
});
