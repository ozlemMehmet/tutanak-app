import {
  ACCESS_TOKEN_STORAGE_KEY,
  clearAccessToken,
  readAccessToken,
  writeAccessToken,
} from './access-token';

describe('readAccessToken', () => {
  it('depoda kayitli token"i doner', () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');

    expect(readAccessToken(window.localStorage)).toBe('token-abc');
  });

  it('token yokken null doner', () => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

    expect(readAccessToken(window.localStorage)).toBeNull();
  });
});

describe('writeAccessToken', () => {
  it('token"i ayni anahtarla depoya yazar ve okuma tarafi ayni degeri gorur', () => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

    writeAccessToken(window.localStorage, 'token-xyz');

    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe('token-xyz');
    expect(readAccessToken(window.localStorage)).toBe('token-xyz');
  });

  it('onceki token"in uzerine yazar', () => {
    writeAccessToken(window.localStorage, 'token-eski');

    writeAccessToken(window.localStorage, 'token-yeni');

    expect(readAccessToken(window.localStorage)).toBe('token-yeni');
  });
});

describe('clearAccessToken', () => {
  it('kayitli token"i depodan siler', () => {
    writeAccessToken(window.localStorage, 'token-abc');

    clearAccessToken(window.localStorage);

    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(readAccessToken(window.localStorage)).toBeNull();
  });

  it('kayitli token yokken hata firlatmaz', () => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);

    expect(() => {
      clearAccessToken(window.localStorage);
    }).not.toThrow();
  });
});
