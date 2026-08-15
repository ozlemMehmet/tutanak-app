// Oturum guard'i (T-017 kriter 2): token yokken korumali icerik render EDILMEZ, kullanici
// `/login`'e gonderilir ve hedef rota `redirectTo` sorgu parametresinde korunur.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ACCESS_TOKEN_STORAGE_KEY } from '../api/access-token';
import { createSessionStore } from '../features/auth/session';
import { SessionProvider } from '../features/auth/SessionProvider';
import { RequireAuth } from './RequireAuth';

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <span data-testid="konum">{`${location.pathname}${location.search}`}</span>;
}

describe('RequireAuth', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  const renderAt = (initialPath: string, accessToken: string | null): void => {
    if (accessToken !== null) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, accessToken);
    }
    const store = createSessionStore(window.localStorage);

    render(
      <SessionProvider store={store}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationProbe />
          <Routes>
            <Route
              path="/gizli/*"
              element={
                <RequireAuth>
                  <span>korumali icerik</span>
                </RequireAuth>
              }
            />
            <Route path="/login" element={<span>giris ekrani</span>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>,
    );
  };

  it('token yokken korumali icerigi gostermez ve /login"e yonlendirir', () => {
    renderAt('/gizli', null);

    expect(screen.queryByText('korumali icerik')).not.toBeInTheDocument();
    expect(screen.getByText('giris ekrani')).toBeInTheDocument();
  });

  it('token yokken hedef rotayi redirectTo sorgu parametresinde korur', () => {
    renderAt('/gizli/derin', null);

    expect(screen.getByTestId('konum')).toHaveTextContent(
      `/login?redirectTo=${encodeURIComponent('/gizli/derin')}`,
    );
  });

  it('hedef rotanin sorgu dizesini de redirectTo icinde korur', () => {
    renderAt('/gizli/derin?q=kira&page=2', null);

    expect(screen.getByTestId('konum')).toHaveTextContent(
      `/login?redirectTo=${encodeURIComponent('/gizli/derin?q=kira&page=2')}`,
    );
  });

  it('token varken korumali icerigi render eder ve yonlendirme yapmaz', () => {
    renderAt('/gizli', 'token-abc');

    expect(screen.getByText('korumali icerik')).toBeInTheDocument();
    expect(screen.getByTestId('konum')).toHaveTextContent('/gizli');
  });
});
