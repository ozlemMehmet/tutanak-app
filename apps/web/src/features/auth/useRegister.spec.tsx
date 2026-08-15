// Kayit mutation'i (T-018 kriter 8): basarili kayit OTURUM ACMAZ — `POST /auth/register`
// token dondurmez, kullanici `/login`'e yonlendirilir.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ACCESS_TOKEN_STORAGE_KEY } from '../../api/access-token';
import type { ApiClient } from '../../api/client';
import { createSessionStore } from './session';
import type { SessionStore } from './session';
import { SessionProvider } from './SessionProvider';
import { useRegister } from './useRegister';

const CREDENTIALS = { email: 'selin@ornek.com', password: 'cok-gizli-8' };
const USER = {
  id: 'kullanici-1',
  email: CREDENTIALS.email,
  createdAt: '2026-08-01T10:00:00.000Z',
};

function renderUseRegister(request: jest.Mock): {
  result: { current: ReturnType<typeof useRegister> };
  session: SessionStore;
} {
  const session = createSessionStore(window.localStorage);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const client = { request } as unknown as ApiClient;

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider store={session}>{children}</SessionProvider>
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useRegister(client), { wrapper });
  return { result, session };
}

describe('useRegister', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  it('kayit istegini gonderir ve olusan kullaniciyi doner', async () => {
    const request = jest.fn().mockResolvedValue(USER);
    const { result } = renderUseRegister(request);

    result.current.mutate(CREDENTIALS);

    await waitFor(() => {
      expect(result.current.data).toEqual(USER);
    });
    expect(request).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify(CREDENTIALS),
    });
  });

  it('basarili kayitta oturum ACMAZ (otomatik giris yok)', async () => {
    const request = jest.fn().mockResolvedValue(USER);
    const { result, session } = renderUseRegister(request);

    result.current.mutate(CREDENTIALS);

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(session.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
