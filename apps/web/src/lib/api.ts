'use client';

import { createApi, type ClinicalApi } from '@app/api-client';
import type { AuthTokens } from '@app/shared';

const KEY = 'clinical.session';

/**
 * Tokens live in sessionStorage (cleared when the tab closes; never shared
 * across origins). For a production deployment behind a BFF, swap this store
 * for httpOnly cookies — the API and this client are agnostic.
 */
export const tokenStore = {
  getTokens(): AuthTokens | null {
    if (typeof window === 'undefined') return null;
    const raw = window.sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  },
  setTokens(tokens: AuthTokens | null): void {
    if (typeof window === 'undefined') return;
    if (tokens) window.sessionStorage.setItem(KEY, JSON.stringify(tokens));
    else window.sessionStorage.removeItem(KEY);
  },
};

let instance: ClinicalApi | undefined;
export function api(): ClinicalApi {
  if (!instance) {
    instance = createApi({
      baseUrl: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000',
      tokens: tokenStore,
      onUnauthenticated: () => {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) window.location.assign('/login');
      },
    });
  }
  return instance;
}
