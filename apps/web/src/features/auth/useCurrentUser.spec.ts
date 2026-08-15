import { ApiError } from '../../api/client';
import { shouldRetryCurrentUser } from './useCurrentUser';

describe('shouldRetryCurrentUser', () => {
  it('401 yanitini tekrar denemez (oturum zaten sonlanmistir)', () => {
    expect(shouldRetryCurrentUser(0, new ApiError('UNAUTHENTICATED', 'Oturum doldu.', 401))).toBe(
      false,
    );
  });

  it('429 yanitini tekrar denemez', () => {
    expect(
      shouldRetryCurrentUser(0, new ApiError('RATE_LIMIT_EXCEEDED', 'Cok fazla istek.', 429)),
    ).toBe(false);
  });

  it('sunucu hatasini sinirli sayida tekrar dener', () => {
    const error = new ApiError('INTERNAL_ERROR', 'Beklenmeyen hata.', 500);

    expect(shouldRetryCurrentUser(0, error)).toBe(true);
    expect(shouldRetryCurrentUser(1, error)).toBe(true);
    expect(shouldRetryCurrentUser(2, error)).toBe(false);
  });

  it('ag hatasini (ApiError olmayan) sinirli sayida tekrar dener', () => {
    expect(shouldRetryCurrentUser(0, new Error('ag kopuk'))).toBe(true);
    expect(shouldRetryCurrentUser(2, new Error('ag kopuk'))).toBe(false);
  });
});
