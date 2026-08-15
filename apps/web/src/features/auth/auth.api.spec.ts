import type { ApiClient } from '../../api/client';
import { fetchCurrentUser, login, registerUser } from './auth.api';

const CREDENTIALS = { email: 'selin@ornek.com', password: 'cok-gizli-8' };

describe('fetchCurrentUser', () => {
  it('GET /me adresini cagirir ve yaniti oldugu gibi doner', async () => {
    const me = {
      id: 'kullanici-1',
      email: 'selin@ornek.com',
      createdAt: '2026-08-01T10:00:00.000Z',
      subscription: {
        status: 'inactive',
        priceAmount: null,
        currency: 'TRY',
        currentPeriodEnd: null,
      },
    };
    const request = jest.fn().mockResolvedValue(me);
    const client = { request } as unknown as ApiClient;

    await expect(fetchCurrentUser(client)).resolves.toEqual(me);

    expect(request).toHaveBeenCalledWith('/me');
  });
});

describe('login', () => {
  it('POST /auth/login adresine yalnizca e-posta ve sifreyi gonderir', async () => {
    const loginResponse = {
      accessToken: 'jwt-token',
      expiresIn: 604800,
      user: { id: 'kullanici-1', email: CREDENTIALS.email, createdAt: '2026-08-01T10:00:00.000Z' },
    };
    const request = jest.fn().mockResolvedValue(loginResponse);
    const client = { request } as unknown as ApiClient;

    await expect(login(client, CREDENTIALS)).resolves.toEqual(loginResponse);

    expect(request).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: CREDENTIALS.email, password: CREDENTIALS.password }),
    });
  });
});

describe('registerUser', () => {
  it('POST /auth/register adresine yalnizca e-posta ve sifreyi gonderir', async () => {
    const user = {
      id: 'kullanici-1',
      email: CREDENTIALS.email,
      createdAt: '2026-08-01T10:00:00.000Z',
    };
    const request = jest.fn().mockResolvedValue(user);
    const client = { request } as unknown as ApiClient;

    await expect(registerUser(client, CREDENTIALS)).resolves.toEqual(user);

    expect(request).toHaveBeenCalledWith('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: CREDENTIALS.email, password: CREDENTIALS.password }),
    });
  });

  it('cagirana fazladan alan verilse bile govdeye YALNIZCA sozlesme alanlarini koyar', async () => {
    const request = jest.fn().mockResolvedValue({});
    const client = { request } as unknown as ApiClient;
    // `passwordConfirm` istemci tarafi bir dogrulamadir; RegisterRequest'te yeri yoktur
    // ve sunucu govde katiligi geregi 400 dondurur (CLAUDE.md §3.7).
    const withExtra = { ...CREDENTIALS, passwordConfirm: CREDENTIALS.password };

    await registerUser(client, withExtra);

    const [, init] = request.mock.calls[0] as [string, { body: string }];
    expect(JSON.parse(init.body)).toEqual({
      email: CREDENTIALS.email,
      password: CREDENTIALS.password,
    });
  });
});
