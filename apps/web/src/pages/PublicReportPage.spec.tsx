// Kiracinin oturumsuz goruntuleme ekrani (T-009). Durumlar design.md → PublicReportPage
// sartnamesinden gelir: loading iskeleti, fotografsiz not, 404/429 tam sayfa hata ekrani.
// Kriter 3 ve 4 burada da dogrulanir: sayfada yazma etkilesimi YOKTUR ve istek
// Authorization basligi TASIMAZ.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

  it('tutanak ICERIGI salt-okunurdur: tek yazma etkilesimi onay formudur (T-009 kriter 3 / T-010)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));
    await screen.findByRole('heading', { name: VIEW.title });

    // Tek form + tek buton: onay akisi. Baslik/not/fotograf duzenleme arayuzu YOKTUR.
    expect(document.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Onayla' })).toBeInTheDocument();
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

describe('PublicReportPage — tek tikla onay (T-010)', () => {
  const APPROVAL = {
    id: '66666666-6666-4666-8666-666666666666',
    approverEmail: 'kiraci@ornek.test',
    approvedAt: '2026-08-15T09:30:00.000Z',
  };

  const APPROVED_VIEW = {
    ...VIEW,
    status: 'approved' as const,
    isApproved: true,
    approval: APPROVAL,
  };

  it('onay oncesi uyari metnini onay formuyla BIRLIKTE gosterir (kriter 1)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(VIEW)));

    expect(await screen.findByRole('note')).toHaveTextContent(VIEW.disclaimer);
    expect(screen.getByRole('button', { name: 'Onayla' })).toBeInTheDocument();
  });

  it('onaylandiginda onaylayan e-postasi ve damgasi ile basari banner`i gosterir', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(VIEW)
      .mockResolvedValueOnce(APPROVAL)
      .mockResolvedValue(APPROVED_VIEW);
    renderPage(fakeClient(request));

    await userEvent.type(await screen.findByLabelText('E-posta adresiniz'), APPROVAL.approverEmail);
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Onaylandi');
    expect(screen.getByRole('status')).toHaveTextContent(APPROVAL.approverEmail);
    expect(screen.queryByRole('button', { name: 'Onayla' })).not.toBeInTheDocument();
  });

  it('onay istegini sozlesmedeki yol ve govde ile gonderir', async () => {
    const request = jest
      .fn()
      .mockResolvedValueOnce(VIEW)
      .mockResolvedValueOnce(APPROVAL)
      .mockResolvedValue(APPROVED_VIEW);
    renderPage(fakeClient(request));

    await userEvent.type(await screen.findByLabelText('E-posta adresiniz'), APPROVAL.approverEmail);
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    await screen.findByRole('status');
    expect(request).toHaveBeenCalledWith(`/public/reports/${TOKEN}/approval`, {
      method: 'POST',
      body: JSON.stringify({ approverEmail: APPROVAL.approverEmail }),
    });
  });

  it('tutanak ZATEN onayliysa onay formu HIC render edilmez (design.md success durumu)', async () => {
    renderPage(fakeClient(jest.fn().mockResolvedValue(APPROVED_VIEW)));

    expect(await screen.findByRole('status')).toHaveTextContent(APPROVAL.approverEmail);
    expect(screen.queryByRole('button', { name: 'Onayla' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('E-posta adresiniz')).not.toBeInTheDocument();
  });

  it('409 REPORT_ALREADY_APPROVED yanitinda hata degil, basari banner`i gosterir', async () => {
    const conflict = {
      error: { code: 'REPORT_ALREADY_APPROVED', message: 'Zaten onayli.', traceId: 'iz-4' },
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(VIEW) })
      .mockResolvedValueOnce({ ok: false, status: 409, json: () => Promise.resolve(conflict) })
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(APPROVED_VIEW) });
    renderPage(createApiClient({ baseUrl: '/api/v1', readAccessToken: () => null, fetchImpl }));

    await userEvent.type(await screen.findByLabelText('E-posta adresiniz'), APPROVAL.approverEmail);
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Onaylandi');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('400 yanitinda alan hatasini formun icinde gosterir (sayfa hata ekranina gecmez)', async () => {
    const validationError = {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Girdi dogrulanamadi.',
        details: [{ field: 'approverEmail', message: 'gecerli bir e-posta adresi giriniz' }],
        traceId: 'iz-5',
      },
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(VIEW) })
      .mockResolvedValue({ ok: false, status: 400, json: () => Promise.resolve(validationError) });
    renderPage(createApiClient({ baseUrl: '/api/v1', readAccessToken: () => null, fetchImpl }));

    await userEvent.type(await screen.findByLabelText('E-posta adresiniz'), 'gecersiz');
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'gecerli bir e-posta adresi giriniz',
    );
    expect(screen.getByRole('heading', { name: VIEW.title })).toBeInTheDocument();
  });

  it('onay sirasinda 404 alinirsa tam sayfa hata ekranina gecer (design.md)', async () => {
    const notFound = {
      error: { code: 'SHARE_LINK_NOT_FOUND', message: 'Baglanti gecersiz.', traceId: 'iz-6' },
    };
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(VIEW) })
      .mockResolvedValue({ ok: false, status: 404, json: () => Promise.resolve(notFound) });
    renderPage(createApiClient({ baseUrl: '/api/v1', readAccessToken: () => null, fetchImpl }));

    await userEvent.type(await screen.findByLabelText('E-posta adresiniz'), APPROVAL.approverEmail);
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bu baglanti gecersiz veya suresi dolmus',
    );
    expect(screen.queryByRole('heading', { name: VIEW.title })).not.toBeInTheDocument();
  });

  it('onay istegi Authorization basligi TASIMAZ: kiraci oturum acmaz', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(VIEW) })
      .mockResolvedValueOnce({ ok: true, status: 201, json: () => Promise.resolve(APPROVAL) })
      .mockResolvedValue({ ok: true, status: 200, json: () => Promise.resolve(APPROVED_VIEW) });
    renderPage(createApiClient({ baseUrl: '/api/v1', readAccessToken: () => null, fetchImpl }));

    await userEvent.type(await screen.findByLabelText('E-posta adresiniz'), APPROVAL.approverEmail);
    await userEvent.click(screen.getByRole('button', { name: 'Onayla' }));

    await screen.findByRole('status');
    // Baslik kumesi TAM olarak Content-Type'tir: Authorization eklenmez.
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/public/reports/${TOKEN}/approval`,
      expect.objectContaining({ headers: { 'Content-Type': 'application/json' } }),
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
