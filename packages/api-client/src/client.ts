import type { ApiError, AuthTokens } from '@app/shared';

export interface TokenStore {
  getTokens(): Promise<AuthTokens | null> | AuthTokens | null;
  setTokens(tokens: AuthTokens | null): Promise<void> | void;
}

export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiError,
  ) {
    super(body.message);
    this.name = 'ApiClientError';
  }
  get code(): string {
    return this.body.code;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  tokens: TokenStore;
  fetchImpl?: typeof fetch;
  /** Called when a refresh fails: clear session and send the user to login. */
  onUnauthenticated?: () => void;
}

/**
 * Minimal fetch wrapper shared by web and mobile:
 *  - attaches the bearer token
 *  - transparently refreshes once on 401 (rotating refresh tokens)
 *  - normalises errors to ApiClientError carrying the API error envelope
 */
export class HttpClient {
  private refreshing: Promise<AuthTokens | null> | null = null;

  constructor(private readonly opts: ApiClientOptions) {}

  async request<T>(method: string, path: string, body?: unknown, init: { auth?: boolean; retry?: boolean } = {}): Promise<T> {
    const auth = init.auth ?? true;
    const fetchImpl = this.opts.fetchImpl ?? fetch;
    const tokens = auth ? await this.opts.tokens.getTokens() : null;
    const res = await fetchImpl(`${this.opts.baseUrl.replace(/\/$/, '')}${path}`, {
      method,
      headers: { 'content-type': 'application/json', accept: 'application/json', ...(tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 401 && auth && tokens && init.retry !== false) {
      const refreshed = await this.refresh(tokens.refreshToken);
      if (refreshed) return this.request<T>(method, path, body, { ...init, retry: false });
      this.opts.onUnauthenticated?.();
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    const json = text ? (JSON.parse(text) as unknown) : undefined;
    if (!res.ok) {
      const err = (json as ApiError | undefined) ?? { statusCode: res.status, code: 'INTERNAL', message: res.statusText, timestamp: new Date().toISOString() };
      throw new ApiClientError(res.status, err);
    }
    return json as T;
  }

  private refresh(refreshToken: string): Promise<AuthTokens | null> {
    if (!this.refreshing) {
      this.refreshing = (async () => {
        try {
          const r = await this.request<{ tokens: AuthTokens }>('POST', '/auth/refresh', { refreshToken }, { auth: false, retry: false });
          await this.opts.tokens.setTokens(r.tokens);
          return r.tokens;
        } catch {
          await this.opts.tokens.setTokens(null);
          return null;
        } finally {
          this.refreshing = null;
        }
      })();
    }
    return this.refreshing;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, body ?? {});
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>('PATCH', path, body ?? {});
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>('PUT', path, body ?? {});
  }
  delete<T>(path: string, body?: unknown) {
    return this.request<T>('DELETE', path, body);
  }
}

export function qs(params: Record<string, unknown>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : '';
}
