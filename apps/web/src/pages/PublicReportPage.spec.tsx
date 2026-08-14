// Kiracinin oturumsuz goruntuleme ekrani (T-009). Durumlar design.md → PublicReportPage
// sartnamesinden gelir: loading iskeleti, fotografsiz not, 404/429 tam sayfa hata ekrani.
// Kriter 3 ve 4 burada da dogrulanir: sayfada yazma etkilesimi YOKTUR ve istek
// Authorization basligi TASIMAZ.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { App } from '../App';
import { createApiClient } from '../api/client';
import type { ApiClient } from '../api/client';
import type { PublicReportView } from '../features/sharing/public-report.api';
import { PublicReportPage } from './PublicReportPage';

const TOKEN = 'gecerli-token_gecerli-token_gecerli-token_g';

const VIEW: PublicReportView = {
  title: 'Kadikoy 3+1 teslim tutanagi',
  templateName: 'Kiraci Cikis Teslimi',
  note: 'Salon duvarinda cizik var.',
  status: 'shared',
  createdAt: '2026-08-14T09:00:00.000Z',
  isApproved: false,
  disclaimer: 'Bu tutanak resmi hukuki delil degildir, destekleyici kanittir.',
  photos: [
    {
      id: 'foto-1',
      capturedAt: '2026-08-14T09:05:00.000Z',
      url: 'https://depolama.test/foto-1.jpg',
    },
  ],
};

function renderPage(client: ApiClient): void {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/t/${TOKEN}`]}>
        <Routes>
          <Route path="/t/:token" element={<PublicReportPage client={client} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Bilesen testinde sunucu yanitini sahteleyen istemci (ciplak fetch bilesende yasak). */
function fakeClient(request: jest.Mock): ApiClient {
  return { request };
}

function clientReturning(body: unknown, status = 200): ApiClient {
  const fetchImpl = jest.fn().mockResolvedValue({
    ok: status < 400,
    status,
    json: () => Promise.resolve(body),
  });
  return createApiClient({ baseUrl: '/api/v1', readAccessToken: () => null, fetchImpl });
}

describe('PublicReportPage', () => {
  it('yuklenirken iskelet durumu gosterir', () => {
    renderPage(fakeClient(jest.fn().mockReturnValue(new Promise(() => undefined))));

    expect(screen.getByText('Tutanak yukleniyor...')).toBeInTheDocument();
  });

  it('tutanagin basligini, sablon adini ve notunu gosterir (kriter 1)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));

    expect(await screen.findByRole('heading', { name: VIEW.title })).toBeInTheDocument();
    expect(screen.getByText(VIEW.templateName)).toBeInTheDocument();
    expect(screen.getByText(VIEW.note)).toBeInTheDocument();
  });

  it('her fotografi tarih-saat damgasiyla gosterir (kriter 1)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));

    const photo = await screen.findByRole('img');
    expect(photo).toHaveAttribute('src', 'https://depolama.test/foto-1.jpg');
    // Damga sunucudan geldigi haliyle baglanir; gorunen bicim yerel ayara baglidir.
    const stamp = document.querySelector('.photo-thumbnail time');
    expect(stamp).toHaveAttribute('datetime', VIEW.photos[0]?.capturedAt ?? '');
    expect(stamp?.textContent).toMatch(/\d{2}\.\d{2}\.\d{4}/);
  });

  it('tutanagin olusturulma damgasini gosterir', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));

    expect(await screen.findByText(/Olusturulma/)).toBeInTheDocument();
  });

  it('fotograf yoksa akisi engellemeden bilgilendirme gosterir (design.md empty durumu)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue({ ...VIEW, photos: [] })));

    expect(await screen.findByText('Bu tutanakta henuz fotograf bulunmuyor')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: VIEW.title })).toBeInTheDocument();
  });

  it('uyari metnini sunucudan geldigi haliyle gosterir', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));

    expect(await screen.findByRole('note')).toHaveTextContent(VIEW.disclaimer);
  });

  it('gecersiz token icin tam sayfa hata ekrani gosterir, tutanak icerigi gostermez (kriter 2)', async () => {
    const notFound = {
      error: { code: 'SHARE_LINK_NOT_FOUND', message: 'Bu baglanti gecersiz.', traceId: 'iz-1' },
    };

    renderPage(clientReturning(notFound, 404));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu baglanti gecersiz veya suresi dolmus',
    );
    expect(screen.queryByRole('heading', { name: VIEW.title })).not.toBeInTheDocument();
  });

  it('429 yanitinda tam sayfa "cok fazla istek" ekrani gosterir (design.md)', async () => {
    const rateLimited = {
      error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Cok fazla istek.', traceId: 'iz-2' },
    };

    renderPage(clientReturning(rateLimited, 429));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cok fazla istek, birazdan tekrar deneyin',
    );
  });

  it('beklenmeyen bir hatada genel hata ekrani gosterir (tutanak icerigi gosterilmez)', async () => {
    const unexpected = {
      error: { code: 'FORBIDDEN', message: 'Erisim yok.', traceId: 'iz-3' },
    };

    renderPage(clientReturning(unexpected, 403));

    expect(await screen.findByRole('alert')).toHaveTextContent('Tutanak su anda goruntulenemiyor');
    expect(screen.queryByRole('heading', { name: VIEW.title })).not.toBeInTheDocument();
  });

  it('SALT-OKUNURDUR: sayfada hicbir buton, form veya girdi alani yoktur (kriter 3)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));
    await screen.findByRole('heading', { name: VIEW.title });

    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryAllByRole('textbox')).toHaveLength(0);
    expect(document.querySelectorAll('form')).toHaveLength(0);
  });

  it('istek Authorization basligi TASIMAZ: goruntuleme oturum gerektirmez (kriter 4)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(VIEW),
    });
    const client = createApiClient({
      baseUrl: '/api/v1',
      readAccessToken: () => null,
      fetchImpl,
    });

    renderPage(client);
    await screen.findByRole('heading', { name: VIEW.title });

    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/public/reports/${TOKEN}`,
      expect.objectContaining({ headers: {} }),
    );
  });
});

describe('App yonlendirmesi — /t/:token', () => {
  it('paylasim linki adresinde oturumsuz goruntuleme sayfasini acar (kriter 4)', async () => {
    window.history.pushState({}, '', `/t/${TOKEN}`);
    const client = { request: jest.fn().mockResolvedValue(VIEW) } as unknown as ApiClient;

    render(<App client={client} />);

    expect(await screen.findByRole('heading', { name: VIEW.title })).toBeInTheDocument();
    expect(client.request).toHaveBeenCalledWith(`/public/reports/${TOKEN}`);
  });
});
