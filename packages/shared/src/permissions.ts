import type { UserRole } from './constants';

/**
 * Permission model (blueprint §11.2). Roles map to permissions; guards check
 * permissions, not roles, so that adding a role never requires touching
 * controllers. Resource-level (row) authorization lives in the API's
 * AccessPolicyService and is always applied on top of these.
 */
export const PERMISSIONS = [
  'patient:read',
  'patient:read:any', // read patients across the organization (not only own care list)
  'patient:write',
  'consent:read',
  'consent:write',
  'appointment:read',
  'appointment:write',
  'encounter:read',
  'encounter:write',
  'intake:read',
  'intake:write',
  'document:read',
  'document:create',
  'document:approve',
  'document:sign',
  'message:read',
  'message:send',
  'message:triage',
  'ai:invoke',
  'ai:review',
  'ai:approve',
  'escalation:read',
  'escalation:manage',
  'notification:read',
  'audit:read',
  'admin:manage',
  'admin:ai-config',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  PATIENT: [
    'patient:read',
    'patient:write',
    'consent:read',
    'consent:write',
    'appointment:read',
    'appointment:write',
    'intake:read',
    'intake:write',
    'document:read',
    'message:read',
    'message:send',
    'notification:read',
  ],
  CLINICIAN: [
    'patient:read',
    'consent:read',
    'appointment:read',
    'appointment:write',
    'encounter:read',
    'encounter:write',
    'intake:read',
    'document:read',
    'document:create',
    'document:approve',
    'document:sign',
    'message:read',
    'message:send',
    'message:triage',
    'ai:invoke',
    'ai:review',
    'ai:approve',
    'escalation:read',
    'escalation:manage',
    'notification:read',
  ],
  NURSE: [
    'patient:read',
    'patient:read:any',
    'consent:read',
    'appointment:read',
    'appointment:write',
    'encounter:read',
    'intake:read',
    'intake:write',
    'document:read',
    'message:read',
    'message:send',
    'message:triage',
    'ai:invoke',
    'ai:review',
    'escalation:read',
    'escalation:manage',
    'notification:read',
  ],
  FRONT_DESK: [
    'patient:read',
    'patient:read:any',
    'patient:write',
    'appointment:read',
    'appointment:write',
    'intake:read',
    'message:read',
    'message:triage',
    'notification:read',
  ],
  ADMIN: [
    'patient:read:any',
    'consent:read',
    'appointment:read',
    'audit:read',
    'admin:manage',
    'admin:ai-config',
    'notification:read',
    'escalation:read',
  ],
  COMPLIANCE: ['audit:read', 'consent:read', 'escalation:read', 'notification:read'],
};

export function permissionsForRole(role: UserRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function hasAllPermissions(role: UserRole, permissions: readonly Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}
