// Paylasim API istemcisi: cagrilar YALNIZCA client uzerinden yapilir (CLAUDE.md §3.9).
import type { ApiClient } from '../../api/client';
import { createShareLink, sendShareEmail } from './sharing.api';

describe('sharing.api', () => {
  it('createShareLink idempotent POST /reports/{id}/share-link cagrisi yapar', async () => {
    const request = jest.fn().mockResolvedValue({ token: 't' });

    await createShareLink({ request } as unknown as ApiClient, 'r-1');

    expect(request).toHaveBeenCalledWith('/reports/r-1/share-link', { method: 'POST' });
  });

  it('sendShareEmail govdeye YALNIZCA recipientEmail koyar (sozlesme: additionalProperties false)', async () => {
    const request = jest.fn().mockResolvedValue({ status: 'sent' });

    await sendShareEmail({ request } as unknown as ApiClient, 'r-1', 'kiraci@ornek.test');

    expect(request).toHaveBeenCalledWith('/reports/r-1/share-link/email', {
      method: 'POST',
      body: JSON.stringify({ recipientEmail: 'kiraci@ornek.test' }),
    });
  });
});
