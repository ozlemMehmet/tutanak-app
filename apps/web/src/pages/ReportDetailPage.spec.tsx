// ReportDetailPage (T-020) — design.md §3 ReportDetailPage sartnamesinin tamami:
// baslik/sablon/not + durum rozeti, PDF indirme, fotograf akisi ve onay gorunumu.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { ApiClient, FileResponse } from '../api/client';
import type { Photo } from '../features/photos/photos.api';
import type { ReportDetail } from '../features/reports/reports.api';
import { formatStamp } from '../lib/format-timestamp';
import { ReportDetailPage } from './ReportDetailPage';

const REPORT_ID = 'rapor-1';
const CAPTURED_AT = '2026-08-14T09:05:00.000Z';
const APPROVED_AT = '2026-08-14T18:20:00.000Z';

const photo = (overrides: Partial<Photo> = {}): Photo => ({
  id: 'foto-1',
  reportId: REPORT_ID,
  capturedAt: CAPTURED_AT,
  contentType: 'image/jpeg',
  sizeBytes: 1024,
  widthPx: 800,
  heightPx: 600,
  url: 'https://depolama.test/foto-1.jpg',
  ...overrides,
});

const detail = (overrides: Partial<ReportDetail> = {}): ReportDetail => ({
  id: REPORT_ID,
  templateId: 'sablon-1',
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: 'Kadikoy 3+1 teslim tutanagi',
  note: 'Salon duvarinda cizik var.',
  status: 'draft',
  photoCount: 1,
  createdAt: '2026-08-14T09:00:00.000Z',
  updatedAt: '2026-08-14T09:00:00.000Z',
  photos: [photo()],
  ...overrides,
});

interface FakeServer {
  report?: ReportDetail | (() => Promise<ReportDetail>);
  photos?: Photo[];
  shareLink?: () => Promise<unknown>;
  shareEmail?: () => Promise<unknown>;
}

/**
 * Sahte istemci: sunucu yanitlari yola gore verilir, ag'a cikilmaz. Cagri SIRASI da
 * dogrulanabilsin diye tum yollar tek bir jest.Mock uzerinde toplanir.
 */
function fakeClient(server: FakeServer): {
  client: ApiClient;
  request: jest.Mock;
  requestFile: jest.Mock;
} {
  const request = jest.fn((path: string): Promise<unknown> => {
    if (path === `/reports/${REPORT_ID}`) {
      const source = server.report ?? detail();
      return typeof source === 'function' ? source() : Promise.resolve(source);
    }
    if (path === `/reports/${REPORT_ID}/photos`) {
      return Promise.resolve(server.photos ?? [photo()]);
    }
    if (path === `/reports/${REPORT_ID}/share-link`) {
      return (
        server.shareLink?.() ??
        Promise.resolve({
          token: 'tkn',
          url: 'https://app.test/t/tkn',
          whatsAppUrl: 'https://wa.me',
        })
      );
    }
    if (path === `/reports/${REPORT_ID}/share-link/email`) {
      return (
        server.shareEmail?.() ??
        Promise.resolve({ recipientEmail: 'kiraci@ornek.test', status: 'sent', errorMessage: null })
      );
    }
    return Promise.reject(new ApiError('NOT_FOUND', 'taninmayan yol', 404));
  });
  const requestFile = jest.fn((): Promise<FileResponse> =>
    Promise.resolve({
      blob: new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
      fileName: `tutanak-${REPORT_ID}.pdf`,
    }),
  );
  return { client: { request, requestFile } as unknown as ApiClient, request, requestFile };
}

function renderPage(client: ApiClient): void {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/reports/${REPORT_ID}`]}>
        <Routes>
          <Route path="/reports/:reportId" element={<ReportDetailPage client={client} />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ReportDetailPage', () => {
  beforeEach(() => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: jest.fn().mockReturnValue('blob:onizleme'),
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', { value: jest.fn(), configurable: true });
  });

  describe('baslik bolgesi (kriter 1)', () => {
    it('tutanagin basligini, sablon adini ve notunu gosterir', async () => {
      const { client } = fakeClient({});
      renderPage(client);

      expect(
        await screen.findByRole('heading', { name: 'Kadikoy 3+1 teslim tutanagi' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Giris/Cikis Teslim Tutanagi')).toBeInTheDocument();
      expect(screen.getByText('Salon duvarinda cizik var.')).toBeInTheDocument();
    });

    it('tutanagin durumunu StatusChip ile gosterir', async () => {
      const { client } = fakeClient({ report: detail({ status: 'shared' }) });
      renderPage(client);

      expect(await screen.findByText('Paylasildi')).toHaveClass('status-chip');
    });

    it('detay yuklenirken iskelet gosterir', () => {
      const { client } = fakeClient({ report: () => new Promise<ReportDetail>(() => undefined) });
      renderPage(client);

      expect(screen.getByText('Tutanak yukleniyor...')).toBeInTheDocument();
    });

    it('detay cekilemezse hata banner"i ve tekrar deneme sunar', async () => {
      let isServerDown = true;
      const { client } = fakeClient({
        report: () =>
          isServerDown
            ? Promise.reject(new ApiError('INTERNAL_ERROR', 'patladi', 500))
            : Promise.resolve(detail()),
      });
      renderPage(client);

      expect(await screen.findByRole('alert')).toHaveTextContent('Tutanak yuklenemedi');

      isServerDown = false;
      await userEvent.click(screen.getByRole('button', { name: 'Tekrar Dene' }));

      expect(
        await screen.findByRole('heading', { name: 'Kadikoy 3+1 teslim tutanagi' }),
      ).toBeInTheDocument();
    });
  });

  describe('PDF indirme (kriter 2 ve 3)', () => {
    it('PDF Indir eylemi GET /reports/{id}/pdf cagirir ve donen icerigi dosya olarak sunar', async () => {
      const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
        /* jsdom indirme baslatmaz */
      });
      const { client, requestFile } = fakeClient({});
      renderPage(client);

      await userEvent.click(await screen.findByRole('button', { name: 'PDF Indir' }));

      await waitFor(() => {
        expect(requestFile).toHaveBeenCalledWith(`/reports/${REPORT_ID}/pdf`);
      });
      await waitFor(() => {
        expect(click).toHaveBeenCalledTimes(1);
      });
      click.mockRestore();
    });

    it('sunucu dosya adi bildirmezse sozlesmedeki adla indirir', async () => {
      const downloads: string[] = [];
      const click = jest
        .spyOn(HTMLAnchorElement.prototype, 'click')
        .mockImplementation(function mockClick(this: HTMLAnchorElement) {
          downloads.push(this.download);
        });
      const { client, requestFile } = fakeClient({});
      requestFile.mockResolvedValue({ blob: new Blob(['%PDF-1.7']), fileName: null });
      renderPage(client);

      await userEvent.click(await screen.findByRole('button', { name: 'PDF Indir' }));

      await waitFor(() => {
        expect(downloads).toEqual([`tutanak-${REPORT_ID}.pdf`]);
      });
      click.mockRestore();
    });

    it('fotograf yokken PDF Indir disabled olur ve yardimci metin gosterilir', async () => {
      const { client, requestFile } = fakeClient({
        report: detail({ photoCount: 0, photos: [] }),
        photos: [],
      });
      renderPage(client);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'PDF Indir' })).toBeDisabled();
      });
      expect(screen.getByText('PDF olusturmak icin en az 1 fotograf ekleyin')).toBeInTheDocument();
      // 400 REPORT_HAS_NO_PHOTOS kullaniciya hic yansimaz: istek hic atilmaz.
      expect(requestFile).not.toHaveBeenCalled();
    });

    it('indirme surerken buton beklemede kalir (cift tiklama ikinci istek uretmez)', async () => {
      const { client, requestFile } = fakeClient({});
      requestFile.mockReturnValue(new Promise(() => undefined));
      renderPage(client);

      await userEvent.click(await screen.findByRole('button', { name: 'PDF Indir' }));

      const pendingButton = await screen.findByRole('button', { name: 'PDF hazirlaniyor...' });
      expect(pendingButton).toBeDisabled();
      await userEvent.click(pendingButton);
      expect(requestFile).toHaveBeenCalledTimes(1);
    });

    it('fotograf listesi henuz gelmemisken buton durumunu tutanagin photoCount degeri belirler', async () => {
      const { client, request } = fakeClient({ report: detail({ photoCount: 0, photos: [] }) });
      const serveDetailOnly = request.getMockImplementation() as (path: string) => Promise<unknown>;
      // Fotograf listesi askida kalir: buton durumu yalnizca detaydan gelen photoCount ile kurulur.
      request.mockImplementation((path: string): Promise<unknown> =>
        path === `/reports/${REPORT_ID}/photos`
          ? new Promise<unknown>(() => undefined)
          : serveDetailOnly(path),
      );
      renderPage(client);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'PDF Indir' })).toBeDisabled();
      });
      expect(screen.getByText('Fotograflar yukleniyor...')).toBeInTheDocument();
    });

    it('PDF uretimi 502 dondugunde sartnamedeki toast gosterilir', async () => {
      const { client, requestFile } = fakeClient({});
      requestFile.mockRejectedValue(new ApiError('STORAGE_UNAVAILABLE', 'depolama yok', 502));
      renderPage(client);

      await userEvent.click(await screen.findByRole('button', { name: 'PDF Indir' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'PDF olusturulamadi, tekrar deneyin',
      );
    });
  });

  describe('fotograf akisi (kriter 4 ve 7)', () => {
    it('her fotografin sunucu damgasini izgarada gosterir', async () => {
      const { client } = fakeClient({ photos: [photo()] });
      renderPage(client);

      expect(await screen.findByText(formatStamp(CAPTURED_AT))).toBeInTheDocument();
    });

    it('boyut asiminda sartnamedeki toast metnini gosterir', async () => {
      const { client, request } = fakeClient({});
      renderPage(client);
      await screen.findByRole('heading', { name: 'Kadikoy 3+1 teslim tutanagi' });

      request.mockRejectedValueOnce(new ApiError('FILE_TOO_LARGE', 'sunucu metni', 400));
      await userEvent.upload(
        screen.getByLabelText('Fotograf Ekle'),
        new File(['kare'], 'kamera.jpg', { type: 'image/jpeg' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Dosya cok buyuk, en fazla 10 MB');
    });

    it('depolama arizasinda (502) tekrar denemeye yonlendiren toast gosterir', async () => {
      const { client, request } = fakeClient({});
      renderPage(client);
      await screen.findByRole('heading', { name: 'Kadikoy 3+1 teslim tutanagi' });

      request.mockRejectedValueOnce(new ApiError('STORAGE_UNAVAILABLE', 'depolama yok', 502));
      await userEvent.upload(
        screen.getByLabelText('Fotograf Ekle'),
        new File(['kare'], 'kamera.jpg', { type: 'image/jpeg' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Yukle' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Yukleme basarisiz, tekrar deneyin',
      );
    });
  });

  describe('onaylanmis tutanak (kriter 6)', () => {
    const approved = detail({
      status: 'approved',
      approval: { id: 'onay-1', approverEmail: 'kiraci@ornek.test', approvedAt: APPROVED_AT },
    });

    it('onay banner"ini onaylayan e-posta ve damgasiyla gosterir', async () => {
      const { client } = fakeClient({ report: approved });
      renderPage(client);

      const banner = await screen.findByRole('status');
      expect(banner).toHaveTextContent('Bu tutanak onaylandi');
      expect(banner).toHaveTextContent('kiraci@ornek.test');
      expect(banner).toHaveTextContent(formatStamp(APPROVED_AT));
    });

    it('onay ayrintisi yanitta yoksa banner"i yalin metinle gosterir', async () => {
      const { client } = fakeClient({ report: detail({ status: 'approved' }) });
      renderPage(client);

      expect(await screen.findByRole('status')).toHaveTextContent('Bu tutanak onaylandi');
    });

    it('fotograf ekleme arayuzunu hic gostermez, galeri salt-okunur kalir', async () => {
      const { client } = fakeClient({ report: approved });
      renderPage(client);

      await screen.findByRole('status');
      await waitFor(() => {
        expect(screen.getAllByRole('img')).toHaveLength(1);
      });
      expect(screen.queryByLabelText('Fotograf Ekle')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Yukle' })).not.toBeInTheDocument();
    });
  });

  describe('paylasim sirasi (kriter 8)', () => {
    it('e-posta gondermeden ONCE share-link cagirir; 404 kullaniciya yansimaz', async () => {
      const { client, request } = fakeClient({
        // Sunucu: link uretilmeden e-posta istenirse 404 SHARE_LINK_NOT_FOUND (CLAUDE.md §3.10).
        shareEmail: () =>
          request.mock.calls.some(
            (call) => (call as [string])[0] === `/reports/${REPORT_ID}/share-link`,
          )
            ? Promise.resolve({
                recipientEmail: 'kiraci@ornek.test',
                status: 'sent',
                errorMessage: null,
              })
            : Promise.reject(new ApiError('SHARE_LINK_NOT_FOUND', 'link yok', 404)),
      });
      renderPage(client);

      await userEvent.click(await screen.findByRole('button', { name: 'Paylas' }));
      const panel = await screen.findByRole('textbox', { name: 'Paylasim linki' });
      expect(panel).toHaveValue('https://app.test/t/tkn');

      await userEvent.type(screen.getByLabelText('Alici e-posta'), 'kiraci@ornek.test');
      await userEvent.click(screen.getByRole('button', { name: 'E-posta Gonder' }));

      expect(await screen.findByRole('status')).toHaveTextContent('E-posta gonderildi');
      const paths = request.mock.calls.map((call) => (call as [string])[0]);
      const emailIndex = paths.indexOf(`/reports/${REPORT_ID}/share-link/email`);
      expect(paths.slice(0, emailIndex)).toContain(`/reports/${REPORT_ID}/share-link`);
      expect(screen.queryByText(/gecersiz|bulunamadi/i)).not.toBeInTheDocument();
    });
  });

  it('rota parametresi yoksa tutanak bulunamadi mesaji gosterir', () => {
    const { client } = fakeClient({});
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/reports']}>
          <Routes>
            <Route path="/reports" element={<ReportDetailPage client={client} />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(within(screen.getByRole('alert')).getByText('Tutanak bulunamadi')).toBeInTheDocument();
  });
});
