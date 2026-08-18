// LoginPage (`/login`) — design.md §3 LoginPage sartnamesi, T-018 kriter 1-5.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ACCESS_TOKEN_STORAGE_KEY } from '../api/access-token';
import { ApiError } from '../api/client';
import type { ApiClient } from '../api/client';
import { createSessionStore } from '../features/auth/session';
import type { SessionStore } from '../features/auth/session';
import { SessionProvider } from '../features/auth/SessionProvider';
import { LoginPage } from './LoginPage';

const EMAIL = 'selin@ornek.com';
const PASSWORD = 'cok-gizli-8';
const LOGIN_RESPONSE = {
  accessToken: 'jwt-token',
  expiresIn: 604800,
  user: { id: 'kullanici-1', email: EMAIL, createdAt: '2026-08-01T10:00:00.000Z' },
};

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return (
    <span data-testid="konum">{`${location.pathname}${location.search}${location.hash}`}</span>
  );
}

function renderLoginPage(request: jest.Mock, initialPath = '/login'): { session: SessionStore } {
  const session = createSessionStore(window.localStorage);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = { request } as unknown as ApiClient;

  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider store={session}>
        <MemoryRouter initialEntries={[initialPath]}>
          <LocationProbe />
          <Routes>
            <Route path="/login" element={<LoginPage client={client} />} />
            <Route path="/register" element={<h1>Kayıt Ol</h1>} />
            <Route path="/reports" element={<h1>Tutanaklarım</h1>} />
            <Route path="/reports/:reportId" element={<h1>Tutanak</h1>} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );

  return { session };
}

async function fillAndSubmit(): Promise<void> {
  await userEvent.type(screen.getByLabelText('E-posta'), EMAIL);
  await userEvent.type(screen.getByLabelText('Şifre'), PASSWORD);
  await userEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  describe('render (kriter 1)', () => {
    it('e-posta, sifre alanlari ve Giriş Yap butonu ile render edilir', () => {
      renderLoginPage(jest.fn());

      expect(screen.getByRole('heading', { name: 'Giriş Yap' })).toBeInTheDocument();
      expect(screen.getByLabelText('E-posta')).toBeInTheDocument();
      expect(screen.getByLabelText('Şifre')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Giriş Yap' })).toBeInTheDocument();
    });

    it('sifre alaninda goster/gizle kontrolu sunar', async () => {
      renderLoginPage(jest.fn());

      expect(screen.getByLabelText('Şifre')).toHaveAttribute('type', 'password');
      await userEvent.click(screen.getByRole('button', { name: 'Şifreyi göster' }));
      expect(screen.getByLabelText('Şifre')).toHaveAttribute('type', 'text');
    });

    it('kayit ekranina giden bir baglanti gosterir (design.md alt bolge)', () => {
      renderLoginPage(jest.fn());

      expect(screen.getByRole('link', { name: 'Kayıt olun' })).toHaveAttribute('href', '/register');
    });
  });

  describe('basarili giris (kriter 2)', () => {
    it('girilen bilgilerle /auth/login cagirir', async () => {
      const request = jest.fn().mockResolvedValue(LOGIN_RESPONSE);
      renderLoginPage(request);

      await fillAndSubmit();

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
        });
      });
    });

    it('token"i saklar ve redirectTo yokken /reports adresine yonlendirir', async () => {
      const request = jest.fn().mockResolvedValue(LOGIN_RESPONSE);
      const { session } = renderLoginPage(request);

      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/reports');
      });
      expect(session.getAccessToken()).toBe('jwt-token');
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBe('jwt-token');
    });

    it('redirectTo varsa korunan hedef rotaya yonlendirir', async () => {
      const request = jest.fn().mockResolvedValue(LOGIN_RESPONSE);
      renderLoginPage(request, `/login?redirectTo=${encodeURIComponent('/reports/abc-123')}`);

      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/reports/abc-123');
      });
    });

    it('redirectTo dis bir adresi gosteriyorsa varsayilan rotaya duser', async () => {
      const request = jest.fn().mockResolvedValue(LOGIN_RESPONSE);
      renderLoginPage(request, `/login?redirectTo=${encodeURIComponent('https://kotu.example')}`);

      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/reports');
      });
    });
  });

  describe('hata durumlari (kriter 3-4)', () => {
    it('401 INVALID_CREDENTIALS icin form-genel banner gosterir', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.', 401));
      renderLoginPage(request);

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent('E-posta veya şifre hatalı');
    });

    it('401 yanitinda HANGI alanin hatali oldugunu belirtmez (kullanici numaralandirma onlenir)', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.', 401));
      renderLoginPage(request);

      await fillAndSubmit();
      await screen.findByRole('alert');

      expect(screen.getByLabelText('E-posta')).not.toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('Şifre')).not.toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText('E-posta')).not.toHaveAttribute('aria-describedby');
    });

    it('401 yanitinda oturum acmaz ve /login ekraninda kalir', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new ApiError('INVALID_CREDENTIALS', 'E-posta veya şifre hatalı.', 401));
      const { session } = renderLoginPage(request);

      await fillAndSubmit();
      await screen.findByRole('alert');

      expect(session.getAccessToken()).toBeNull();
      expect(screen.getByTestId('konum')).toHaveTextContent('/login');
    });

    it('429 yanitinda hiz siniri banner"i gosterir', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new ApiError('RATE_LIMIT_EXCEEDED', 'Cok fazla istek.', 429));
      renderLoginPage(request);

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Çok fazla deneme yaptınız, birazdan tekrar deneyin',
      );
    });

    it('400 VALIDATION_ERROR detayini ilgili alanin altina baglar', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(
          new ApiError('VALIDATION_ERROR', 'Girdi doğrulanamadı.', 400, [
            { field: 'email', message: 'gecerli bir e-posta adresi giriniz' },
          ]),
        );
      renderLoginPage(request);

      await fillAndSubmit();

      const emailInput = await screen.findByLabelText('E-posta');
      await waitFor(() => {
        expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      });
      const errorId = screen.getByText('gecerli bir e-posta adresi giriniz').getAttribute('id');
      expect(emailInput.getAttribute('aria-describedby')).toContain(errorId);
    });

    it('yeni gonderimde onceki hatayi temizler', async () => {
      const request = jest
        .fn()
        .mockRejectedValueOnce(new ApiError('INVALID_CREDENTIALS', 'Hatali.', 401))
        .mockResolvedValueOnce(LOGIN_RESPONSE);
      renderLoginPage(request);

      await fillAndSubmit();
      await screen.findByRole('alert');

      await userEvent.click(screen.getByRole('button', { name: 'Giriş Yap' }));

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/reports');
      });
    });
  });

  describe('yukleniyor durumu (kriter 5)', () => {
    it('istek surerken butonu ve form alanlarini devre disi birakir', async () => {
      const request = jest.fn().mockReturnValue(new Promise(() => undefined));
      renderLoginPage(request);

      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Giriş yapılıyor...' })).toBeDisabled();
      });
      expect(screen.getByLabelText('E-posta')).toBeDisabled();
      expect(screen.getByLabelText('Şifre')).toBeDisabled();
    });
  });

  describe('kayit sonrasi banner (kriter 8 karsiligi)', () => {
    it('kayittan gelindiginde basari banner"i gosterir', () => {
      renderLoginPage(jest.fn(), '/login?registered=1');

      expect(screen.getByRole('status')).toHaveTextContent('Hesabınız oluşturuldu, giriş yapın');
    });

    it('dogrudan gelindiginde banner gostermez', () => {
      renderLoginPage(jest.fn());

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
