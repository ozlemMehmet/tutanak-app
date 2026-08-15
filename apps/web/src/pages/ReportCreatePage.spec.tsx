// ReportCreatePage (`/reports/new`) — design.md §3 ReportCreatePage sartnamesi, T-019 kriter 1-8.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { ApiError } from '../api/client';
import type { Report, Template } from '../features/reports/reports.api';
import { ReportCreatePage } from './ReportCreatePage';

const TEMPLATES: Template[] = [
  {
    id: 'sablon-1',
    code: 'move_in_out',
    name: 'Giris/Cikis Teslim Tutanagi',
    description: 'Kiraci giris ve cikis teslimleri icin.',
  },
  {
    id: 'sablon-2',
    code: 'meter_fixture',
    name: 'Sayac ve Demirbas Tutanagi',
    description: 'Sayac degerleri ve demirbas listesi icin.',
  },
  {
    id: 'sablon-3',
    code: 'periodic_check',
    name: 'Periyodik Kontrol Tutanagi',
    description: 'Donemsel kontroller icin.',
  },
];

const CREATED_REPORT: Report = {
  id: 'rapor-1',
  templateId: 'sablon-1',
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: 'Bahce Kat Teslimi',
  note: '',
  status: 'draft',
  photoCount: 0,
  createdAt: '2026-08-15T09:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
};

const FIRST_TEMPLATE_NAME = /Giris\/Cikis Teslim Tutanagi/;
const SUBMIT_LABEL = 'Taslak Olustur';

type Responder = () => Promise<unknown>;

interface RequestMockOptions {
  templates?: Responder;
  create?: Responder;
}

/** Yol bazli sahte istemci: `/templates` ve `/reports` disinda cagri beklenmez. */
function createRequestMock(options: RequestMockOptions = {}): jest.Mock {
  const templates = options.templates ?? ((): Promise<unknown> => Promise.resolve(TEMPLATES));
  const create = options.create ?? ((): Promise<unknown> => Promise.resolve(CREATED_REPORT));

  return jest.fn((path: string) => {
    if (path === '/templates') {
      return templates();
    }
    if (path === '/reports') {
      return create();
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
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/reports/new']}>
        <LocationProbe />
        <Routes>
          <Route path="/reports/new" element={<ReportCreatePage client={{ request }} />} />
          <Route path="/reports/:reportId" element={<h1>Tutanak Detayi</h1>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Sablonlar geldikten sonra ilk sablonu secer (ikinci adimin on kosulu). */
async function selectFirstTemplate(): Promise<void> {
  await userEvent.click(await screen.findByRole('radio', { name: FIRST_TEMPLATE_NAME }));
}

describe('ReportCreatePage', () => {
  describe('sablon listesi (kriter 1)', () => {
    it('acildiginda GET /templates cagrilir', async () => {
      const request = createRequestMock();
      renderPage(request);

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith('/templates');
      });
    });

    it('donen 3 sablonu secilebilir kart olarak listeler', async () => {
      renderPage(createRequestMock());

      const options = await screen.findAllByRole('radio');
      expect(options).toHaveLength(3);
      expect(screen.getByRole('radio', { name: FIRST_TEMPLATE_NAME })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: /Periyodik Kontrol Tutanagi/ })).toBeInTheDocument();
    });

    it('kartlari tek bir listede sunar', async () => {
      renderPage(createRequestMock());

      await screen.findAllByRole('radio');
      const list = screen.getByRole('list', { name: 'Sablonlar' });
      expect(within(list).getAllByRole('listitem')).toHaveLength(3);
    });
  });

  describe('sablon secimi (kriter 2)', () => {
    it('secilen kart secili gorunume gecer', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();

      const option = screen.getByRole('radio', { name: FIRST_TEMPLATE_NAME });
      expect(option).toBeChecked();
      expect(option.closest('li')?.className).toContain('template-card--selected');
    });

    it('ikinci sablon secildiginde ilk sablonun secimi kalkar', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();
      await userEvent.click(screen.getByRole('radio', { name: /Sayac ve Demirbas Tutanagi/ }));

      expect(screen.getByRole('radio', { name: FIRST_TEMPLATE_NAME })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: /Sayac ve Demirbas Tutanagi/ })).toBeChecked();
    });

    it('sablon secilmeden baslik ve not alanlari erisilebilir degildir', async () => {
      renderPage(createRequestMock());

      await screen.findAllByRole('radio');

      expect(screen.getByLabelText('Baslik')).toBeDisabled();
      expect(screen.getByLabelText('Not (opsiyonel)')).toBeDisabled();
    });

    it('sablon secildiginde baslik ve not alanlari erisilebilir olur', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();

      expect(screen.getByLabelText('Baslik')).toBeEnabled();
      expect(screen.getByLabelText('Not (opsiyonel)')).toBeEnabled();
    });

    it('adim gostergesi secimden sonra ikinci adima gecer', async () => {
      renderPage(createRequestMock());

      await screen.findAllByRole('radio');
      const steps = screen.getByRole('list', { name: 'Tutanak olusturma adimlari' });
      expect(within(steps).getAllByRole('listitem')[0]).toHaveAttribute('aria-current', 'step');

      await selectFirstTemplate();

      expect(within(steps).getAllByRole('listitem')[1]).toHaveAttribute('aria-current', 'step');
    });
  });

  describe('gonderim kosullari (kriter 3)', () => {
    it('sablon secilmeden Taslak Olustur butonu disabled kalir', async () => {
      renderPage(createRequestMock());

      await screen.findAllByRole('radio');

      expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeDisabled();
    });

    it('sablon secili ama baslik bosken Taslak Olustur butonu disabled kalir', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();

      expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeDisabled();
    });

    it('baslik yalnizca bosluk karakterlerinden olusuyorsa buton disabled kalir', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), '   ');

      expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeDisabled();
    });

    it('sablon secilmeden form gonderilse bile POST /reports cagrilmaz', async () => {
      const request = createRequestMock();
      renderPage(request);

      await screen.findAllByRole('radio');
      // Buton disabled oldugu icin arayuzden ulasilamaz; sunucuya gecersiz istek gitmemesini
      // garanti eden savunma dogrudan `submit` olayi ile dogrulanir.
      fireEvent.submit(screen.getByRole('form', { name: 'Yeni tutanak formu' }));

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith('/templates');
      });
      expect(request).not.toHaveBeenCalledWith('/reports', expect.anything());
    });

    it('sablon secili ve baslik doluyken buton etkinlesir', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');

      expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeEnabled();
    });
  });

  describe('form alanlari (kriter 4)', () => {
    it('baslik alani zorunludur ve en fazla 200 karakter kabul eder', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();

      const title = screen.getByLabelText('Baslik');
      expect(title).toBeRequired();
      expect(title).toHaveAttribute('maxLength', '200');
    });

    it('not alani opsiyoneldir ve en fazla 5000 karakter kabul eder', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();

      const note = screen.getByLabelText('Not (opsiyonel)');
      expect(note).not.toBeRequired();
      expect(note).toHaveAttribute('maxLength', '5000');
    });

    it('not alani icin karakter sayaci gosterir ve yazdikca gunceller', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();
      expect(screen.getByText('0 / 5000')).toBeInTheDocument();

      await userEvent.type(screen.getByLabelText('Not (opsiyonel)'), 'kapi');

      expect(screen.getByText('4 / 5000')).toBeInTheDocument();
    });
  });

  describe('basarili gonderim (kriter 5)', () => {
    it('POST /reports cagirir ve secilen sablonu, basligi, notu gonderir', async () => {
      const request = createRequestMock();
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.type(screen.getByLabelText('Not (opsiyonel)'), 'kapi kolu kirik');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith('/reports', {
          method: 'POST',
          body: JSON.stringify({
            templateId: 'sablon-1',
            title: 'Bahce Kat Teslimi',
            note: 'kapi kolu kirik',
          }),
        });
      });
    });

    it('201 donunce olusan tutanagin detay sayfasina yonlendirir', async () => {
      renderPage(createRequestMock());

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      await waitFor(() => {
        expect(screen.getByTestId('konum')).toHaveTextContent('/reports/rapor-1');
      });
      expect(screen.getByRole('heading', { name: 'Tutanak Detayi' })).toBeInTheDocument();
    });

    it('gonderim surerken butonu ve alanlari devre disi birakir', async () => {
      const request = createRequestMock({
        create: () => new Promise<unknown>(() => undefined),
      });
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Taslak olusturuluyor...' })).toBeDisabled();
      });
      expect(screen.getByLabelText('Baslik')).toBeDisabled();
      expect(screen.getByRole('radio', { name: FIRST_TEMPLATE_NAME })).toBeDisabled();
    });
  });

  describe('alan bazli hata (kriter 6)', () => {
    it('400 yanitinda hatayi ilgili alanin altinda gosterir', async () => {
      const request = createRequestMock({
        create: () =>
          Promise.reject(
            new ApiError('VALIDATION_ERROR', 'Girdi dogrulanamadi.', 400, [
              { field: 'title', message: 'baslik zorunludur' },
            ]),
          ),
      });
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'B');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      const title = await screen.findByLabelText('Baslik');
      await waitFor(() => {
        expect(title).toHaveAttribute('aria-invalid', 'true');
      });
      const errorId = screen.getByText('baslik zorunludur').getAttribute('id');
      expect(title.getAttribute('aria-describedby')).toContain(errorId);
    });

    it('400 yanitinda sayfada kalir', async () => {
      const request = createRequestMock({
        create: () =>
          Promise.reject(
            new ApiError('VALIDATION_ERROR', 'Girdi dogrulanamadi.', 400, [
              { field: 'title', message: 'baslik zorunludur' },
            ]),
          ),
      });
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'B');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      await screen.findByText('baslik zorunludur');
      expect(screen.getByTestId('konum')).toHaveTextContent('/reports/new');
    });

    it('not alanina ait 400 detayini not alaninin altinda gosterir', async () => {
      const request = createRequestMock({
        create: () =>
          Promise.reject(
            new ApiError('VALIDATION_ERROR', 'Girdi dogrulanamadi.', 400, [
              { field: 'note', message: 'not en fazla 5000 karakter olabilir' },
            ]),
          ),
      });
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      const note = await screen.findByLabelText('Not (opsiyonel)');
      await waitFor(() => {
        expect(note).toHaveAttribute('aria-invalid', 'true');
      });
      const errorId = screen.getByText('not en fazla 5000 karakter olabilir').getAttribute('id');
      // Sayac baglantisi korunur: alan hem sayaci hem hata mesajini tarif eder.
      expect(note.getAttribute('aria-describedby')).toContain(errorId);
      expect(note.getAttribute('aria-describedby')).toContain('report-note-counter');
    });
  });

  describe('gecersiz sablon (kriter 7)', () => {
    const templateNotFound = (): RequestMockOptions => ({
      create: () => Promise.reject(new ApiError('TEMPLATE_NOT_FOUND', 'Sablon bulunamadi.', 404)),
    });

    it('404 TEMPLATE_NOT_FOUND yanitinda uyari banner"i gosterir', async () => {
      renderPage(createRequestMock(templateNotFound()));

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Secilen sablon artik gecerli degil, sayfayi yenileyin',
      );
    });

    it('404 TEMPLATE_NOT_FOUND yanitinda sablon listesini yeniden ceker', async () => {
      const request = createRequestMock(templateNotFound());
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      await waitFor(() => {
        expect(request.mock.calls.filter(([path]) => path === '/templates')).toHaveLength(2);
      });
    });

    it('yeniden cekilen listede secili sablon yoksa secim gecersiz sayilir', async () => {
      let templateCallCount = 0;
      const request = createRequestMock({
        ...templateNotFound(),
        templates: () => {
          templateCallCount += 1;
          return Promise.resolve(templateCallCount === 1 ? TEMPLATES : TEMPLATES.slice(1));
        },
      });
      renderPage(request);

      await selectFirstTemplate();
      await userEvent.type(screen.getByLabelText('Baslik'), 'Bahce Kat Teslimi');
      await userEvent.click(screen.getByRole('button', { name: SUBMIT_LABEL }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeDisabled();
      });
    });
  });

  describe('liste yukleme ve hata durumlari (kriter 8)', () => {
    it('sablonlar yuklenirken 3 iskelet kart gosterir', () => {
      renderPage(createRequestMock({ templates: () => new Promise<unknown>(() => undefined) }));

      expect(screen.getAllByTestId('sablon-iskeleti')).toHaveLength(3);
      expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    });

    it('sablonlar yuklenemezse banner ve Tekrar Dene butonu gosterir', async () => {
      renderPage(
        createRequestMock({
          templates: () => Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500)),
        }),
      );

      expect(await screen.findByRole('alert')).toHaveTextContent('Sablonlar yuklenemedi');
      expect(screen.getByRole('button', { name: 'Tekrar Dene' })).toBeInTheDocument();
    });

    it('Tekrar Dene sablon listesini yeniden ceker', async () => {
      let templateCallCount = 0;
      const request = createRequestMock({
        templates: () => {
          templateCallCount += 1;
          return templateCallCount === 1
            ? Promise.reject(new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500))
            : Promise.resolve(TEMPLATES);
        },
      });
      renderPage(request);

      await userEvent.click(await screen.findByRole('button', { name: 'Tekrar Dene' }));

      expect(await screen.findAllByRole('radio')).toHaveLength(3);
    });

    it('sozlesme disi bos liste donerse savunmaci olarak hata banner"i gosterir', async () => {
      renderPage(createRequestMock({ templates: () => Promise.resolve([]) }));

      expect(await screen.findByRole('alert')).toHaveTextContent('Sablonlar yuklenemedi');
      expect(screen.getByRole('button', { name: SUBMIT_LABEL })).toBeDisabled();
    });
  });
});

/**
 * jsdom harici stil dosyasini uygulamaz; "3 sablon karti yatay kaydirma ile DEGIL, dikey
 * listelenir" kurali (ticket teknik notu + design.md mobil notu) stil kaynagindan dogrulanir.
 */
describe('ReportCreatePage gorsel sozlesmesi (app.css)', () => {
  const css = readFileSync(join(__dirname, '..', 'styles', 'app.css'), 'utf8');
  const templateListBlock = /\.template-list\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

  it('sablon listesi dikey yerlesim kullanir', () => {
    expect(templateListBlock).toMatch(/flex-direction:\s*column/);
  });

  it('sablon listesinde yatay kaydirma yoktur', () => {
    expect(templateListBlock).not.toMatch(/overflow-x/);
  });
});
