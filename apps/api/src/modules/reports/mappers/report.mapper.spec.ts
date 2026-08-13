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

  it('zaman damgalarini ISO 8601 metnine cevirir', () => {
    const dto = toReportDto(STORED_REPORT);

    expect(dto.createdAt).toBe(STORED_REPORT.createdAt.toISOString());
    expect(dto.updatedAt).toBe(STORED_REPORT.updatedAt.toISOString());
  });
});

describe('toReportDetailDto', () => {
  it('Report alanlarina ek olarak bos fotograf listesi tasir (fotograf yukleme T-006)', () => {
    const detail = toReportDetailDto(STORED_REPORT);

    expect(detail).toEqual({ ...toReportDto(STORED_REPORT), photos: [] });
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
