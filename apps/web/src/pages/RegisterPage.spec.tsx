// RegisterPage (`/register`) — design.md §3 RegisterPage sartnamesi, T-018 kriter 5-9.
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
import { RegisterPage } from './RegisterPage';

const EMAIL = 'selin@ornek.com';
const PASSWORD = 'cok-gizli-8';
const USER = { id: 'kullanici-1', email: EMAIL, createdAt: '2026-08-01T10:00:00.000Z' };

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <span data-testid="konum">{`${location.pathname}${location.search}`}</span>;
}

function renderRegisterPage(request: jest.Mock): { session: SessionStore } {
  const session = createSessionStore(window.localStorage);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = { request } as unknown as ApiClient;

  render(
    <QueryClientProvider client={queryClient}>
      <SessionProvider store={session}>
        <MemoryRouter initialEntries={['/register']}>
          <LocationProbe />
          <Routes>
            <Route path="/register" element={<RegisterPage client={client} />} />
            {/* Kayit sonrasi hedef GERCEK LoginPage'dir: banner'in orada gorundugu de dogrulanir. */}
            <Route path="/login" element={<LoginPage client={client} />} />
          </Routes>
        </MemoryRouter>
      </SessionProvider>
    </QueryClientProvider>,
  );

  return { session };
}

async function fillForm(passwordConfirm = PASSWORD): Promise<void> {
  await userEvent.type(screen.getByLabelText('E-posta'), EMAIL);
  await userEvent.type(screen.getByLabelText('Sifre'), PASSWORD);
  await userEvent.type(screen.getByLabelText('Sifre (tekrar)'), passwordConfirm);
}

const submit = async (): Promise<void> => {
  await userEvent.click(screen.getByRole('button', { name: 'Hesap Olustur' }));
};

describe('RegisterPage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(ACCESS_TOKEN_STORAGE_KEY);
  });

  describe('render (kriter 6, 9)', () => {
    it('e-posta, sifre ve sifre-tekrar alanlarini sunar', () => {
      renderRegisterPage(jest.fn());

      expect(screen.getByRole('heading', { name: 'Kayit Ol' })).toBeInTheDocument();
      expect(screen.getByLabelText('E-posta')).toBeInTheDocument();
      expect(screen.getByLabelText('Sifre')).toBeInTheDocument();
      expect(screen.getByLabelText('Sifre (tekrar)')).toBeInTheDocument();
    });

    it('"En az 8 karakter" yardimci metnini hata olmadan da surekli gosterir', () => {
      renderRegisterPage(jest.fn());

      expect(screen.getByText('En az 8 karakter')).toBeInTheDocument();
    });

    it('yardimci metin hata gosterildikten sonra da gorunur kalir', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(
          new ApiError('EMAIL_ALREADY_REGISTERED', 'Bu e-posta zaten kayitli.', 409, [
            { field: 'email', message: 'bu e-posta zaten kayitli' },
          ]),
        );
      renderRegisterPage(request);

      await fillForm();
      await submit();
      await screen.findByText('bu e-posta zaten kayitli');

      expect(screen.getByText('En az 8 karakter')).toBeInTheDocument();
    });
  });

  describe('sifre tekrari yalnizca istemcide dogrulanir (kriter 6)', () => {
    it('sifreler eslesmiyorsa istek GONDERMEZ ve alan bazli hata gosterir', async () => {
      const request = jest.fn();
      renderRegisterPage(request);

      await fillForm('baska-sifre-9');
      await submit();

      expect(await screen.findByText('sifreler eslesmiyor')).toBeInTheDocument();
      expect(request).not.toHaveBeenCalled();
      expect(screen.getByLabelText('Sifre (tekrar)')).toHaveAttribute('aria-invalid', 'true');
    });

    it('istek govdesine sifre-tekrar alanini KOYMAZ (sozlesme yalnizca email+password)', async () => {
      const request = jest.fn().mockResolvedValue(USER);
      renderRegisterPage(request);

      await fillForm();
      await submit();

      await waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
      });
      const [path, init] = request.mock.calls[0] as [string, { body: string }];
      expect(path).toBe('/auth/register');
      expect(JSON.parse(init.body)).toEqual({ email: EMAIL, password: PASSWORD });
    });

    it('eslesmeme hatasi duzeltilip tekrar gonderildiginde istek gider', async () => {
      const request = jest.fn().mockResolvedValue(USER);
      renderRegisterPage(request);

      await fillForm('baska-sifre-9');
      await submit();
      await screen.findByText('sifreler eslesmiyor');

      await userEvent.clear(screen.getByLabelText('Sifre (tekrar)'));
      await userEvent.type(screen.getByLabelText('Sifre (tekrar)'), PASSWORD);
      await submit();

      await waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('hata durumlari (kriter 7)', () => {
    it('409 EMAIL_ALREADY_REGISTERED hatasini e-posta alaninin altina baglar', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(
          new ApiError('EMAIL_ALREADY_REGISTERED', 'Bu e-posta zaten kayitli.', 409, [
            { field: 'email', message: 'bu e-posta zaten kayitli' },
          ]),
        );
      renderRegisterPage(request);

      await fillForm();
      await submit();

      const message = await screen.findByText('bu e-posta zaten kayitli');
      const emailInput = screen.getByLabelText('E-posta');
      expect(emailInput).toHaveAttribute('aria-invalid', 'true');
      expect(emailInput.getAttribute('aria-describedby')).toContain(message.getAttribute('id'));
      // Alan bazli baglandigi icin form-genel banner gosterilmez.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('429 yanitinda hiz siniri banner"i gosterir', async () => {
      const request = jest
        .fn()
        .mockRejectedValue(new ApiError('RATE_LIMIT_EXCEEDED', 'Cok fazla istek.', 429));
      renderRegisterPage(request);

      await fillForm();
      await submit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Cok fazla deneme yaptiniz, birazdan tekrar deneyin',
      );
    });
  });

  describe('yukleniyor durumu (kriter 5)', () => {
    it('istek surerken butonu ve tum alanlari devre disi birakir', async () => {
      const request = jest.fn().mockReturnValue(new Promise(() => undefined));
      renderRegisterPage(request);

      await fillForm();
      await submit();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Hesap olusturuluyor...' })).toBeDisabled();
      });
      expect(screen.getByLabelText('E-posta')).toBeDisabled();
      expect(screen.getByLabelText('Sifre')).toBeDisabled();
      expect(screen.getByLabelText('Sifre (tekrar)')).toBeDisabled();
    });
  });

  describe('basarili kayit (kriter 8)', () => {
    it('otomatik giris YAPMAZ (token saklanmaz)', async () => {
      const request = jest.fn().mockResolvedValue(USER);
      const { session } = renderRegisterPage(request);

      await fillForm();
      await submit();

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/login');
      });
      expect(session.getAccessToken()).toBeNull();
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });

    it('/login ekranina yonlendirir ve basari banner"i gosterir', async () => {
      const request = jest.fn().mockResolvedValue(USER);
      renderRegisterPage(request);

      await fillForm();
      await submit();

      expect(await screen.findByRole('status')).toHaveTextContent(
        'Hesabiniz olusturuldu, giris yapin',
      );
      expect(screen.getByRole('heading', { name: 'Giris Yap' })).toBeInTheDocument();
    });
  });
});
