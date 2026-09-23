import type { User } from '@app/db';
import type { AuthTokens, AuthUser, LoginInput, RegisterPatientInput, UserRole } from '@app/shared';
import { permissionsForRole } from '@app/shared';
import { Inject, Injectable, Logger } from '@nestjs/common';
import argon2 from 'argon2';
import { authenticator } from 'otplib';

import type { ClientInfo } from '../../common/decorators';
import { ConflictError, ForbiddenError, UnauthenticatedError, ValidationError } from '../../common/errors/app-error';
import { decryptField, encryptField, randomToken, sha256 } from '../../common/utils/crypto';
import { ENV, type Env } from '../../config/env';
import { PrismaService } from '../../infra/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

import type { RequestUser } from './auth.types';
import { TokenService } from './token.service';

const MAX_FAILED_LOGINS = 5;
const LOCKOUT_MINUTES = 15;

type UserWithProfiles = User & { patient: { id: string } | null; clinician: { id: string } | null };

/**
 * Local authentication (AUTH_MODE=local). Passwords are argon2id hashes,
 * refresh tokens are opaque, hashed at rest and rotated on every use (reuse of
 * a rotated token revokes the whole session family). Optional TOTP MFA.
 * In OIDC mode these endpoints are disabled and the IdP owns credentials.
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private assertLocalMode(): void {
    if (this.env.AUTH_MODE !== 'local') {
      throw new ValidationError('Password login is disabled: authenticate with the configured identity provider (AUTH_MODE=oidc)');
    }
  }

  async login(input: LoginInput, client: ClientInfo): Promise<{ mfaRequired: true; mfaToken: string } | { mfaRequired: false; user: AuthUser; tokens: AuthTokens }> {
    this.assertLocalMode();
    const user = await this.prisma.user.findUnique({ where: { email: input.email }, include: { patient: { select: { id: true } }, clinician: { select: { id: true } } } });

    // Constant-ish time: always run a hash verify even when the user is missing.
    const hash = user?.passwordHash ?? '$argon2id$v=19$m=65536,t=3,p=4$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const ok = await argon2.verify(hash, input.password).catch(() => false);

    if (!user || !user.isActive || !ok) {
      if (user) await this.recordFailedLogin(user);
      await this.audit.log({ action: 'USER_LOGIN_FAILED', resource: 'User', resourceId: user?.id ?? null, actorId: user?.id ?? null, actorRole: user?.role ?? null, organizationId: user?.organizationId ?? null, metadata: { reason: !user ? 'unknown_user' : !user.isActive ? 'inactive' : 'bad_password' } });
      throw new UnauthenticatedError('Invalid email or password');
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ForbiddenError(`Account locked. Try again after ${user.lockedUntil.toISOString()}`);
    }

    if (user.mfaEnabled) {
      const mfaToken = await this.tokens.signAccessToken({ sub: user.id, org: user.organizationId, role: user.role, typ: 'mfa' });
      return { mfaRequired: true, mfaToken };
    }
    return { mfaRequired: false, ...(await this.issueSession(user, client)) };
  }

  async verifyMfa(mfaToken: string, code: string, client: ClientInfo): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    this.assertLocalMode();
    const claims = await this.tokens.verifyLocal(mfaToken);
    if (claims.typ !== 'mfa') throw new UnauthenticatedError('Invalid MFA token');
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub }, include: { patient: { select: { id: true } }, clinician: { select: { id: true } } } });
    if (!user || !user.isActive || !user.mfaEnabled || !user.mfaSecretEnc) throw new UnauthenticatedError('MFA is not enabled for this user');
    const secret = decryptField(user.mfaSecretEnc, this.requireFieldKey());
    if (!authenticator.check(code, secret)) {
      await this.recordFailedLogin(user);
      throw new UnauthenticatedError('Invalid MFA code');
    }
    return this.issueSession(user, client);
  }

  async refresh(refreshToken: string, client: ClientInfo): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    this.assertLocalMode();
    const tokenHash = sha256(refreshToken);
    const session = await this.prisma.session.findUnique({ where: { refreshTokenHash: tokenHash }, include: { user: { include: { patient: { select: { id: true } }, clinician: { select: { id: true } } } } } });
    if (!session) throw new UnauthenticatedError('Invalid refresh token');

    if (session.revokedAt || session.replacedById) {
      // Reuse of a rotated/revoked token: treat as theft, revoke the user's sessions.
      await this.prisma.session.updateMany({ where: { userId: session.userId, revokedAt: null }, data: { revokedAt: new Date() } });
      this.logger.warn({ userId: session.userId }, 'refresh token reuse detected; all sessions revoked');
      throw new UnauthenticatedError('Refresh token reuse detected');
    }
    if (session.expiresAt < new Date()) throw new UnauthenticatedError('Refresh token expired');
    if (!session.user.isActive) throw new UnauthenticatedError('Account disabled');

    const next = await this.createSession(session.userId, client);
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: new Date(), replacedById: next.id } });
    await this.audit.log({ action: 'TOKEN_REFRESHED', resource: 'Session', resourceId: next.id, actorId: session.userId, actorRole: session.user.role, organizationId: session.user.organizationId });
    const accessToken = await this.tokens.signAccessToken({ sub: session.userId, org: session.user.organizationId, role: session.user.role, sid: next.id, typ: 'access' });
    return { user: this.toAuthUser(session.user), tokens: { accessToken, refreshToken: next.raw, expiresIn: this.tokens.accessTtlSeconds, tokenType: 'Bearer' } };
  }

  async logout(user: RequestUser, refreshToken?: string): Promise<void> {
    if (this.env.AUTH_MODE === 'local') {
      if (refreshToken) {
        await this.prisma.session.updateMany({ where: { refreshTokenHash: sha256(refreshToken), userId: user.id }, data: { revokedAt: new Date() } });
      } else if (user.sessionId) {
        await this.prisma.session.updateMany({ where: { id: user.sessionId, userId: user.id }, data: { revokedAt: new Date() } });
      }
    }
    await this.audit.log({ action: 'USER_LOGOUT', resource: 'User', resourceId: user.id });
  }

  async registerPatient(input: RegisterPatientInput, client: ClientInfo): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    this.assertLocalMode();
    const org = await this.prisma.organization.findUnique({ where: { id: input.organizationId } });
    if (!org || !org.isActive) throw new ValidationError('Unknown organization');
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictError('An account with this email already exists');

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
    const user = await this.prisma.user.create({
      data: {
        organizationId: org.id,
        email: input.email,
        passwordHash,
        role: 'PATIENT',
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        patient: { create: { organizationId: org.id, dateOfBirth: input.dateOfBirth, preferredLang: input.preferredLang, timeZone: input.timeZone } },
      },
      include: { patient: { select: { id: true } }, clinician: { select: { id: true } } },
    });
    await this.audit.log({ action: 'USER_CREATED', resource: 'User', resourceId: user.id, patientId: user.patient?.id, actorId: user.id, actorRole: 'PATIENT', organizationId: org.id, metadata: { selfRegistered: true } });
    return this.issueSession(user, client);
  }

  /* -------- MFA enrolment -------- */

  async setupMfa(user: RequestUser): Promise<{ secret: string; otpauthUrl: string }> {
    this.assertLocalMode();
    const secret = authenticator.generateSecret();
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaSecretEnc: encryptField(secret, this.requireFieldKey()), mfaEnabled: false } });
    return { secret, otpauthUrl: authenticator.keyuri(user.email, this.env.MFA_ISSUER_NAME, secret) };
  }

  async confirmMfa(user: RequestUser, code: string): Promise<void> {
    this.assertLocalMode();
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    if (!row.mfaSecretEnc) throw new ValidationError('Run MFA setup first');
    const secret = decryptField(row.mfaSecretEnc, this.requireFieldKey());
    if (!authenticator.check(code, secret)) throw new ValidationError('Invalid MFA code');
    await this.prisma.user.update({ where: { id: user.id }, data: { mfaEnabled: true } });
    await this.audit.log({ action: 'MFA_ENABLED', resource: 'User', resourceId: user.id });
  }

  /* -------- helpers -------- */

  toAuthUser(user: UserWithProfiles): AuthUser {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      role: user.role as UserRole,
      firstName: user.firstName,
      lastName: user.lastName,
      patientId: user.patient?.id ?? null,
      clinicianId: user.clinician?.id ?? null,
      mfaEnabled: user.mfaEnabled,
    };
  }

  toRequestUser(user: UserWithProfiles, sessionId?: string): RequestUser {
    return { ...this.toAuthUser(user), patientId: user.patient?.id ?? null, clinicianId: user.clinician?.id ?? null, permissions: permissionsForRole(user.role as UserRole), mfaEnabled: user.mfaEnabled, sessionId };
  }

  private async issueSession(user: UserWithProfiles, client: ClientInfo): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const session = await this.createSession(user.id, client);
    await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null } });
    await this.audit.log({ action: 'USER_LOGIN', resource: 'User', resourceId: user.id, actorId: user.id, actorRole: user.role, organizationId: user.organizationId, metadata: { mfa: user.mfaEnabled } });
    const accessToken = await this.tokens.signAccessToken({ sub: user.id, org: user.organizationId, role: user.role, sid: session.id, typ: 'access' });
    return { user: this.toAuthUser(user), tokens: { accessToken, refreshToken: session.raw, expiresIn: this.tokens.accessTtlSeconds, tokenType: 'Bearer' } };
  }

  private async createSession(userId: string, client: ClientInfo): Promise<{ id: string; raw: string }> {
    const raw = randomToken(48);
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(raw),
        userAgent: client.userAgent?.slice(0, 512),
        ipAddress: client.ipAddress,
        expiresAt: new Date(Date.now() + this.env.JWT_REFRESH_TTL_DAYS * 86_400_000),
      },
    });
    return { id: session.id, raw };
  }

  private async recordFailedLogin(user: User): Promise<void> {
    const failed = user.failedLogins + 1;
    await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: failed, lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : user.lockedUntil },
    });
  }

  private requireFieldKey(): string {
    if (!this.env.FIELD_ENCRYPTION_KEY) throw new ValidationError('FIELD_ENCRYPTION_KEY must be configured to use MFA');
    return this.env.FIELD_ENCRYPTION_KEY;
  }
}
