'use client';

import type { AuthUser, UserRole } from '@app/shared';
import { useRouter } from 'next/navigation';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, tokenStore } from './api';

interface AuthState {
  user: (AuthUser & { permissions?: string[] }) | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; mfaToken?: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function homeFor(role: UserRole): string {
  if (role === 'PATIENT') return '/patient';
  if (role === 'ADMIN' || role === 'COMPLIANCE') return '/admin';
  return '/clinician';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthState['user']>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!tokenStore.getTokens()) {
      setLoading(false);
      return;
    }
    api()
      .auth.me()
      .then(setUser)
      .catch(() => tokenStore.setTokens(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api().auth.login({ email, password });
    if ('mfaRequired' in r && r.mfaRequired) return { mfaRequired: true, mfaToken: r.mfaToken };
    if ('tokens' in r) {
      tokenStore.setTokens(r.tokens);
      setUser(r.user);
      router.replace(homeFor(r.user.role));
    }
    return { mfaRequired: false };
  }, [router]);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    const r = await api().auth.verifyMfa(mfaToken, code);
    tokenStore.setTokens(r.tokens as never);
    setUser(r.user);
    router.replace(homeFor(r.user.role));
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api().auth.logout(tokenStore.getTokens()?.refreshToken);
    } finally {
      tokenStore.setTokens(null);
      setUser(null);
      router.replace('/login');
    }
  }, [router]);

  const value = useMemo(() => ({ user, loading, login, verifyMfa, logout }), [user, loading, login, verifyMfa, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

/** Client-side route guard: redirects unauthenticated users and wrong roles. */
export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if (!roles.includes(user.role)) router.replace(homeFor(user.role));
  }, [user, loading, roles, router]);
  if (loading || !user || !roles.includes(user.role)) return <p className="p-lg text-sm text-ink-muted">Loading…</p>;
  return <>{children}</>;
}
