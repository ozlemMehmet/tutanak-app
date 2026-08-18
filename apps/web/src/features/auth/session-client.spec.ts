import { ACCESS_TOKEN_STORAGE_KEY } from '../../api/access-token';
import { ApiError } from '../../api/client';
import { createSessionStore } from './session';
import { createSessionAwareClient } from './session-client';

describe('createSessionAwareClient', () => {
  const responseOf = (status: number, body: unknown): Response =>
    ({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  const unauthorizedBody = {
    error: { code: 'UNAUTHENTICATED', message: 'Oturum suresi doldu.', traceId: 'iz-1' },
  };

  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  it('istege oturum kaynagindaki token"i ekler', async () => {
    const session = createSessionStore(window.localStorage);
    session.signIn('token-abc');
    const fetchImpl = jest.fn().mockResolvedValue(responseOf(200, { id: 'kullanici-1' }));
    const client = createSessionAwareClient({
      baseUrl: '/api/v1',
      session,
      fetchImpl,
    });

    await client.request('/me');

    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/me');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token-abc');
  });

  it('oturumlu istek 401 dondugunde saklanan oturumu temizler', async () => {
    const session = createSessionStore(window.localStorage);
    session.signIn('token-suresi-dolmus');
    const fetchImpl = jest.fn().mockResolvedValue(responseOf(401, unauthorizedBody));
    const client = createSessionAwareClient({
      baseUrl: '/api/v1',
      session,
      fetchImpl,
    });

    await expect(client.request('/reports')).rejects.toBeInstanceOf(ApiError);

    expect(session.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('oturumsuz istek 401 dondugunde oturum kaynagina dokunmaz', async () => {
    const session = createSessionStore(window.localStorage);
    const listener = jest.fn();
    session.subscribe(listener);
    const fetchImpl = jest.fn().mockResolvedValue(
      responseOf(401, {
        error: { code: 'INVALID_CREDENTIALS', message: 'E-posta veya şifre hatalı.', traceId: 'i' },
      }),
    );
    const client = createSessionAwareClient({
      baseUrl: '/api/v1',
      session,
      fetchImpl,
    });

    await expect(
      client.request('/auth/login', { method: 'POST', body: '{}' }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(listener).not.toHaveBeenCalled();
  });
});
