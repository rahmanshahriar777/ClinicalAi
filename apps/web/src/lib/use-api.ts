'use client';

import { ApiClientError } from '@app/api-client';
import { useCallback, useEffect, useState } from 'react';

/** Tiny data hook: runs `fn` on mount/deps change and exposes reload(). */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    return fn()
      .then((d) => setData(d))
      .catch((e: unknown) => setError(e instanceof ApiClientError ? `${e.body.code}: ${e.message}` : (e as Error).message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload, setData };
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiClientError) {
    if (e.code === 'VALIDATION_FAILED') {
      const fe = (e.body.details as { fieldErrors?: Record<string, string[]> } | undefined)?.fieldErrors;
      if (fe) return Object.entries(fe).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ');
    }
    return e.message;
  }
  return (e as Error).message ?? 'Something went wrong';
}

export function fmtDate(v: string | Date | null | undefined): string {
  if (!v) return '—';
  return new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}
