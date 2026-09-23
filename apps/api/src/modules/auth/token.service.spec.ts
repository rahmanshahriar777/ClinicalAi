import { UnauthenticatedError } from '../../common/errors/app-error';
import type { Env } from '../../config/env';

import { TokenService } from './token.service';

const env = { JWT_SECRET: 'x'.repeat(64), JWT_ACCESS_TTL: '15m', API_URL: 'http://localhost:4000', AUTH_MODE: 'local' } as Env;

describe('TokenService', () => {
  const svc = new TokenService(env);

  it('round-trips access token claims', async () => {
    const token = await svc.signAccessToken({ sub: 'u1', org: 'o1', role: 'CLINICIAN', sid: 's1', typ: 'access' });
    const claims = await svc.verifyLocal(token);
    expect(claims).toEqual({ sub: 'u1', org: 'o1', role: 'CLINICIAN', sid: 's1', typ: 'access' });
    expect(svc.accessTtlSeconds).toBe(900);
  });

  it('distinguishes mfa challenge tokens', async () => {
    const token = await svc.signAccessToken({ sub: 'u1', org: 'o1', role: 'PATIENT', typ: 'mfa' });
    expect((await svc.verifyLocal(token)).typ).toBe('mfa');
  });

  it('rejects tokens signed with another secret', async () => {
    const other = new TokenService({ ...env, JWT_SECRET: 'y'.repeat(64) });
    const token = await other.signAccessToken({ sub: 'u1', org: 'o1', role: 'PATIENT', typ: 'access' });
    await expect(svc.verifyLocal(token)).rejects.toBeInstanceOf(UnauthenticatedError);
  });

  it('rejects garbage', async () => {
    await expect(svc.verifyLocal('not-a-jwt')).rejects.toBeInstanceOf(UnauthenticatedError);
  });
});
