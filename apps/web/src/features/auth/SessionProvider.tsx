// Oturum kaynagini React agacina baglar. Deger `useSyncExternalStore` ile okunur: token
// `api/client.ts`'in 401 kancasindan (React disindan) da degisebilir ve guard'in bunu
// aninda gormesi gerekir (T-017 kriter 5).
import { createContext, useContext, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SessionStore } from './session';

const SessionContext = createContext<SessionStore | null>(null);

interface SessionProviderProps {
  store: SessionStore;
  children: ReactNode;
}

export function SessionProvider({ store, children }: SessionProviderProps): React.JSX.Element {
  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>;
}

export function useSessionStore(): SessionStore {
  const store = useContext(SessionContext);
  if (store === null) {
    throw new Error('SessionProvider bulunamadi: oturum kancalari saglayici icinde kullanilir');
  }
  return store;
}

/** Guard ve kabuk icin tepkisel token degeri; oturum yoksa `null`. */
export function useAccessToken(): string | null {
  const store = useSessionStore();
  return useSyncExternalStore(store.subscribe, store.getAccessToken);
}
