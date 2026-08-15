// Onay cagrisi: yol sozlesmedeki /public/reports/{shareToken}/approval bicimini kurar ve
// govdede YALNIZCA `approverEmail` tasir (tarih alani gonderilmez — CLAUDE.md §3.7).
import { approveReport } from './approvals.api';

const APPROVAL = { id: 'onay-1', approverEmail: 'kiraci@ornek.test', approvedAt: '2026-08-15' };

describe('approveReport', () => {
  it('sozlesmedeki onay yolunu POST ile cagirir', async () => {
    const request = jest.fn().mockResolvedValue(APPROVAL);

    await approveReport({ request }, 'abc-token', 'kiraci@ornek.test');

    expect(request).toHaveBeenCalledWith('/public/reports/abc-token/approval', {
      method: 'POST',
      body: JSON.stringify({ approverEmail: 'kiraci@ornek.test' }),
    });
  });

  it('token icindeki ozel karakterleri URL icin kodlar', async () => {
    const request = jest.fn().mockResolvedValue(APPROVAL);

    await approveReport({ request }, 'a/b?c#d', 'kiraci@ornek.test');

    expect(request).toHaveBeenCalledWith('/public/reports/a%2Fb%3Fc%23d/approval', {
      method: 'POST',
      body: JSON.stringify({ approverEmail: 'kiraci@ornek.test' }),
    });
  });

  it('sunucunun donderdigi onay kaydini oldugu gibi doner', async () => {
    const request = jest.fn().mockResolvedValue(APPROVAL);

    await expect(approveReport({ request }, 'abc-token', 'kiraci@ornek.test')).resolves.toEqual(
      APPROVAL,
    );
  });
});
