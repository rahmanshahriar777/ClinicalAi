import { AiError } from '../errors';

/** fetch with abort-on-timeout and a normalised error surface. */
export async function fetchJson<T>(
  url: string,
  init: RequestInit & { timeoutMs: number },
  fetchImpl: typeof fetch = fetch,
): Promise<T> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), init.timeoutMs);
  try {
    const res = await fetchImpl(url, { ...init, signal: controller.signal });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new AiError('AI_PROVIDER_ERROR', `Provider responded ${res.status}`, { status: res.status, body: body.slice(0, 500) });
    }
    return (await res.json()) as T;
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new AiError('AI_TIMEOUT', `Provider timed out after ${init.timeoutMs}ms`);
    if (e instanceof AiError) throw e;
    throw new AiError('AI_PROVIDER_ERROR', (e as Error).message);
  } finally {
    clearTimeout(t);
  }
}
