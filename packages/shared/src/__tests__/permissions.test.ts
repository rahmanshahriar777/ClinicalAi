import { describe, expect, it } from 'vitest';

import { USER_ROLES } from '../constants';
import { PERMISSIONS, ROLE_PERMISSIONS, hasAllPermissions, hasPermission } from '../permissions';

describe('permission model', () => {
  it('defines permissions for every role', () => {
    for (const role of USER_ROLES) {
      expect(ROLE_PERMISSIONS[role]).toBeDefined();
    }
  });

  it('only references declared permissions', () => {
    for (const role of USER_ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) {
        expect(PERMISSIONS).toContain(p);
      }
    }
  });

  it('patients can never approve AI drafts, sign documents or read audit logs', () => {
    expect(hasPermission('PATIENT', 'ai:approve')).toBe(false);
    expect(hasPermission('PATIENT', 'document:sign')).toBe(false);
    expect(hasPermission('PATIENT', 'audit:read')).toBe(false);
    expect(hasPermission('PATIENT', 'patient:read:any')).toBe(false);
  });

  it('only clinicians can approve AI drafts and sign documents', () => {
    for (const role of USER_ROLES) {
      const expected = role === 'CLINICIAN';
      expect(hasPermission(role, 'ai:approve')).toBe(expected);
      expect(hasPermission(role, 'document:sign')).toBe(expected);
    }
  });

  it('compliance can read audit logs but not manage users', () => {
    expect(hasAllPermissions('COMPLIANCE', ['audit:read'])).toBe(true);
    expect(hasPermission('COMPLIANCE', 'admin:manage')).toBe(false);
  });
});
