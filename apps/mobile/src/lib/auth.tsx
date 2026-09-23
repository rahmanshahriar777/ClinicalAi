import type { AuthUser } from '@app/shared';
import * as LocalAuthentication from 'expo-local-authentication';
import { useRouter } from 'expo-router';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { api, tokenStore } from './api';

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  locked: boolean;
  login: (email: string, password: string) => Promise<{ mfaRequired: boolean; mfaToken?: string }>;
  verifyMfa: (mfaToken: string, code: string) => Promise<void>;
  unlock: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);
const LOCK_AFTER_MS = 5 * 60_000;

/**
 * Session + biometric lock (blueprint §18.5): the app re-locks after five
 * minutes in the background and requires Face ID / fingerprint / passcode.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const router = useRouter();

  useEffect(() => {
    (async () => {
      if (await tokenStore.getTokens()) {
        try {
          setUser(await api().auth.me());
          setLocked(true);
        } catch {
          await tokenStore.setTokens(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    let backgroundedAt: number | null = null;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'background') backgroundedAt = Date.now();
      else if (s === 'active' && backgroundedAt && Date.now() - backgroundedAt > LOCK_AFTER_MS && user) setLocked(true);
    });
    return () => sub.remove();
  }, [user]);

  const unlock = useCallback(async () => {
    const has = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    if (!has || !enrolled) return setLocked(false);
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock Clinical AI' });
    if (r.success) setLocked(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const r = await api().auth.login({ email, password });
    if ('mfaRequired' in r && r.mfaRequired) return { mfaRequired: true, mfaToken: r.mfaToken };
    if ('tokens' in r) {
      await tokenStore.setTokens(r.tokens);
      setUser(r.user);
      router.replace('/(patient)');
    }
    return { mfaRequired: false };
  }, [router]);

  const verifyMfa = useCallback(async (mfaToken: string, code: string) => {
    const r = await api().auth.verifyMfa(mfaToken, code);
    await tokenStore.setTokens(r.tokens as never);
    setUser(r.user);
    router.replace('/(patient)');
  }, [router]);

  const logout = useCallback(async () => {
    try {
      await api().auth.logout((await tokenStore.getTokens())?.refreshToken);
    } finally {
      await tokenStore.setTokens(null);
      setUser(null);
      router.replace('/(auth)/login');
    }
  }, [router]);

  const value = useMemo(() => ({ user, loading, locked, login, verifyMfa, unlock, logout }), [user, loading, locked, login, verifyMfa, unlock, logout]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth outside AuthProvider');
  return c;
}
