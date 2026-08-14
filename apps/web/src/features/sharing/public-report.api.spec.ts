// Oturumsuz goruntuleme cagrisi: yol sozlesmedeki /public/reports/{shareToken} bicimini
// kurar ve GET disinda hicbir istek YAPMAZ (T-009 kriter 3).
import { fetchPublicReport } from './public-report.api';

describe('fetchPublicReport', () => {
  it('sozlesmedeki genel goruntuleme yolunu cagirir', async () => {
    const request = jest.fn().mockResolvedValue({ title: 'Tutanak' });

    await fetchPublicReport({ request }, 'abc-token');

    expect(request).toHaveBeenCalledWith('/public/reports/abc-token');
  });

  it('token icindeki ozel karakterleri URL icin kodlar', async () => {
    const request = jest.fn().mockResolvedValue({ title: 'Tutanak' });

    await fetchPublicReport({ request }, 'a/b?c#d');

    expect(request).toHaveBeenCalledWith('/public/reports/a%2Fb%3Fc%23d');
  });

  it('yazma yontemi (method) GONDERMEZ — varsayilan GET kalir (kriter 3)', async () => {
    const request = jest.fn().mockResolvedValue({ title: 'Tutanak' });

    await fetchPublicReport({ request }, 'abc-token');

    expect(request.mock.calls[0]).toHaveLength(1);
  });
});
