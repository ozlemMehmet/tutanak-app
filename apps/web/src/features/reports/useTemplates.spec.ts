// Yeniden deneme politikasi saf bir fonksiyondur ve dogrudan test edilir: sablon listesi
// yuklenemedginde kullanici hata durumunu (banner + "Tekrar Dene") beklemeden gormelidir.
import { ApiError } from '../../api/client';
import { shouldRetryTemplates, templatesQueryKey } from './useTemplates';

describe('templatesQueryKey', () => {
  it('sablon listesi icin sabit onbellek anahtari kullanir', () => {
    expect(templatesQueryKey).toEqual(['templates']);
  });
});

describe('shouldRetryTemplates', () => {
  it('istemci hatasini (4xx) tekrar DENEMEZ', () => {
    const error = new ApiError('UNAUTHORIZED', 'Oturum bulunamadi.', 401);

    expect(shouldRetryTemplates(0, error)).toBe(false);
  });

  it('hiz sinirini (429) tekrar DENEMEZ', () => {
    const error = new ApiError('RATE_LIMIT_EXCEEDED', 'Cok fazla istek.', 429);

    expect(shouldRetryTemplates(0, error)).toBe(false);
  });

  it('sunucu hatasini (500) yalnizca bir kez tekrar dener', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500);

    expect(shouldRetryTemplates(0, error)).toBe(true);
    expect(shouldRetryTemplates(1, error)).toBe(false);
  });

  it('ag hatasini (zarf olmayan hata) yalnizca bir kez tekrar dener', () => {
    const error = new Error('baglanti koptu');

    expect(shouldRetryTemplates(0, error)).toBe(true);
    expect(shouldRetryTemplates(1, error)).toBe(false);
  });
});
