// Liste sorgusunun onbellek anahtari ve yeniden deneme politikasi saf fonksiyonlardir
// ve dogrudan test edilir (T-021 kriter 2, 5, 6).
import { ApiError } from '../../api/client';
import { reportListQueryKey, shouldRetryReportList } from './useReports';

describe('reportListQueryKey', () => {
  it('arama terimi ve sayfa numarasini anahtarin parcasi yapar', () => {
    expect(reportListQueryKey({ q: 'kapi', page: 2 })).toEqual(['reports', 'kapi', 2]);
  });

  it('farkli sayfalar farkli anahtar uretir (sayfa degisince yeni istek yapilir)', () => {
    expect(reportListQueryKey({ q: '', page: 1 })).not.toEqual(
      reportListQueryKey({ q: '', page: 2 }),
    );
  });
});

describe('shouldRetryReportList', () => {
  it('istemci hatasini (4xx) tekrar DENEMEZ', () => {
    expect(shouldRetryReportList(0, new ApiError('VALIDATION_ERROR', 'Gecersiz.', 400))).toBe(
      false,
    );
  });

  it('sunucu hatasini (500) yalnizca bir kez tekrar dener', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500);

    expect(shouldRetryReportList(0, error)).toBe(true);
    expect(shouldRetryReportList(1, error)).toBe(false);
  });

  it('ag hatasini (zarf olmayan hata) yalnizca bir kez tekrar dener', () => {
    const error = new Error('baglanti koptu');

    expect(shouldRetryReportList(0, error)).toBe(true);
    expect(shouldRetryReportList(1, error)).toBe(false);
  });
});
