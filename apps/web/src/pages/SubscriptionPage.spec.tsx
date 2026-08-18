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
import { SUBSCRIPTION_POLL_DELAYS_MS } from '../features/billing/useSubscriptionAutoRefresh';
import { SubscriptionPage } from './SubscriptionPage';

const INACTIVE: Subscription = {
  status: 'inactive',
  priceAmount: null,
  currency: 'TRY',
  currentPeriodEnd: null,
};

const PENDING: Subscription = { ...INACTIVE, status: 'pending', priceAmount: '199.00' };

const ACTIVE: Subscription = {
  status: 'active',
  priceAmount: '199.00',
  currency: 'TRY',
  currentPeriodEnd: '2026-09-14T09:30:00.000Z',
};

const PENDING_WAITING_TEXT = 'Ödeme sonucu bekleniyor, abonelik henüz aktif değil';

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

    expect(screen.getByText('Abonelik durumu yükleniyor...')).toBeInTheDocument();
  });

  it('GET /me basarisiz olunca hata banner"i gosterir, sayfa sessizce bos kalmaz (kriter 1 hata durumu)', async () => {
    renderPage({
      meResult: () => Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi olustu.', 500)),
    });

    expect(await screen.findByText('Abonelik durumu yüklenemedi')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
    expect(screen.queryByText('Abonelik durumu yükleniyor...')).not.toBeInTheDocument();
  });

  it('GET /me hatasindan sonra "Tekrar Dene" durumu yeniden ceker (kriter 1 hata durumu)', async () => {
    const { request } = renderPage({
      meResult: () => Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi olustu.', 500)),
    });

    await screen.findByText('Abonelik durumu yüklenemedi');
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

    const payButton = await screen.findByRole('button', { name: 'Ödeme Yap' });
    expect(payButton).toBeEnabled();

    await userEvent.click(payButton);

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith('/billing/checkout', { method: 'POST' });
    });
  });

  it('checkout donunce checkoutUrl adresine TAM SAYFA yonlendirir, yeni sekme acmaz (kriter 2)', async () => {
    const open = jest.spyOn(window, 'open').mockImplementation(() => null);
    const { redirect } = renderPage();

    await userEvent.click(await screen.findByRole('button', { name: 'Ödeme Yap' }));

    await waitFor(() => {
      expect(redirect).toHaveBeenCalledWith(CHECKOUT.checkoutUrl);
    });
    expect(open).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Ödeme Yap' })).not.toBeInTheDocument();
    open.mockRestore();
  });

  it('pending durumda bekleme bilgisini gosterir ve odeme butonu gostermez (kriter 3)', async () => {
    renderPage({ subscription: { ...INACTIVE, status: 'pending', priceAmount: '199.00' } });

    expect(
      await screen.findByText('Ödeme sonucu bekleniyor, abonelik henüz aktif değil'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ödeme Yap' })).not.toBeInTheDocument();
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

    expect(await screen.findByText('Aboneliğiniz aktif')).toBeInTheDocument();
    expect(screen.getByTestId('abonelik-donem-sonu')).toHaveTextContent(/\d{2}\.\d{2}\.\d{4}/);
    expect(screen.queryByRole('button', { name: 'Ödeme Yap' })).not.toBeInTheDocument();
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
          new ApiError('PAYMENT_PROVIDER_ERROR', 'Ödeme sağlayıcısına ulaşılamadı.', 502),
        ),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Ödeme Yap' }));

    expect(
      await screen.findByText('Ödeme sağlayıcısına ulaşılamadı, tekrar deneyin'),
    ).toBeInTheDocument();
  });

  it('checkout 409 SUBSCRIPTION_ALREADY_ACTIVE donunce bilgi banner"i gosterir ve /me yeniden cekilir (kriter 7)', async () => {
    const { request } = renderPage({
      checkoutResult: () =>
        Promise.reject(new ApiError('SUBSCRIPTION_ALREADY_ACTIVE', 'Abonelik zaten aktif.', 409)),
    });

    await screen.findByTestId('abonelik-rozeti');
    await userEvent.click(screen.getByRole('button', { name: 'Ödeme Yap' }));

    expect(await screen.findByText('Aboneliğiniz zaten aktif.')).toBeInTheDocument();
    await waitFor(() => {
      expect(meCallCount(request)).toBe(2);
    });
  });

  it('beklenmeyen checkout hatasinda sunucu mesajini gosterir', async () => {
    renderPage({
      checkoutResult: () =>
        Promise.reject(new ApiError('INTERNAL_ERROR', 'Beklenmeyen bir hata olustu.', 500)),
    });

    await userEvent.click(await screen.findByRole('button', { name: 'Ödeme Yap' }));

    expect(await screen.findByText('Beklenmeyen bir hata olustu.')).toBeInTheDocument();
  });

  it('mesajsiz (zarfsiz) hatada genel hata mesajini gosterir', async () => {
    renderPage({ checkoutResult: () => Promise.reject(new Error('')) });

    await userEvent.click(await screen.findByRole('button', { name: 'Ödeme Yap' }));

    expect(
      await screen.findByText('Beklenmeyen bir hata oluştu, lütfen tekrar deneyin.'),
    ).toBeInTheDocument();
  });
});

// H-003: odeme saglayicisinin webhook'u ASENKRON geldigi icin `?checkout=return` ve
// `visibilitychange` tek seferlik tetikleyicileri cogu zaman webhook'tan ONCE ates alir;
// kullanici hicbir sey yapmadan `pending` ekraninda kilitli kalirdi.
describe('SubscriptionPage pending yoklamasi (H-003)', () => {
  const TOTAL_BUDGET_MS = SUBSCRIPTION_POLL_DELAYS_MS.reduce((sum, delay) => sum + delay, 0);

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  /**
   * Tek bir yoklama adimini ilerletir. Her adim bir oncekinin tazelemesi oturduktan SONRA
   * planlandigi icin butcenin tamami tek hamlede ilerletilemez; adimlar sirayla kosulur.
   */
  async function advancePollStep(index: number): Promise<void> {
    await act(async () => {
      jest.advanceTimersByTime(SUBSCRIPTION_POLL_DELAYS_MS[index] ?? 0);
      await Promise.resolve();
    });
  }

  async function runPollSteps(count: number): Promise<void> {
    for (let index = 0; index < count; index += 1) {
      await advancePollStep(index);
    }
  }

  function setupUser(): ReturnType<typeof userEvent.setup> {
    return userEvent.setup({
      advanceTimers: (ms: number) => {
        jest.advanceTimersByTime(ms);
      },
    });
  }

  it('kullanici hicbir sey yapmadan webhook gelince ekran otomatik olarak aktife gecer (kriter 1)', async () => {
    // Webhook henuz gelmedi: `GET /me` `pending` donuyor.
    let subscription: Subscription = PENDING;
    renderPage({ meResult: () => Promise.resolve(meResponse(subscription)) });

    await screen.findByText(PENDING_WAITING_TEXT);

    // Webhook birkac saniye sonra ulasti; kullanici sekmeyi terk etmedi, tiklamadi.
    subscription = ACTIVE;
    await advancePollStep(0);

    expect(await screen.findByText('Aboneliğiniz aktif')).toBeInTheDocument();
    expect(screen.queryByText(PENDING_WAITING_TEXT)).not.toBeInTheDocument();
  });

  it('pending durumda "Durumu yenile" eylemi gorunur ve tiklaninca GET /me tekrar cagrilir (kriter 2)', async () => {
    const user = setupUser();
    const { request } = renderPage({ subscription: PENDING });

    const refreshButton = await screen.findByRole('button', { name: 'Durumu yenile' });
    expect(refreshButton).toBeEnabled();
    const callsBefore = meCallCount(request);

    await user.click(refreshButton);

    await waitFor(() => {
      expect(meCallCount(request)).toBeGreaterThan(callsBefore);
    });
  });

  it('yoklama ust siniri tukendikten sonra da "Durumu yenile" tiklanabilir kalir (kriter 2 + 4)', async () => {
    const user = setupUser();
    const { request } = renderPage({ subscription: PENDING });

    await screen.findByText(PENDING_WAITING_TEXT);
    await runPollSteps(SUBSCRIPTION_POLL_DELAYS_MS.length);
    const callsBefore = meCallCount(request);

    const refreshButton = screen.getByRole('button', { name: 'Durumu yenile' });
    expect(refreshButton).toBeEnabled();
    await user.click(refreshButton);

    await waitFor(() => {
      expect(meCallCount(request)).toBeGreaterThan(callsBefore);
    });
  });

  it('abonelik aktiflesince yoklama durur, sonsuz GET /me cagrisi yapmaz (kriter 3)', async () => {
    let subscription: Subscription = PENDING;
    const { request } = renderPage({ meResult: () => Promise.resolve(meResponse(subscription)) });

    await screen.findByText(PENDING_WAITING_TEXT);
    subscription = ACTIVE;
    await advancePollStep(0);
    expect(await screen.findByText('Aboneliğiniz aktif')).toBeInTheDocument();
    const callsAfterActive = meCallCount(request);

    await act(async () => {
      jest.advanceTimersByTime(TOTAL_BUDGET_MS * 2);
      await Promise.resolve();
    });

    expect(meCallCount(request)).toBe(callsAfterActive);
  });

  it('yoklama ust sinirda durur, butce disinda yeni GET /me cagrisi yapmaz (kriter 3)', async () => {
    const { request } = renderPage({ subscription: PENDING });

    await screen.findByText(PENDING_WAITING_TEXT);
    await runPollSteps(SUBSCRIPTION_POLL_DELAYS_MS.length);
    // Ilk yukleme + her yoklama adimi icin birer cagri.
    const callsAtBudgetEnd = meCallCount(request);
    expect(callsAtBudgetEnd).toBe(1 + SUBSCRIPTION_POLL_DELAYS_MS.length);

    await act(async () => {
      jest.advanceTimersByTime(TOTAL_BUDGET_MS * 3);
      await Promise.resolve();
    });

    expect(meCallCount(request)).toBe(callsAtBudgetEnd);
  });

  it('yoklama surerken bekleme metni korunur, zaman asimi mesajina erken gecmez (kriter 4 sinir durumu)', async () => {
    renderPage({ subscription: PENDING });

    await screen.findByText(PENDING_WAITING_TEXT);
    await runPollSteps(SUBSCRIPTION_POLL_DELAYS_MS.length - 1);

    expect(screen.getByText(PENDING_WAITING_TEXT)).toBeInTheDocument();
    expect(screen.queryByTestId('abonelik-bekleme-zaman-asimi')).not.toBeInTheDocument();
  });

  it('yoklama ust sinirina ulasip abonelik hala pending ise sonraki adim mesajini gosterir (kriter 4)', async () => {
    renderPage({ subscription: PENDING });

    await screen.findByText(PENDING_WAITING_TEXT);
    await runPollSteps(SUBSCRIPTION_POLL_DELAYS_MS.length);

    const timeoutMessage = await screen.findByTestId('abonelik-bekleme-zaman-asimi');
    // Odeme alindiysa ne olacagi VE alinmadiysa ne yapilacagi ayni metinde soylenir.
    expect(timeoutMessage).toHaveTextContent(/kısa süre içinde aktifleşir/);
    expect(timeoutMessage).toHaveTextContent(/alınmadıysa/);
    expect(screen.queryByText(PENDING_WAITING_TEXT)).not.toBeInTheDocument();
  });
});
