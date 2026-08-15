// Sozlesme yuzeyleri (T-019 kriter 1 ve 5): `GET /templates` ve `POST /reports`.
import type { ApiClient } from '../../api/client';
import type { CreateReportRequest } from './reports.api';
import { createReport, fetchTemplates } from './reports.api';

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
function createClient(request: jest.Mock): ApiClient {
  return { request };
}

describe('fetchTemplates', () => {
  it('GET /templates yolunu cagirir ve donen listeyi verir', async () => {
    const request = jest.fn().mockResolvedValue([TEMPLATE]);

    const templates = await fetchTemplates(createClient(request));

    expect(request).toHaveBeenCalledWith('/templates');
    expect(templates).toEqual([TEMPLATE]);
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
