// Kimlik formlarinin hata cozumlemesi (T-018). Kural kaynagi: design.md §3 LoginPage/
// RegisterPage error durumlari + CLAUDE.md §4.3 (istemci hata KODUNA gore dallanir).
import { ApiError } from '../../api/client';
import { INVALID_CREDENTIALS_MESSAGE, RATE_LIMITED_MESSAGE, toAuthFormError } from './auth-error';

const LOGIN_OPTIONS = {
  knownFields: ['email', 'password'] as const,
  fallbackMessage: 'Giris yapilamadi, birazdan tekrar deneyin',
};

describe('toAuthFormError', () => {
  it('hata yokken banner ve alan hatasi uretmez', () => {
    expect(toAuthFormError(null, LOGIN_OPTIONS)).toEqual({ banner: null, fields: {} });
  });

  it('401 INVALID_CREDENTIALS icin form-genel banner doner ve HICBIR alan hatasi baglamaz', () => {
    const error = new ApiError('INVALID_CREDENTIALS', 'E-posta veya sifre hatali.', 401);

    expect(toAuthFormError(error, LOGIN_OPTIONS)).toEqual({
      banner: INVALID_CREDENTIALS_MESSAGE,
      fields: {},
    });
  });

  it('401 yaniti alan bazli detay tasisa bile alan hatasina cevirmez (kullanici numaralandirma)', () => {
    const error = new ApiError('INVALID_CREDENTIALS', 'E-posta veya sifre hatali.', 401, [
      { field: 'email', message: 'bu e-posta kayitli degil' },
    ]);

    expect(toAuthFormError(error, LOGIN_OPTIONS)).toEqual({
      banner: INVALID_CREDENTIALS_MESSAGE,
      fields: {},
    });
  });

  it('429 RATE_LIMIT_EXCEEDED icin hiz siniri banner metnini doner', () => {
    const error = new ApiError('RATE_LIMIT_EXCEEDED', 'Cok fazla istek.', 429);

    expect(toAuthFormError(error, LOGIN_OPTIONS)).toEqual({
      banner: RATE_LIMITED_MESSAGE,
      fields: {},
    });
  });

  it('kodu tanimasa da 429 durum kodunu hiz siniri olarak yorumlar', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Beklenmeyen hata.', 429);

    expect(toAuthFormError(error, LOGIN_OPTIONS).banner).toBe(RATE_LIMITED_MESSAGE);
  });

  it('400 VALIDATION_ERROR detaylarini ilgili alanlara baglar, banner gostermez', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Girdi dogrulanamadi.', 400, [
      { field: 'email', message: 'gecerli bir e-posta adresi giriniz' },
      { field: 'password', message: 'en az 8 karakter olmalidir' },
    ]);

    expect(toAuthFormError(error, LOGIN_OPTIONS)).toEqual({
      banner: null,
      fields: {
        email: 'gecerli bir e-posta adresi giriniz',
        password: 'en az 8 karakter olmalidir',
      },
    });
  });

  it('409 EMAIL_ALREADY_REGISTERED detayini e-posta alaninin altina baglar', () => {
    const error = new ApiError('EMAIL_ALREADY_REGISTERED', 'Bu e-posta zaten kayitli.', 409, [
      { field: 'email', message: 'bu e-posta zaten kayitli' },
    ]);

    expect(
      toAuthFormError(error, {
        knownFields: ['email', 'password', 'passwordConfirm'],
        fallbackMessage: 'Kayit tamamlanamadi, birazdan tekrar deneyin',
      }),
    ).toEqual({ banner: null, fields: { email: 'bu e-posta zaten kayitli' } });
  });

  it('formda karsiligi olmayan alan detayini banner olarak gosterir (mesaj kaybolmaz)', () => {
    const error = new ApiError('VALIDATION_ERROR', 'Girdi dogrulanamadi.', 400, [
      { field: 'bilinmeyenAlan', message: 'gecersiz deger' },
    ]);

    expect(toAuthFormError(error, LOGIN_OPTIONS)).toEqual({
      banner: 'Girdi dogrulanamadi.',
      fields: {},
    });
  });

  it('detay tasimayan diger API hatalarinda sunucu mesajini banner olarak gosterir', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir hata olustu.', 500);

    expect(toAuthFormError(error, LOGIN_OPTIONS)).toEqual({
      banner: 'Beklenmeyen bir hata olustu.',
      fields: {},
    });
  });

  it('API hatasi olmayan (ag kesintisi gibi) durumda yedek mesaji gosterir', () => {
    expect(toAuthFormError(new TypeError('Failed to fetch'), LOGIN_OPTIONS)).toEqual({
      banner: LOGIN_OPTIONS.fallbackMessage,
      fields: {},
    });
  });
});
