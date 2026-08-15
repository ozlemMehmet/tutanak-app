// Sozlesme yuzeyleri (T-019 kriter 1 ve 5): `GET /templates` ve `POST /reports`.
// T-020 ile eklendi: `GET /reports/{id}` (detay) ve `GET /reports/{id}/pdf` (indirme).
// T-021 ile eklendi: `GET /reports` liste/arama/sayfalama yuzeyi.
import type { ApiClient } from '../../api/client';
import type { CreateReportRequest, ReportListResponse } from './reports.api';
import {
  buildReportListPath,
  createReport,
  downloadReportPdf,
  fetchReport,
  fetchReports,
  fetchTemplates,
} from './reports.api';

const TEMPLATE = {
  id: 'sablon-1',
  code: 'move_in_out' as const,
  name: 'Giris/Cikis Teslim Tutanagi',
  description: 'Kiraci giris ve cikis teslimleri icin.',
};

const REPORT = {
  id: 'rapor-1',
  templateId: 'sablon-1',
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: 'Bahce Kat Teslimi',
  note: '',
  status: 'draft' as const,
  photoCount: 0,
  createdAt: '2026-08-15T09:00:00.000Z',
  updatedAt: '2026-08-15T09:00:00.000Z',
};

/** Sahte istemci: cagrilar test icinde dogrulanir, ag'a cikilmaz. */
function createClient(request: jest.Mock, requestFile: jest.Mock = jest.fn()): ApiClient {
  return { request, requestFile };
}

describe('fetchTemplates', () => {
  it('GET /templates yolunu cagirir ve donen listeyi verir', async () => {
    const request = jest.fn().mockResolvedValue([TEMPLATE]);

    const templates = await fetchTemplates(createClient(request));

    expect(request).toHaveBeenCalledWith('/templates');
    expect(templates).toEqual([TEMPLATE]);
  });
});

describe('fetchReport', () => {
  it('GET /reports/{id} yolunu cagirir ve tutanak detayini verir', async () => {
    const detail = { ...REPORT, photos: [] };
    const request = jest.fn().mockResolvedValue(detail);

    const report = await fetchReport(createClient(request), 'rapor-1');

    expect(request).toHaveBeenCalledWith('/reports/rapor-1');
    expect(report).toEqual(detail);
  });
});

describe('downloadReportPdf', () => {
  it('GET /reports/{id}/pdf yolunu ikili govde okuyan istemci yontemiyle cagirir', async () => {
    const file = { blob: new Blob(['%PDF-1.7']), fileName: 'tutanak-rapor-1.pdf' };
    const requestFile = jest.fn().mockResolvedValue(file);

    const result = await downloadReportPdf(createClient(jest.fn(), requestFile), 'rapor-1');

    expect(requestFile).toHaveBeenCalledWith('/reports/rapor-1/pdf');
    expect(result).toEqual(file);
  });
});

describe('buildReportListPath', () => {
  it('arama terimi bosken `q` parametresini hic gondermez (sozlesme: filtre uygulanmaz)', () => {
    expect(buildReportListPath({ q: '', page: 1 })).toBe('/reports?page=1');
  });

  it('arama terimini `q` parametresi olarak gonderir', () => {
    expect(buildReportListPath({ q: 'kapi', page: 1 })).toBe('/reports?q=kapi&page=1');
  });

  it('yalnizca bosluktan olusan terimi filtre saymaz', () => {
    expect(buildReportListPath({ q: '   ', page: 1 })).toBe('/reports?page=1');
  });

  it('ozel karakterli terimi URL kodlar', () => {
    expect(buildReportListPath({ q: 'kapi & pencere', page: 1 })).toBe(
      '/reports?q=kapi+%26+pencere&page=1',
    );
  });

  it('sayfa numarasini `page` parametresi olarak gonderir', () => {
    expect(buildReportListPath({ q: '', page: 3 })).toBe('/reports?page=3');
  });
});

describe('fetchReports', () => {
  it('GET /reports yolunu cagirir ve sayfali yaniti oldugu gibi verir', async () => {
    const response: ReportListResponse = { items: [REPORT], page: 1, pageSize: 20, total: 1 };
    const request = jest.fn().mockResolvedValue(response);

    const list = await fetchReports(createClient(request), { q: 'bahce', page: 1 });

    expect(request).toHaveBeenCalledWith('/reports?q=bahce&page=1');
    expect(list).toEqual(response);
  });
});

describe('createReport', () => {
  it('POST /reports govdesini sozlesme alanlariyla gonderir', async () => {
    const request = jest.fn().mockResolvedValue(REPORT);

    const report = await createReport(createClient(request), {
      templateId: 'sablon-1',
      title: 'Bahce Kat Teslimi',
      note: 'kapi kolu kirik',
    });

    expect(request).toHaveBeenCalledWith('/reports', {
      method: 'POST',
      body: JSON.stringify({
        templateId: 'sablon-1',
        title: 'Bahce Kat Teslimi',
        note: 'kapi kolu kirik',
      }),
    });
    expect(report).toEqual(REPORT);
  });

  it('sozlesme disi alanlari govdeye koymaz (CLAUDE.md §3.7 govde katiligi)', async () => {
    const request = jest.fn().mockResolvedValue(REPORT);
    // Sunucu fazladan alanda 400 doner; istemci damga/durum alani gondermemelidir.
    const input = {
      templateId: 'sablon-1',
      title: 'Bahce Kat Teslimi',
      note: '',
      capturedAt: '2026-08-15T09:00:00.000Z',
      status: 'approved',
    } as unknown as CreateReportRequest;

    await createReport(createClient(request), input);

    expect(request).toHaveBeenCalledWith('/reports', {
      method: 'POST',
      body: JSON.stringify({ templateId: 'sablon-1', title: 'Bahce Kat Teslimi', note: '' }),
    });
  });
});
