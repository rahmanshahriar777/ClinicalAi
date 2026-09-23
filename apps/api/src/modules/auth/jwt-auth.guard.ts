import type { UserRole } from '@app/shared';
import { type CanActivate, type ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { IS_PUBLIC_KEY } from '../../common/decorators';
import { UnauthenticatedError } from '../../common/errors/app-error';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { requestContext } from '../../infra/request-context/request-context';

import { AuthService } from './auth.service';
import type { RequestUser } from './auth.types';
import { TokenService } from './token.service';

const USER_CACHE_TTL_MS = 30_000;

/**
 * Global authentication guard. Resolves the bearer token (local HS256 or IdP
 * JWKS) to a live User row so that deactivation and role changes take effect
 * within seconds even though access tokens are stateless.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  private readonly userCache = new Map<string, { user: RequestUser; expires: number }>();

  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokenService,
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthenticatedError();
    const token = header.slice(7).trim();

    const user = this.env.AUTH_MODE === 'oidc' ? await this.resolveOidc(token) : await this.resolveLocal(token);
    req.user = user;

    const store = requestContext.getStore();
    if (store) Object.assign(store, { userId: user.id, role: user.role, organizationId: user.organizationId });
    return true;
  }

  private async resolveLocal(token: string): Promise<RequestUser> {
    const claims = await this.tokens.verifyLocal(token);
    if (claims.typ !== 'access') throw new UnauthenticatedError('Token cannot be used for API access');
    const user = await this.loadUser({ id: claims.sub });
    if (claims.sid) {
      const session = await this.prisma.session.findUnique({ where: { id: claims.sid }, select: { revokedAt: true } });
      if (!session || session.revokedAt) throw new UnauthenticatedError('Session revoked');
    }
    return { ...user, sessionId: claims.sid };
  }

  private async resolveOidc(token: string): Promise<RequestUser> {
    const claims = await this.tokens.verifyOidc(token);
    try {
      return await this.loadUser({ externalId: claims.sub });
    } catch (err) {
      if (!this.env.AUTH_OIDC_JIT_PROVISION || !claims.email) throw err;
      // Just-in-time provisioning: link by email if an admin pre-created the user.
      const byEmail = await this.prisma.user.findUnique({ where: { email: claims.email.toLowerCase() } });
      if (!byEmail || byEmail.externalId) throw err;
      await this.prisma.user.update({ where: { id: byEmail.id }, data: { externalId: claims.sub } });
      return this.loadUser({ externalId: claims.sub });
    }
  }

  private async loadUser(where: { id: string } | { externalId: string }): Promise<RequestUser> {
    const key = 'id' in where ? `id:${where.id}` : `ext:${where.externalId}`;
    const hit = this.userCache.get(key);
    if (hit && hit.expires > Date.now()) return hit.user;

    const row = await this.prisma.user.findUnique({ where, include: { patient: { select: { id: true } }, clinician: { select: { id: true } } } });
    if (!row || !row.isActive) throw new UnauthenticatedError('Account not found or disabled');
    const user = this.auth.toRequestUser({ ...row, role: row.role as UserRole });
    this.userCache.set(key, { user, expires: Date.now() + USER_CACHE_TTL_MS });
    return user;
  }
}
