import type { UserRole } from '@app/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTPayload } from 'jose';

import { UnauthenticatedError } from '../../common/errors/app-error';
import { parseDurationSeconds } from '../../common/utils/dates';
import { ENV, type Env } from '../../config/env';

import type { AccessTokenClaims } from './auth.types';

/**
 * Token issuance/verification.
 *  - local mode: HS256 JWTs signed with JWT_SECRET (short-lived access tokens,
 *    opaque rotating refresh tokens stored hashed in Session).
 *  - oidc mode: verifies RS256/ES256 tokens from the IdP via its JWKS;
 *    issuer and audience are enforced.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);
  private readonly secret: Uint8Array;
  private jwks?: ReturnType<typeof createRemoteJWKSet>;
  readonly accessTtlSeconds: number;

  constructor(@Inject(ENV) private readonly env: Env) {
    this.secret = new TextEncoder().encode(env.JWT_SECRET);
    this.accessTtlSeconds = parseDurationSeconds(env.JWT_ACCESS_TTL);
  }

  async signAccessToken(claims: AccessTokenClaims): Promise<string> {
    return new SignJWT({ org: claims.org, role: claims.role, sid: claims.sid, typ: claims.typ })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(claims.sub)
      .setIssuer(this.env.API_URL)
      .setAudience('clinical-api')
      .setIssuedAt()
      .setExpirationTime(claims.typ === 'mfa' ? '5m' : this.env.JWT_ACCESS_TTL)
      .sign(this.secret);
  }

  /** Verifies a locally issued token. */
  async verifyLocal(token: string): Promise<AccessTokenClaims> {
    try {
      const { payload } = await jwtVerify(token, this.secret, { issuer: this.env.API_URL, audience: 'clinical-api', algorithms: ['HS256'] });
      return this.toClaims(payload);
    } catch {
      throw new UnauthenticatedError('Invalid or expired token');
    }
  }

  /** Verifies an external IdP token (AUTH_MODE=oidc). */
  async verifyOidc(token: string): Promise<{ sub: string; email?: string; name?: string; roles: string[] }> {
    if (!this.env.AUTH_ISSUER) throw new UnauthenticatedError('OIDC issuer is not configured');
    if (!this.jwks) {
      const issuer = this.env.AUTH_ISSUER.replace(/\/$/, '');
      this.jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cooldownDuration: 30_000 });
    }
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: this.env.AUTH_ISSUER,
        audience: this.env.AUTH_AUDIENCE ?? this.env.AUTH_CLIENT_ID,
      });
      const p = payload as JWTPayload & { email?: string; name?: string; roles?: string[]; realm_access?: { roles?: string[] } };
      return {
        sub: String(p.sub),
        email: p.email,
        name: p.name,
        roles: p.roles ?? p.realm_access?.roles ?? [],
      };
    } catch (err) {
      this.logger.debug({ err: (err as Error).message }, 'oidc verification failed');
      throw new UnauthenticatedError('Invalid or expired token');
    }
  }

  private toClaims(payload: JWTPayload): AccessTokenClaims {
    const p = payload as JWTPayload & { org?: string; role?: UserRole; sid?: string; typ?: 'access' | 'mfa' };
    if (!p.sub || !p.org || !p.role) throw new UnauthenticatedError('Malformed token');
    return { sub: p.sub, org: p.org, role: p.role, sid: p.sid, typ: p.typ ?? 'access' };
  }
}
