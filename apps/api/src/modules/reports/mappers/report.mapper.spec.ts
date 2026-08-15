import type { PhotoDto } from '../../photos/dto/photo.dto';
import type { ReportRecord } from '../reports.repository';
import { toReportDetailDto, toReportDto, toReportListDto } from './report.mapper';

const STORED_REPORT: ReportRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  ownerId: '33333333-3333-4333-8333-333333333333',
  templateId: '11111111-1111-4111-8111-111111111111',
  templateName: 'Giris/Cikis Teslim Tutanagi',
  title: 'Bahcelievler 3+1 cikis teslimi',
  note: 'Salon duvarinda cizik var.',
  status: 'draft',
  photoCount: 0,
  createdAt: new Date('2026-08-13T10:00:00.000Z'),
  updatedAt: new Date('2026-08-13T10:05:00.000Z'),
  approval: null,
};

/** T-010: onaylanmis tutanagin depo kaydindaki onay bilgisi. */
const APPROVED_REPORT: ReportRecord = {
  ...STORED_REPORT,
  status: 'approved',
  approval: {
    id: '66666666-6666-4666-8666-666666666666',
    approverEmail: 'kiraci@ornek.test',
    approvedAt: new Date('2026-08-15T09:30:00.000Z'),
  },
};

describe('toReportDto', () => {
  it('sozlesmedeki Report alanlarini doner ve owner_id gibi ic alanlari sizdirmaz', () => {
    const dto = toReportDto(STORED_REPORT);

    expect(dto).toEqual({
      id: STORED_REPORT.id,
      templateId: STORED_REPORT.templateId,
      templateName: STORED_REPORT.templateName,
      title: STORED_REPORT.title,
      note: STORED_REPORT.note,
      status: 'draft',
      photoCount: 0,
      createdAt: '2026-08-13T10:00:00.000Z',
      updatedAt: '2026-08-13T10:05:00.000Z',
    });
    expect(Object.keys(dto)).not.toContain('ownerId');
  });

  it('liste/ozet yanitinda onay bilgisi TASINMAZ (sozlesme: Report.approval yoktur)', () => {
    expect('approval' in toReportDto(APPROVED_REPORT)).toBe(false);
  });

  it('zaman damgalarini ISO 8601 metnine cevirir', () => {
    const dto = toReportDto(STORED_REPORT);

    expect(dto.createdAt).toBe(STORED_REPORT.createdAt.toISOString());
    expect(dto.updatedAt).toBe(STORED_REPORT.updatedAt.toISOString());
  });
});

const PHOTO: PhotoDto = {
  id: '55555555-5555-4555-8555-555555555555',
  reportId: STORED_REPORT.id,
  capturedAt: '2026-08-13T10:02:00.000Z',
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
  url: 'https://depolama.test/reports/abc.jpg?imza=sahte',
};

describe('toReportDetailDto', () => {
  it('Report alanlarina ek olarak verilen fotograf listesini tasir (T-006)', () => {
    const detail = toReportDetailDto(STORED_REPORT, [PHOTO]);

    expect(detail).toEqual({ ...toReportDto(STORED_REPORT), photos: [PHOTO] });
  });

  it('onaylanmis tutanakta onay bilgisini (Approval) tasir (T-010 kriter 6)', () => {
    const detail = toReportDetailDto(APPROVED_REPORT, []);

    expect(detail.status).toBe('approved');
    expect(detail.approval).toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      approverEmail: 'kiraci@ornek.test',
      approvedAt: '2026-08-15T09:30:00.000Z',
    });
  });

  it('onay yokken `approval` alani yanit govdesine HIC konulmaz (CLAUDE.md §3.5)', () => {
    const detail = toReportDetailDto(STORED_REPORT, []);

    expect('approval' in detail).toBe(false);
  });

  it('fotograf yokken bos dizi tasir (alan yanittan cikarilmaz)', () => {
    const detail = toReportDetailDto(STORED_REPORT, []);

    expect(detail.photos).toEqual([]);
  });
});

describe('toReportListDto', () => {
  it('sozlesmedeki ReportListResponse alanlarini kurar ve ogeleri Report tipine cevirir', () => {
    const list = toReportListDto([STORED_REPORT], { page: 2, pageSize: 10, total: 11 });

    expect(list).toEqual({
      items: [toReportDto(STORED_REPORT)],
      page: 2,
      pageSize: 10,
      total: 11,
    });
    expect(Object.keys(list.items[0] ?? {})).not.toContain('ownerId');
  });

  it('kayit yoksa bos oge listesi ve sifir toplam doner', () => {
    const list = toReportListDto([], { page: 1, pageSize: 20, total: 0 });

    expect(list).toEqual({ items: [], page: 1, pageSize: 20, total: 0 });
  });
});
