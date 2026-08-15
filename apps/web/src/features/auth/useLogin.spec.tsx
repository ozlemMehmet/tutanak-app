// Giris mutation'i (T-018 kriter 2): basarili yanitin token'i T-017'deki oturum deposuna
// yazilir; basarisiz giris mevcut oturuma DOKUNMAZ.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ACCESS_TOKEN_STORAGE_KEY } from '../../api/access-token';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import { createSessionStore } from './session';
import type { SessionStore } from './session';
import { SessionProvider } from './SessionProvider';
import { useLogin } from './useLogin';

const CREDENTIALS = { email: 'selin@ornek.com', password: 'cok-gizli-8' };
const LOGIN_RESPONSE = {
  accessToken: 'jwt-token',
  expiresIn: 604800,
  user: { id: 'kullanici-1', email: CREDENTIALS.email, createdAt: '2026-08-01T10:00:00.000Z' },
};

function renderUseLogin(request: jest.Mock): {
  result: { current: ReturnType<typeof useLogin> };
  session: SessionStore;
  queryClient: QueryClient;
} {
  const session = createSessionStore(window.localStorage);
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const client = { request } as unknown as ApiClient;

  const wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <QueryClientProvider client={queryClient}>
      <SessionProvider store={session}>{children}</SessionProvider>
    </QueryClientProvider>
  );

  const { result } = renderHook(() => useLogin(client), { wrapper });
  return { result, session, queryClient };
}

describe('useLogin', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  it('basarili giriste erisim token"ini oturum deposuna yazar', async () => {
    const request = jest.fn().mockResolvedValue(LOGIN_RESPONSE);
    const { result, session } = renderUseLogin(request);

    result.current.mutate(CREDENTIALS);

    await waitFor(() => {
      expect(session.getAccessToken()).toBe('jwt-token');
    });
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe('jwt-token');
  });

  it('basarili giriste onbellegi temizler (onceki oturumun verisi yeni kullaniciya gosterilmez)', async () => {
    const request = jest.fn().mockResolvedValue(LOGIN_RESPONSE);
    const { result, queryClient } = renderUseLogin(request);
    queryClient.setQueryData(['current-user'], { email: 'eski@ornek.com' });

    result.current.mutate(CREDENTIALS);

    await waitFor(() => {
      expect(queryClient.getQueryData(['current-user'])).toBeUndefined();
    });
  });

  it('401 INVALID_CREDENTIALS yanitinda hicbir token saklamaz', async () => {
    const request = jest
      .fn()
      .mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'E-posta veya sifre hatali.', 401));
    const { result, session } = renderUseLogin(request);

    result.current.mutate(CREDENTIALS);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(session.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });
});
