import { ACCESS_TOKEN_STORAGE_KEY, readAccessToken } from './access-token';

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
