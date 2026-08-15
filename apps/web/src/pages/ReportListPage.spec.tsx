// ReportListPage (`/reports`) — design.md §3 ReportListPage sartnamesi, T-021 kriter 1-8.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Report, ReportListResponse } from '../features/reports/reports.api';
import { ReportListPage } from './ReportListPage';

const REPORTS: Report[] = [
  {
    id: 'rapor-1',
    templateId: 'sablon-1',
    templateName: 'Giris/Cikis Teslim Tutanagi',
    title: 'Bahce Kat Teslimi',
    note: '',
    status: 'draft',
    photoCount: 4,
    createdAt: '2026-08-15T09:00:00.000Z',
    updatedAt: '2026-08-15T09:00:00.000Z',
  },
  {
    id: 'rapor-2',
    templateId: 'sablon-2',
    templateName: 'Sayac ve Demirbas Tutanagi',
    title: 'Kat 3 Sayac Okumasi',
    note: '',
    status: 'approved',
    photoCount: 0,
    createdAt: '2026-08-14T09:00:00.000Z',
    updatedAt: '2026-08-14T09:00:00.000Z',
  },
];

const NEW_REPORT_LABEL = '+ Yeni Tutanak';
const SEARCH_LABEL = 'Tutanaklarda ara';
const LIST_ERROR_MESSAGE = 'Tutanaklar yuklenemedi';

function listResponse(overrides: Partial<ReportListResponse> = {}): ReportListResponse {
  return { items: REPORTS, page: 1, pageSize: 20, total: REPORTS.length, ...overrides };
}

type ListResponder = (params: URLSearchParams) => Promise<unknown>;

/** Yol bazli sahte istemci: bu ekran yalnizca `GET /reports` cagirir. */
function createRequestMock(responder?: ListResponder): jest.Mock {
  const respond = responder ?? ((): Promise<unknown> => Promise.resolve(listResponse()));

  return jest.fn((path: string) => {
    const separator = path.indexOf('?');
    if (path.startsWith('/reports') && separator !== -1) {
      return respond(new URLSearchParams(path.slice(separator + 1)));
    }
    return Promise.reject(new Error(`beklenmeyen yol: ${path}`));
  });
}

function LocationProbe(): React.JSX.Element {
  const location = useLocation();
  return <span data-testid="konum">{location.pathname}</span>;
}

function renderPage(request: jest.Mock): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports']}>
        <LocationProbe />
        <Routes>
          <Route
            path="/reports"
            element={<ReportListPage client={{ request, requestFile: jest.fn() }} />}
          />
          <Route path="/reports/new" element={<h1>Yeni Tutanak Ekrani</h1>} />
          <Route path="/reports/:reportId" element={<h1>Tutanak Detayi</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** `q` parametresi tasiyan istek yollarini (debounce sonrasi cagrilari) verir. */
function searchPaths(request: jest.Mock): string[] {
  return request.mock.calls.map(([path]: [string]) => path).filter((path) => path.includes('q='));
}

describe('ReportListPage', () => {
  describe('liste yuklemesi (kriter 1)', () => {
    it('acildiginda GET /reports cagrilir', async () => {
      const request = createRequestMock();
      renderPage(request);

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith('/reports?page=1');
      });
    });

    it('her tutanak icin baslik, sablon adi, durum rozeti, fotograf sayisi ve tarih gosterir', async () => {
      renderPage(createRequestMock());

      const list = await screen.findByRole('list', { name: 'Tutanaklar' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(2);

      const first = within(screen.getByRole('link', { name: /Bahce Kat Teslimi/ }));
      expect(first.getByText('Bahce Kat Teslimi')).toBeInTheDocument();
      expect(first.getByText('Giris/Cikis Teslim Tutanagi')).toBeInTheDocument();
      expect(first.getByText('Taslak')).toBeInTheDocument();
      expect(first.getByText('4 fotograf')).toBeInTheDocument();
      expect(first.getByText((_content, element) => element?.tagName === 'TIME')).toHaveAttribute(
        'dateTime',
        '2026-08-15T09:00:00.000Z',
      );

      const second = within(screen.getByRole('link', { name: /Kat 3 Sayac Okumasi/ }));
      expect(second.getByText('Onaylandi')).toBeInTheDocument();
      expect(second.getByText('0 fotograf')).toBeInTheDocument();
    });
  });

  describe('arama (kriter 2)', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('her tus vurusunda istek yapilmaz', async () => {
      const request = createRequestMock();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderPage(request);
      await waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
      });

      await user.type(screen.getByLabelText(SEARCH_LABEL), 'kapi');

      expect(searchPaths(request)).toHaveLength(0);
    });

    it('yazma durunca ~400ms sonra tek bir istek `q` parametresiyle gonderilir', async () => {
      const request = createRequestMock();
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      renderPage(request);
      await waitFor(() => {
        expect(request).toHaveBeenCalledTimes(1);
      });

      await user.type(screen.getByLabelText(SEARCH_LABEL), 'kapi');
      jest.advanceTimersByTime(399);
      expect(searchPaths(request)).toHaveLength(0);

      jest.advanceTimersByTime(1);

      await waitFor(() => {
        expect(searchPaths(request)).toEqual(['/reports?q=kapi&page=1']);
      });
    });

    it('arama kutusu sozlesmedeki `q` ust sinirini asamaz', () => {
      renderPage(createRequestMock());

      expect(screen.getByLabelText(SEARCH_LABEL)).toHaveAttribute('maxLength', '100');
    });
  });

  describe('bos durum — hic tutanak yok (kriter 3)', () => {
    const emptyList = (): jest.Mock =>
      createRequestMock(() => Promise.resolve(listResponse({ items: [], total: 0 })));

    it('"Henuz tutanaginiz yok" bos durumunu gosterir', async () => {
      renderPage(emptyList());

      expect(await screen.findByText('Henuz tutanaginiz yok')).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Tutanaklar' })).not.toBeInTheDocument();
    });

    it('"Ilk tutanagini olustur" CTA-si /reports/new rotasina goturur', async () => {
      renderPage(emptyList());

      await userEvent.click(await screen.findByRole('link', { name: 'Ilk tutanagini olustur' }));

      expect(screen.getByTestId('konum')).toHaveTextContent('/reports/new');
    });
  });

  describe('bos durum — arama sonucu yok (kriter 4)', () => {
    /** Yalnizca arama terimi eslesmeyen sunucu: `q` varsa bos, yoksa tam liste doner. */
    const searchAware = (): jest.Mock =>
      createRequestMock((params) =>
        Promise.resolve(
          params.get('q') === null ? listResponse() : listResponse({ items: [], total: 0 }),
        ),
      );

    it('aranan terimi iceren bos durum mesajini gosterir', async () => {
      renderPage(searchAware());
      await screen.findByRole('list', { name: 'Tutanaklar' });

      await userEvent.type(screen.getByLabelText(SEARCH_LABEL), 'zzz');

      expect(await screen.findByText("'zzz' icin sonuc bulunamadi")).toBeInTheDocument();
      expect(screen.queryByText('Henuz tutanaginiz yok')).not.toBeInTheDocument();
    });

    it('"Aramayi temizle" aramayi sifirlar ve tam liste geri gelir', async () => {
      renderPage(searchAware());
      await screen.findByRole('list', { name: 'Tutanaklar' });
      await userEvent.type(screen.getByLabelText(SEARCH_LABEL), 'zzz');
      await screen.findByText("'zzz' icin sonuc bulunamadi");

      await userEvent.click(screen.getByRole('button', { name: 'Aramayi temizle' }));

      expect(await screen.findByRole('list', { name: 'Tutanaklar' })).toBeInTheDocument();
      expect(screen.getByLabelText(SEARCH_LABEL)).toHaveValue('');
    });
  });

  describe('sayfalama (kriter 5)', () => {
    const paged = (): jest.Mock =>
      createRequestMock((params) =>
        Promise.resolve(
          listResponse({ page: Number(params.get('page') ?? '1'), pageSize: 20, total: 45 }),
        ),
      );

    it('total/page/pageSize degerlerine gore sayfa sayisini gosterir', async () => {
      renderPage(paged());

      expect(await screen.findByText('Sayfa 1 / 3')).toBeInTheDocument();
    });

    it('tek sayfalik sonucta sayfalama kontrolleri gosterilmez', async () => {
      renderPage(createRequestMock());

      await screen.findByRole('list', { name: 'Tutanaklar' });
      expect(screen.queryByRole('navigation', { name: 'Sayfalama' })).not.toBeInTheDocument();
    });

    it('sonraki sayfa secilince yeni istek yapilir', async () => {
      const request = paged();
      renderPage(request);

      await userEvent.click(await screen.findByRole('button', { name: 'Sonraki sayfa' }));

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith('/reports?page=2');
      });
      expect(await screen.findByText('Sayfa 2 / 3')).toBeInTheDocument();
    });

    it('arama terimi degisince sayfa basa doner', async () => {
      const request = paged();
      renderPage(request);
      await userEvent.click(await screen.findByRole('button', { name: 'Sonraki sayfa' }));
      await screen.findByText('Sayfa 2 / 3');

      await userEvent.type(screen.getByLabelText(SEARCH_LABEL), 'kapi');

      await waitFor(() => {
        expect(searchPaths(request)).toEqual(['/reports?q=kapi&page=1']);
      });
    });
  });

  describe('yukleme ve hata durumlari (kriter 6)', () => {
    it('liste yuklenirken iskelet kartlar gosterir', () => {
      renderPage(createRequestMock(() => new Promise<unknown>(() => undefined)));

      expect(screen.getAllByTestId('tutanak-iskeleti').length).toBeGreaterThanOrEqual(3);
      expect(screen.queryByRole('list', { name: 'Tutanaklar' })).not.toBeInTheDocument();
    });

    it('yukleme basarisiz olursa banner ve "Tekrar Dene" gosterir', async () => {
      renderPage(
        createRequestMock(() =>
          Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500)),
        ),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent(LIST_ERROR_MESSAGE);
      expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
    });

    it('"Tekrar Dene" listeyi yeniden ceker', async () => {
      let sunucuAyakta = false;
      const request = createRequestMock(() =>
        sunucuAyakta
          ? Promise.resolve(listResponse())
          : Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500)),
      );
      renderPage(request);
      const tekrarDene = await screen.findByRole('button', { name: 'Tekrar Dene' });

      sunucuAyakta = true;
      await userEvent.click(tekrarDene);

      expect(await screen.findByRole('list', { name: 'Tutanaklar' })).toBeInTheDocument();
    });

    it('sozlesme disi govde donerse sayfa cokmez, bos durum gosterir', async () => {
      renderPage(createRequestMock(() => Promise.resolve({})));

      expect(await screen.findByText('Henuz tutanaginiz yok')).toBeInTheDocument();
    });
  });

  describe('yeni tutanak girisi (kriter 7)', () => {
    it('liste yuklenirken de erisilebilirdir', () => {
      renderPage(createRequestMock(() => new Promise<unknown>(() => undefined)));

      expect(screen.getByRole('link', { name: NEW_REPORT_LABEL })).toBeInTheDocument();
    });

    it('hata durumunda da erisilebilirdir', async () => {
      renderPage(
        createRequestMock(() =>
          Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500)),
        ),
      );

      await screen.findByRole('alert');
      expect(screen.getByRole('link', { name: NEW_REPORT_LABEL })).toBeInTheDocument();
    });

    it('/reports/new rotasina goturur', async () => {
      renderPage(createRequestMock());

      await userEvent.click(screen.getByRole('link', { name: NEW_REPORT_LABEL }));

      expect(screen.getByTestId('konum')).toHaveTextContent('/reports/new');
      expect(screen.getByRole('heading', { name: 'Yeni Tutanak Ekrani' })).toBeInTheDocument();
    });
  });

  describe('karta tiklama (kriter 8)', () => {
    it('ilgili tutanagin detay sayfasini acar', async () => {
      renderPage(createRequestMock());

      await userEvent.click(await screen.findByRole('link', { name: /Bahce Kat Teslimi/ }));

      expect(screen.getByTestId('konum')).toHaveTextContent('/reports/rapor-1');
      expect(screen.getByRole('heading', { name: 'Tutanak Detayi' })).toBeInTheDocument();
    });
  });
});

/**
 * jsdom harici stil dosyasini uygulamaz; ticket teknik notundaki yerlesim kurali
 * ("mobilde sag-alt sabit FAB + safe-area, genis ekranda ust-sag buton") ve sticky arama
 * kutusu stil kaynagindan dogrulanir.
 */
describe('ReportListPage gorsel sozlesmesi (app.css)', () => {
  const css = readFileSync(join(__dirname, '..', 'styles', 'app.css'), 'utf8');
  const newButtonBlock = /\.report-list__new\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  const searchBlock = /\.report-list__search\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
  // Yalnizca `md` media sorgusunun ICINDEKI kural okunur (taban kurala dusmemek icin
  // media blogu ile secici bitisik eslesir).
  const wideScreenBlock =
    /@media \(min-width: 768px\)\s*\{\s*\.report-list__new\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

  it('yeni tutanak butonu mobilde sabit konumludur', () => {
    expect(newButtonBlock).toMatch(/position:\s*fixed/);
    expect(newButtonBlock).toMatch(/bottom:/);
    expect(newButtonBlock).toMatch(/right:/);
  });

  it('yeni tutanak butonu alt guvenli alani (safe-area-inset) hesaba katar', () => {
    expect(newButtonBlock).toMatch(/env\(safe-area-inset-bottom\)/);
  });

  it('md (768px) breakpoint ustunde sabit konumdan cikar', () => {
    expect(wideScreenBlock).toMatch(/position:\s*static/);
  });

  it('arama kutusu sticky yerlesir', () => {
    expect(searchBlock).toMatch(/position:\s*sticky/);
  });
});
