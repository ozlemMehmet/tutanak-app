// Oturum durumu (token var mi, yok mu) sunucu durumu DEGILDIR; bu yuzden TanStack Query'ye
// degil, depoyu saran kucuk bir abonelik kaynagina baglanir (CLAUDE.md §3.9: Redux/Zustand
// gibi global state kutuphanesi eklenmez). React tarafi bunu `useSyncExternalStore` ile
// okur — boylece `api/client.ts` 401 aldiginda cagirdigi `signOut`, rota guard'ini da
// otomatik olarak yeniden degerlendirir (T-017 kriter 5).
import { clearAccessToken, readAccessToken, writeAccessToken } from '../../api/access-token';

export interface SessionStore {
  /** `useSyncExternalStore` anlik goruntusu: ayni deger icin kararli referans doner. */
  getAccessToken: () => string | null;
  signIn: (accessToken: string) => void;
  signOut: () => void;
  subscribe: (listener: () => void) => () => void;
}

export function createSessionStore(storage: Storage): SessionStore {
  const listeners = new Set<() => void>();
  // Depodan okunan deger onbelleklenir: `getSnapshot` her cagrida depoya gitseydi React
  // anlik goruntuyu degismis sayip sonsuz render dongusune girebilirdi.
  let accessToken = readAccessToken(storage);

  function emit(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  return {
    getAccessToken: () => accessToken,

    signIn(nextAccessToken: string): void {
      writeAccessToken(storage, nextAccessToken);
      accessToken = nextAccessToken;
      emit();
    },

    signOut(): void {
      clearAccessToken(storage);
      accessToken = null;
      emit();
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
