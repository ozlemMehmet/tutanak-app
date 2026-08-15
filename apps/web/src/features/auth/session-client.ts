// API istemcisinin oturum kaynagina baglanmasi TEK yerde tanimlanir: token okuma ve
// "401 -> oturumu bitir" kancasi (T-017 kriter 5). `main.tsx` yalnizca bunu cagirir, boylece
// davranis test edilebilir kalir (`main.tsx` kapsam disidir — CLAUDE.md §8.7).
import { createApiClient } from '../../api/client';
import type { ApiClient } from '../../api/client';
import type { SessionStore } from './session';

interface SessionAwareClientOptions {
  baseUrl: string;
  session: SessionStore;
  fetchImpl?: typeof fetch;
}

export function createSessionAwareClient(options: SessionAwareClientOptions): ApiClient {
  return createApiClient({
    baseUrl: options.baseUrl,
    readAccessToken: () => options.session.getAccessToken(),
    fetchImpl: options.fetchImpl,
    // Yonlendirmeyi burada YAPMAYIZ: oturum temizlenince `RequireAuth` zaten `/login`'e
    // gonderir ve hedef rotayi `redirectTo` olarak korur (tek yonlendirme noktasi).
    onUnauthorized: () => {
      options.session.signOut();
    },
  });
}
