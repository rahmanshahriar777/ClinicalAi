import type { Permission, UserRole } from '@app/shared';

/** Authenticated principal attached to the request by JwtAuthGuard. */
export interface RequestUser {
  id: string;
  organizationId: string;
  email: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  patientId: string | null;
  clinicianId: string | null;
  permissions: readonly Permission[];
  mfaEnabled: boolean;
  sessionId?: string;
}

export interface AccessTokenClaims {
  sub: string;
  org: string;
  role: UserRole;
  sid?: string;
  /** "access" | "mfa" — mfa tokens are only valid on /auth/mfa/verify. */
  typ: 'access' | 'mfa';
}
