import { ACCESS_TOKEN_STORAGE_KEY } from '../../api/access-token';
import { createSessionStore } from './session';

describe('createSessionStore', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  it('acilista depodaki token"i anlik goruntu olarak doner', () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');

    const store = createSessionStore(window.localStorage);

    expect(store.getAccessToken()).toBe('token-abc');
  });

  it('depoda token yokken null doner', () => {
    const store = createSessionStore(window.localStorage);

    expect(store.getAccessToken()).toBeNull();
  });

  it('signIn token"i depoya yazar ve aboneleri uyarir', () => {
    const store = createSessionStore(window.localStorage);
    const listener = jest.fn();
    store.subscribe(listener);

    store.signIn('token-yeni');

    expect(store.getAccessToken()).toBe('token-yeni');
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe('token-yeni');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('signOut token"i depodan siler ve aboneleri uyarir', () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');
    const store = createSessionStore(window.localStorage);
    const listener = jest.fn();
    store.subscribe(listener);

    store.signOut();

    expect(store.getAccessToken()).toBeNull();
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('anlik goruntu ayni deger icin kararli referans doner (useSyncExternalStore dongusu olmaz)', () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');
    const store = createSessionStore(window.localStorage);

    expect(store.getAccessToken()).toBe(store.getAccessToken());
  });

  it('abonelikten cikan dinleyici sonraki degisiklikte cagrilmaz', () => {
    const store = createSessionStore(window.localStorage);
    const listener = jest.fn();
    const unsubscribe = store.subscribe(listener);

    unsubscribe();
    store.signIn('token-yeni');

    expect(listener).not.toHaveBeenCalled();
  });
});
