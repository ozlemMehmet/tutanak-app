import { act, render, screen } from '@testing-library/react';
import { ACCESS_TOKEN_STORAGE_KEY } from '../../api/access-token';
import { createSessionStore } from './session';
import { SessionProvider, useAccessToken, useSessionStore } from './SessionProvider';

function TokenProbe(): React.JSX.Element {
  const accessToken = useAccessToken();
  return <span data-testid="token">{accessToken ?? 'yok'}</span>;
}

describe('SessionProvider', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  it('depodaki token"i tuketicilere aktarir', () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');
    const store = createSessionStore(window.localStorage);

    render(
      <SessionProvider store={store}>
        <TokenProbe />
      </SessionProvider>,
    );

    expect(screen.getByTestId('token')).toHaveTextContent('token-abc');
  });

  it('kaynak disaridan degistiginde tuketiciyi yeniden render eder', () => {
    const store = createSessionStore(window.localStorage);
    render(
      <SessionProvider store={store}>
        <TokenProbe />
      </SessionProvider>,
    );
    expect(screen.getByTestId('token')).toHaveTextContent('yok');

    act(() => {
      store.signIn('token-yeni');
    });

    expect(screen.getByTestId('token')).toHaveTextContent('token-yeni');
  });

  it('signOut sonrasi token"i null olarak yansitir', () => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');
    const store = createSessionStore(window.localStorage);
    render(
      <SessionProvider store={store}>
        <TokenProbe />
      </SessionProvider>,
    );

    act(() => {
      store.signOut();
    });

    expect(screen.getByTestId('token')).toHaveTextContent('yok');
  });
});

describe('useSessionStore', () => {
  it('SessionProvider disinda kullanildiginda hata firlatir', () => {
    function OrphanProbe(): React.JSX.Element {
      useSessionStore();
      return <span>olmaz</span>;
    }
    // React hata siniri olmadan hatayi konsola basar; test ciktisini kirletmemek icin susturulur.
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => render(<OrphanProbe />)).toThrow('SessionProvider');

    consoleError.mockRestore();
  });
});
