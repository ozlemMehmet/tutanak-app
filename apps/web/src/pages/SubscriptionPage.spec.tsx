// SubscriptionPage davranisi (design.md §2.4 akisi + §3 SubscriptionPage sartnamesi):
// durum karti, durum bazli aksiyon alani, saglayicidan donuste otomatik tazeleme ve
// checkout hata durumlari (502 / 409).
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ApiClient } from '../api/client';
import { currentUserQueryKey } from '../features/auth/useCurrentUser';
import type { Subscription } from '../features/billing/billing.api';
import { SubscriptionPage } from './SubscriptionPage';

const INACTIVE: Subscription = {
  status: 'inactive',
  priceAmount: null,
  currency: 'TRY',
  currentPeriodEnd: null,
};

const CHECKOUT = {
  transactionReference: 'txn-1',
  checkoutUrl: 'https://odeme.example.test/oturum/txn-1',
  amount: '199.00',
  currency: 'TRY',
};

function meResponse(subscription: Subscription): unknown {
  return {
    id: 'kullanici-1',
    email: 'selin@ornek.com',
    createdAt: '2026-08-01T10:00:00.000Z',
    subscription,
  };
}

interface RenderOptions {
  subscription?: Subscription;
  checkoutResult?: () => Promise<unknown>;
  /** `GET /me` yanitini degistirir (hata durumu testleri icin). */
  meResult?: () => Promise<unknown>;
  initialPath?: string;
  /**
   * Onbellekte TAZE kabul edilen bir durum birakir (saglayiciya gitmeden once cekilmis
   * abonelik durumu). Boylece "otomatik yeniden cekme" tetikleyicisi tek basina gozlenir:
   * tetikleyici yoksa hic `GET /me` cagrisi olmaz.
   */
  seedCache?: boolean;
}

function renderPage(options: RenderOptions = {}): { request: jest.Mock; redirect: jest.Mock } {
  const subscription = options.subscription ?? INACTIVE;
  const request = jest.fn((path: string) => {
    if (path === '/me') {
      return (options.meResult ?? (() => Promise.resolve(meResponse(subscription))))();
    }
    if (path === '/billing/checkout') {
      return (options.checkoutResult ?? (() => Promise.resolve(CHECKOUT)))();
    }
    return Promise.reject(new Error(`beklenmeyen istek: ${path}`));
  });
  const redirect = jest.fn();
  const client = { request } as unknown as ApiClient;
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        // `useCurrentUser` kendi `retry` kuralini tasidigi icin yukaridaki varsayilani
        // EZER (5xx'te 2 kez yeniden dener). Davranisi degistirmiyoruz, yalnizca ustel
        // bekleme suresini sifirliyoruz ki hata durumu testi gercek zamanda beklemesin.
        retryDelay: 0,
        ...(options.seedCache === true ? { staleTime: Infinity } : {}),
      },
      mutations: { retry: false },
    },
  });
  if (options.seedCache === true) {
    queryClient.setQueryData(currentUserQueryKey, meResponse(subscription));
  }

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[options.initialPath ?? '/subscription']}>
        <SubscriptionPage client={client} redirect={redirect} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

  return { request, redirect };
}

const meCallCount = (request: jest.Mock): number =>
  (request.mock.calls as unknown[][]).filter((call) => call[0] === '/me').length;

describe('SubscriptionPage', () => {
  it('acilinca GET /me cagirir ve abonelik durumunu durum kartinda gosterir (kriter 1)', async () => {
    const { request } = renderPage();

    expect(await screen.findByTestId('abonelik-rozeti')).toHaveTextContent('Pasif');
    expect(request).toHaveBeenCalledWith('/me');
  });

  it('durum yuklenirken iskelet gosterir (kriter 1 loading durumu)', () => {
    renderPage();

    expect(screen.getByText('Abonelik durumu yukleniyor...')).toBeInTheDocument();
  });

  it('GET /me basarisiz olunca hata banner"i gosterir, sayfa sessizce bos kalmaz (kriter 1 hata durumu)', async () => {
    renderPage({
      meResult: () => Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi olustu.', 500)),
    });

    expect(await screen.findByText('Abonelik durumu yuklenemedi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
    expect(screen.queryByText('Abonelik durumu yukleniyor...')).not.toBeInTheDocument();
  });

  it('GET /me hatasindan sonra "Tekrar Dene" durumu yeniden ceker (kriter 1 hata durumu)', async () => {
    const { request } = renderPage({
      meResult: () => Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi olustu.', 500)),
    });

    await screen.findByText('Abonelik durumu yuklenemedi');
    // 5xx'te hook 2 kez yeniden denedigi icin ilk yuklemede 3 cagri olur; onemli olan
    // butonun YENI bir cekim baslatmasidir.
    const callsBeforeRetry = meCallCount(request);

    await userEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

    await waitFor(() => {
      expect(meCallCount(request)).toBeGreaterThan(callsBeforeRetry);
    });
  });

  it('inactive durumda odeme butonu aktiftir ve checkout cagrisini yapar (kriter 2)', async () => {
    const { request } = renderPage();

    const payButton = await screen.findByRole('button', { name: 'Odeme Yap' });
    expect(payButton).toBeEnabled();

    await userEvent.click(payButton);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/billing/checkout', { method: 'POST' });
    });
  });

  it('checkout donunce checkoutUrl adresine TAM SAYFA yonlendirir, yeni sekme acmaz (kriter 2)', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { redirect } = renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Odeme Yap' }));

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith(CHECKOUT.checkoutUrl);
    });
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Odeme Yap' })).not.toBeInTheDocument();
    open.mockRestore();
  });

  it('pending durumda bekleme bilgisini gosterir ve odeme butonu gostermez (kriter 3)', async () => {
    renderPage({ subscription: { ...INACTIVE, status: 'pending', priceAmount: '199.00' } });

    expect(
      await screen.findByText('Odeme sonucu bekleniyor, abonelik henuz aktif degil'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Odeme Yap' })).not.toBeInTheDocument();
  });

  it('active durumda aktiflik metnini ve donem sonunu gosterir, odeme butonu gostermez (kriter 4)', async () => {
    renderPage({
      subscription: {
        status: 'active',
        priceAmount: '199.00',
        currency: 'TRY',
        currentPeriodEnd: '2026-09-14T09:30:00.000Z',
      },
    });

    expect(await screen.findByText('Aboneliginiz aktif')).toBeInTheDocument();
    expect(screen.getByTestId('abonelik-donem-sonu')).toHaveTextContent(/\d{2}\.\d{2}\.\d{4}/);
    expect(screen.queryByRole('button', { name: 'Odeme Yap' })).not.toBeInTheDocument();
  });

  it('?checkout=return ile acilinca GET /me otomatik yeniden cekilir (kriter 5)', async () => {
    // Onbellekte taze durum var: tetikleyici olmasa TEK BIR cagri bile yapilmazdi.
    const { request } = renderPage({
      seedCache: true,
      initialPath: '/subscription?checkout=return',
    });

    await screen.findByTestId('abonelik-rozeti');
    await waitFor(() => {
      expect(meCallCount(request)).toBe(1);
    });
  });

  it('donus parametresi yokken durumu kendiliginden yeniden cekmez (kriter 5 regresyonu)', async () => {
    const { request } = renderPage({ seedCache: true });

    await screen.findByTestId('abonelik-rozeti');
    expect(meCallCount(request)).toBe(0);
  });

  it('sekme yeniden gorunur olunca GET /me otomatik yeniden cekilir (kriter 5)', async () => {
    const { request } = renderPage();

    await screen.findByTestId('abonelik-rozeti');
    expect(meCallCount(request)).toBe(1);

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(meCallCount(request)).toBe(2);
    });
  });

  it('checkout 502 PAYMENT_PROVIDER_ERROR donunce saglayici banner"i gosterir (kriter 6)', async () => {
    renderPage({
      checkoutResult: () =>
        Promise.reject(
          new ApiError('PAYMENT_PROVIDER_ERROR', 'Odeme saglayicisina ulasilamadi.', 502),
        ),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Odeme Yap' }));

    expect(
      await screen.findByText('Odeme saglayicisina ulasilamadi, tekrar deneyin'),
    ).toBeInTheDocument();
  });

  it('checkout 409 SUBSCRIPTION_ALREADY_ACTIVE donunce bilgi banner"i gosterir ve /me yeniden cekilir (kriter 7)', async () => {
    const { request } = renderPage({
      checkoutResult: () =>
        Promise.reject(new ApiError('SUBSCRIPTION_ALREADY_ACTIVE', 'Abonelik zaten aktif.', 409)),
    });

    await screen.findByTestId('abonelik-rozeti');
    await userEvent.click(screen.getByRole('button', { name: 'Odeme Yap' }));

    expect(await screen.findByText('Aboneliginiz zaten aktif.')).toBeInTheDocument();
    await waitFor(() => {
      expect(meCallCount(request)).toBe(2);
    });
  });

  it('beklenmeyen checkout hatasinda sunucu mesajini gosterir', async () => {
    renderPage({
      checkoutResult: () =>
        Promise.reject(new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir hata olustu.', 500)),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Odeme Yap' }));

    expect(await screen.findByText('Beklenmeyen bir hata olustu.')).toBeInTheDocument();
  });

  it('mesajsiz (zarfsiz) hatada genel hata mesajini gosterir', async () => {
    renderPage({ checkoutResult: () => Promise.reject(new Error('')) });

    await userEvent.click(await screen.findByRole('button', { name: 'Odeme Yap' }));

    expect(
      await screen.findByText('Beklenmeyen bir hata olustu, lutfen tekrar deneyin.'),
    ).toBeInTheDocument();
  });
});
