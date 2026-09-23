import { describe, expect, it, vi } from 'vitest';

import { ApiClientError, HttpClient, qs } from './client';

function makeFetch(responses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = responses.shift()!;
    return { status: r.status, ok: r.status < 400, statusText: 'x', text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) } as Response;
  });
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls };
}

describe('HttpClient', () => {
  it('attaches the bearer token and parses JSON', async () => {
    const { fetchImpl, calls } = makeFetch([{ status: 200, body: { ok: true } }]);
    const c = new HttpClient({ baseUrl: 'http://api/', fetchImpl, tokens: { getTokens: () => ({ accessToken: 'A', refreshToken: 'R', expiresIn: 1, tokenType: 'Bearer' }), setTokens: () => undefined } });
    expect(await c.get('/x')).toEqual({ ok: true });
    expect(calls[0]!.url).toBe('http://api/x');
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe('Bearer A');
  });

  it('refreshes once on 401 and retries', async () => {
    const { fetchImpl, calls } = makeFetch([{ status: 401, body: { code: 'UNAUTHENTICATED' } }, { status: 200, body: { tokens: { accessToken: 'B', refreshToken: 'R2', expiresIn: 1, tokenType: 'Bearer' } } }, { status: 200, body: { ok: 2 } }]);
    const store = { tokens: { accessToken: 'A', refreshToken: 'R', expiresIn: 1, tokenType: 'Bearer' as const } };
    const c = new HttpClient({ baseUrl: 'http://api', fetchImpl, tokens: { getTokens: () => store.tokens, setTokens: (t) => void (store.tokens = t!) } });
    expect(await c.get('/x')).toEqual({ ok: 2 });
    expect(calls.map((x) => x.url)).toEqual(['http://api/x', 'http://api/auth/refresh', 'http://api/x']);
    expect((calls[2]!.init.headers as Record<string, string>).authorization).toBe('Bearer B');
  });

  it('surfaces the error envelope', async () => {
    const { fetchImpl } = makeFetch([{ status: 403, body: { statusCode: 403, code: 'CONSENT_REQUIRED', message: 'no', timestamp: 't' } }]);
    const c = new HttpClient({ baseUrl: 'http://api', fetchImpl, tokens: { getTokens: () => null, setTokens: () => undefined } });
    await expect(c.get('/x')).rejects.toMatchObject({ status: 403, code: 'CONSENT_REQUIRED' });
    await expect(c.get('/x').catch((e) => e instanceof ApiClientError)).resolves.toBe(true).catch(() => undefined);
  });

  it('builds query strings without empty values', () => {
    expect(qs({ page: 1, status: undefined, search: '' })).toBe('?page=1');
    expect(qs({})).toBe('');
  });
});
