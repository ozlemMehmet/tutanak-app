import type { ApiClient } from '../../api/client';
import { startCheckout } from './billing.api';

describe('startCheckout', () => {
  it('odeme oturumunu POST /billing/checkout ile baslatir', async () => {
    const response = {
      transactionReference: 'txn-1',
      checkoutUrl: 'https://odeme.example.test/oturum/txn-1',
      amount: '199.00',
      currency: 'TRY',
    };
    const request = jest.fn().mockResolvedValue(response);
    const client = { request } as unknown as ApiClient;

    await expect(startCheckout(client)).resolves.toEqual(response);
    expect(request).toHaveBeenCalledWith('/billing/checkout', { method: 'POST' });
  });
});
