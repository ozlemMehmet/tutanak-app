// AppShell (design.md §1 "Ekran disi ortak yapi"): ust bar (uygulama adi + kullanici
// e-postasi + cikis) ve gezinme. Kimlikli 4 ekran bu kabuk icinde render edilir.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ACCESS_TOKEN_STORAGE_KEY } from '../api/access-token';
import type { ApiClient } from '../api/client';
import { createSessionStore } from '../features/auth/session';
import { SessionProvider } from '../features/auth/SessionProvider';
import type { SessionStore } from '../features/auth/session';
import { AppShell } from './AppShell';

describe('AppShell', () => {
  const me = {
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

  const renderShell = (request: jest.Mock, initialPath = '/reports'): { store: SessionStore } => {
    window.localStorage.setItem(ACCESS_TOKEN_STORAGE_KEY, 'token-abc');
    const store = createSessionStore(window.localStorage);
    const client = { request } as unknown as ApiClient;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <SessionProvider store={store}>
          <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
              <Route element={<AppShell client={client} />}>
                <Route path="/reports" element={<span>tutanak listesi</span>} />
                <Route path="/subscription" element={<span>abonelik ekrani</span>} />
              </Route>
            </Routes>
          </MemoryRouter>
        </SessionProvider>
      </QueryClientProvider>,
    );

    return { store };
  };

  it('GET /me yanitindaki kullanici e-postasini gosterir', async () => {
    const request = jest.fn().mockResolvedValue(me);

    renderShell(request);

    expect(await screen.findByText('selin@ornek.com')).toBeInTheDocument();
    expect(request).toHaveBeenCalledWith('/me');
  });

  it('uygulama adini ve secili ekranin icerigini birlikte render eder', async () => {
    const request = jest.fn().mockResolvedValue(me);

    renderShell(request);

    expect(screen.getByText('Emlak Teslim Tutanagi')).toBeInTheDocument();
    expect(screen.getByText('tutanak listesi')).toBeInTheDocument();
    await screen.findByText('selin@ornek.com');
  });

  it('kimlikli ekranlara gezinme baglantilarini sunar', async () => {
    const request = jest.fn().mockResolvedValue(me);

    renderShell(request);

    expect(screen.getByRole('link', { name: 'Tutanaklarim' })).toHaveAttribute('href', '/reports');
    expect(screen.getByRole('link', { name: 'Yeni Tutanak' })).toHaveAttribute(
      'href',
      '/reports/new',
    );
    expect(screen.getByRole('link', { name: 'Abonelik' })).toHaveAttribute('href', '/subscription');
    await screen.findByText('selin@ornek.com');
  });

  it('icerige gec baglantisini (skip-link) kabugun basinda sunar', async () => {
    const request = jest.fn().mockResolvedValue(me);

    renderShell(request);

    expect(screen.getByRole('link', { name: 'Icerige gec' })).toHaveAttribute(
      'href',
      '#main-content',
    );
    await screen.findByText('selin@ornek.com');
  });

  it('Cikis eylemi saklanan token"i siler', async () => {
    const request = jest.fn().mockResolvedValue(me);
    const { store } = renderShell(request);
    await screen.findByText('selin@ornek.com');

    await userEvent.click(screen.getByRole('button', { name: 'Cikis' }));

    await waitFor(() => {
      expect(store.getAccessToken()).toBeNull();
    });
    expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
  });

  it('/me henuz yuklenmemisken kabugu ve icerigi yine de render eder', () => {
    const request = jest.fn().mockReturnValue(new Promise(() => undefined));

    renderShell(request);

    expect(screen.getByText('Emlak Teslim Tutanagi')).toBeInTheDocument();
    expect(screen.getByText('tutanak listesi')).toBeInTheDocument();
    expect(screen.queryByText('selin@ornek.com')).not.toBeInTheDocument();
  });
});
