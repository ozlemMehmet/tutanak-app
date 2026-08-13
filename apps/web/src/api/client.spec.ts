import { ApiError, createApiClient } from './client';

describe('createApiClient', () => {
  // jsdom fetch API siniflarini (Response/Headers) saglamaz; yanit sozlesmesi kadari sahtelenir.
  const jsonResponse = (body: unknown, status = 200): Response =>
    ({
      ok: status < 400,
      status,
      json: () => Promise.resolve(body),
    }) as unknown as Response;

  const brokenResponse = (status: number): Response =>
    ({
      ok: false,
      status,
      json: () => Promise.reject(new Error('gecersiz JSON')),
    }) as unknown as Response;

  const headersOf = (init: RequestInit): Record<string, string> =>
    (init.headers ?? {}) as Record<string, string>;

  it('istek adresini taban adresle birlestirir ve token varsa Authorization basligi ekler', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([{ id: 'foto-1' }]));
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => 'token-abc',
      fetchImpl,
    });

    const result = await client.request<{ id: string }[]>('/reports/r-1/photos');

    expect(result).toEqual([{ id: 'foto-1' }]);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/v1/reports/r-1/photos');
    expect(headersOf(init).Authorization).toBe('Bearer token-abc');
  });

  it('token yokken Authorization basligi gondermez', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse([]));
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => null,
      fetchImpl,
    });

    await client.request('/reports/r-1/photos');

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(headersOf(init).Authorization).toBeUndefined();
  });

  it('FormData govdesinde Content-Type basligini ELLE ayarlamaz (sinir degeri tarayiciya birakilir)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({ id: 'foto-1' }, 201));
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => 'token-abc',
      fetchImpl,
    });

    const body = new FormData();
    body.append('file', new File(['icerik'], 'kamera.jpg', { type: 'image/jpeg' }));
    await client.request('/reports/r-1/photos', { method: 'POST', body });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(headersOf(init)['Content-Type']).toBeUndefined();
  });

  it('JSON govdesinde Content-Type basligini ekler', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(jsonResponse({}, 201));
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => null,
      fetchImpl,
    });

    await client.request('/reports', { method: 'POST', body: JSON.stringify({ title: 'x' }) });

    const [, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(headersOf(init)['Content-Type']).toBe('application/json');
  });

  it('hata zarfini tek noktada cozer ve kod + mesaj tasiyan ApiError firlatir', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'UNSUPPORTED_MEDIA_FORMAT',
            message: 'Yalnizca JPEG, PNG veya WEBP fotograf yukleyebilirsiniz.',
            traceId: 'iz-1',
          },
        },
        400,
      ),
    );
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => 'token-abc',
      fetchImpl,
    });

    await expect(client.request('/reports/r-1/photos')).rejects.toMatchObject({
      code: 'UNSUPPORTED_MEDIA_FORMAT',
      status: 400,
      message: 'Yalnizca JPEG, PNG veya WEBP fotograf yukleyebilirsiniz.',
    });
  });

  it('zarf cozulemeyen hata yanitinda genel ApiError firlatir', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(brokenResponse(502));
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => null,
      fetchImpl,
    });

    const error: unknown = await client.request('/reports/r-1/photos').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('INTERNAL_ERROR');
  });

  it('204 yanitinda govde cozmeye calismaz', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 204,
      json: () => Promise.reject(new Error('govde yok')),
    });
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => null,
      fetchImpl,
    });

    await expect(client.request('/reports/r-1/photos')).resolves.toBeUndefined();
  });
});
