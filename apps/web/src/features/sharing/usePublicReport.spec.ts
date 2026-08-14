// Yeniden deneme politikasi saf bir fonksiyondur ve dogrudan test edilir: gecersiz link
// (404) ile hiz siniri (429) tekrarlanmaz — kiraci hata ekranini beklemeden gorur.
import { ApiError } from '../../api/client';
import { publicReportQueryKey, shouldRetryPublicReport } from './usePublicReport';

describe('publicReportQueryKey', () => {
  it('token basina ayri onbellek anahtari uretir', () => {
    expect(publicReportQueryKey('abc')).toEqual(['public-report', 'abc']);
    expect(publicReportQueryKey('abc')).not.toEqual(publicReportQueryKey('xyz'));
  });
});

describe('shouldRetryPublicReport', () => {
  it('gecersiz token (404) yanitini tekrar DENEMEZ', () => {
    const error = new ApiError('SHARE_LINK_NOT_FOUND', 'Bu baglanti gecersiz.', 404);

    expect(shouldRetryPublicReport(0, error)).toBe(false);
  });

  it('hiz siniri (429) yanitini tekrar DENEMEZ', () => {
    const error = new ApiError('RATE_LIMIT_EXCEEDED', 'Cok fazla istek.', 429);

    expect(shouldRetryPublicReport(0, error)).toBe(false);
  });

  it('sunucu hatasini (500) sinirli sayida tekrar dener', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Beklenmeyen hata.', 500);

    expect(shouldRetryPublicReport(0, error)).toBe(true);
    expect(shouldRetryPublicReport(1, error)).toBe(true);
    expect(shouldRetryPublicReport(2, error)).toBe(false);
  });

  it('ag hatasini (zarf olmayan hata) sinirli sayida tekrar dener', () => {
    const error = new Error('baglanti koptu');

    expect(shouldRetryPublicReport(0, error)).toBe(true);
    expect(shouldRetryPublicReport(2, error)).toBe(false);
  });
});
