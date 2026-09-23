import { createApi, type ClinicalApi } from '@app/api-client';
import type { AuthTokens } from '@app/shared';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';

const KEY = 'clinical.tokens';

/** Tokens are kept in the device keychain / keystore (blueprint §18.5). */
export const tokenStore = {
  async getTokens(): Promise<AuthTokens | null> {
    const raw = await SecureStore.getItemAsync(KEY);
    return raw ? (JSON.parse(raw) as AuthTokens) : null;
  },
  async setTokens(tokens: AuthTokens | null): Promise<void> {
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    else await SecureStore.deleteItemAsync(KEY);
  },
};

let instance: ClinicalApi | undefined;
export function api(): ClinicalApi {
  if (!instance) {
    const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? (Constants.expoConfig?.extra?.apiUrl as string | undefined) ?? 'http://localhost:4000';
    instance = createApi({ baseUrl, tokens: tokenStore });
  }
  return instance;
}
