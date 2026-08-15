// Rota haritasi + oturum korumasi (T-017). Kabul kriterlerinin tamami bu dosyada rota
// seviyesinde dogrulanir: design.md §1'deki her rota tanimli mi, korumali rotalar token
// olmadan `/login`'e gidiyor mu, `redirectTo` korunuyor mu, 401 ve cikis oturumu bitiriyor mu.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { ACCESS_TOKEN_STORAGE_KEY } from './api/access-token';
import type { ApiClient } from './api/client';
import { createSessionStore } from './features/auth/session';
import type { SessionStore } from './features/auth/session';
import { createSessionAwareClient } from './features/auth/session-client';
import { SessionProvider } from './features/auth/SessionProvider';
import { AppRoutes } from './router';

const ME = {
  id: 'kullanici-1',
  email: 'selin@ornek.com',
  createdAt: '2026-08-01T10:00:00.000Z',
  subscription: {
    status: 'inactive',
    priceAmount: null,
    currency: 'TRY',
    currentPeriodEnd: null,
  },
};

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <span data-testid="konum">{`${location.pathname}${location.search}`}</span>;
}

/** Cikis sonrasi "korumali rotaya geri donus" senaryosu icin test gezinme dugmesi. */
function NavProbe(): React.JSX.Element {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => {
        void navigate('/reports');
      }}
    >
      test: korumali rotaya git
    </button>
  );
}

describe('AppRoutes', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  /** Sayfalarin kendi cagrilarini (fotograflar, paylasim linki) bos veriyle karsilar. */
  const defaultRequest = (): jest.Mock =>
    jest.fn((path: string) => {
      if (path === '/me') {
        return Promise.resolve(ME);
      }
      return Promise.resolve([]);
    });

  const renderAt = (
    initialPath: string,
    options: { accessToken?: string; client?: ApiClient; store?: SessionStore } = {},
  ): { store: SessionStore } => {
    if (options.accessToken !== undefined) {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, options.accessToken);
    }
    const store = options.store ?? createSessionStore(window.localStorage);
    const client = options.client ?? { request: defaultRequest() };
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider store={store}>
          <MemoryRouter initialEntries={[initialPath]}>
            <LocationProbe />
            <NavProbe />
            <AppRoutes client={client} />
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>,
    );

    return { store };
  };

  describe('rota haritasi (design.md §1 ekran envanteri)', () => {
    it('/login rotasini token olmadan render eder', () => {
      renderAt('/login');

      expect(screen.getByRole('heading', { name: 'Giris Yap' })).toBeInTheDocument();
    });

    it('/register rotasini token olmadan render eder', () => {
      renderAt('/register');

      expect(screen.getByRole('heading', { name: 'Kayit Ol' })).toBeInTheDocument();
    });

    it('/t/:token rotasini token olmadan render eder (kiraci akisi oturum gerektirmez)', () => {
      renderAt('/t/paylasim-tokeni');

      expect(screen.getByText('Tutanak yukleniyor...')).toBeInTheDocument();
      expect(screen.getByTestId('konum')).toHaveTextContent('/t/paylasim-tokeni');
    });

    it('/reports rotasini oturum acikken render eder', async () => {
      renderAt('/reports', { accessToken: 'token-abc' });

      expect(await screen.findByRole('heading', { name: 'Tutanaklarim' })).toBeInTheDocument();
    });

    it('/reports/new rotasini oturum acikken render eder (detay rotasina dusmez)', async () => {
      renderAt('/reports/new', { accessToken: 'token-abc' });

      expect(await screen.findByRole('heading', { name: 'Yeni Tutanak' })).toBeInTheDocument();
    });

    it('/reports/:id rotasini oturum acikken tutanak detayina baglar', async () => {
      renderAt('/reports/r-1', { accessToken: 'token-abc' });

      expect(await screen.findByRole('heading', { name: 'Tutanak' })).toBeInTheDocument();
    });

    it('/subscription rotasini oturum acikken render eder', async () => {
      renderAt('/subscription', { accessToken: 'token-abc' });

      expect(await screen.findByRole('heading', { name: 'Abonelik' })).toBeInTheDocument();
    });

    it('kok adresi tutanak listesine tasir', async () => {
      renderAt('/', { accessToken: 'token-abc' });

      expect(await screen.findByRole('heading', { name: 'Tutanaklarim' })).toBeInTheDocument();
      expect(screen.getByTestId('konum')).toHaveTextContent('/reports');
    });

    // T-018: kimlik ekranlari da API istemcisine baglanir. Bu test rota seviyesindeki
    // baglantiyi (prop gecisi) dogrular; ekranin kendi davranisi LoginPage.spec.tsx'tedir.
    it('/login rotasindaki form gonderildiginde API istemcisini kullanir', async () => {
      const request = jest.fn((path: string) => {
        if (path === '/auth/login') {
          return Promise.resolve({
            accessToken: 'token-abc',
            expiresIn: 604800,
            user: ME,
          });
        }
        if (path === '/me') {
          return Promise.resolve(ME);
        }
        return Promise.resolve([]);
      });
      renderAt('/login', { client: { request } as unknown as ApiClient });

      await userEvent.type(screen.getByLabelText('E-posta'), 'selin@ornek.com');
      await userEvent.type(screen.getByLabelText('Sifre'), 'cok-gizli-8');
      await userEvent.click(screen.getByRole('button', { name: 'Giris Yap' }));

      expect(await screen.findByRole('heading', { name: 'Tutanaklarim' })).toBeInTheDocument();
      expect(request).toHaveBeenCalledWith('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'selin@ornek.com', password: 'cok-gizli-8' }),
      });
    });
  });

  describe('oturum korumasi', () => {
    it.each([
      ['/reports', '/reports'],
      ['/reports/new', '/reports/new'],
      ['/reports/r-1', '/reports/r-1'],
      ['/subscription', '/subscription'],
    ])(
      'token yokken %s adresinden /login"e yonlendirir ve hedefi korur',
      (path, expectedTarget) => {
        renderAt(path);

        expect(screen.getByRole('heading', { name: 'Giris Yap' })).toBeInTheDocument();
        expect(screen.getByTestId('konum')).toHaveTextContent(
          `/login?redirectTo=${encodeURIComponent(expectedTarget)}`,
        );
      },
    );

    it('token yokken korumali ekranin icerigini hic render etmez', () => {
      renderAt('/reports');

      expect(screen.queryByRole('heading', { name: 'Tutanaklarim' })).not.toBeInTheDocument();
    });

    it('token varken korumali ekran AppShell icinde kullanici e-postasini gosterir', async () => {
      renderAt('/reports', { accessToken: 'token-abc' });

      expect(await screen.findByText('selin@ornek.com')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Tutanaklarim' })).toBeInTheDocument();
    });

    it('genel rotalarda AppShell (ve dolayisiyla /me cagrisi) yoktur', () => {
      const request = defaultRequest();
      renderAt('/t/paylasim-tokeni', { client: { request } as unknown as ApiClient });

      expect(screen.queryByRole('button', { name: 'Cikis' })).not.toBeInTheDocument();
      expect(request).not.toHaveBeenCalledWith('/me');
    });
  });

  describe('oturum sonlanmasi', () => {
    it('korumali ekranda API 401 dondugunde oturum temizlenir ve /login"e yonlendirilir', async () => {
      window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-suresi-dolmus');
      const store = createSessionStore(window.localStorage);
      const fetchImpl = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () =>
          Promise.resolve({
            error: { code: 'UNAUTHENTICATED', message: 'Oturum suresi doldu.', traceId: 'iz-1' },
          }),
      });
      const client = createSessionAwareClient({
        baseUrl: '/api/v1',
        session: store,
        fetchImpl,
      });

      renderAt('/reports', { store, client });

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/login');
      });
      expect(store.getAccessToken()).toBeNull();
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
      expect(screen.getByRole('heading', { name: 'Giris Yap' })).toBeInTheDocument();
    });

    it('Cikis token"i siler, /login"e goturur ve korumali rotaya donus yine /login"e dusurur', async () => {
      const { store } = renderAt('/reports', { accessToken: 'token-abc' });
      await screen.findByText('selin@ornek.com');

      await userEvent.click(screen.getByRole('button', { name: 'Cikis' }));

      expect(screen.getByRole('heading', { name: 'Giris Yap' })).toBeInTheDocument();
      expect(store.getAccessToken()).toBeNull();
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'test: korumali rotaya git' }));

      expect(screen.getByRole('heading', { name: 'Giris Yap' })).toBeInTheDocument();
      expect(screen.getByTestId('konum')).toHaveTextContent(
        `/login?redirectTo=${encodeURIComponent('/reports')}`,
      );
    });
  });
});
