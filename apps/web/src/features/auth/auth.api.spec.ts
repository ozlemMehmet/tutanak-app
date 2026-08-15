import type { ApiClient } from '../../api/client';
import { fetchCurrentUser } from './auth.api';

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
