// Salt-okunur genel gorunumun yanit govdesi (CLAUDE.md §3.5, §7 Mapper): govde YALNIZCA
// burada kurulur, bu yuzden ic alanlarin (ownerId, reportId, storageKey, shareLinkId)
// sizmadigi burada yapisal olarak dogrulanir (T-009 kriter 3).
import type { PhotoDto } from '../../photos/dto/photo.dto';
import type { PublicReportRecord } from '../sharing.repository';
import { PUBLIC_REPORT_DISCLAIMER, toPublicReportViewDto } from './public-report.mapper';

const REPORT_ID = '22222222-2222-4222-8222-222222222222';

const RECORD: PublicReportRecord = {
  reportId: REPORT_ID,
  title: 'Kadikoy 3+1 teslim tutanagi',
  templateName: 'Kiraci Cikis Teslimi',
  note: 'Salon duvarinda cizik var.',
  status: 'shared',
  createdAt: new Date('2026-08-14T09:00:00.000Z'),
  approval: null,
};

const PHOTO: PhotoDto = {
  id: '55555555-5555-4555-8555-555555555555',
  reportId: REPORT_ID,
  capturedAt: '2026-08-14T09:05:00.000Z',
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
  url: 'https://depolama.test/reports/abc.jpg?imza=sahte',
};

describe('toPublicReportViewDto', () => {
  it('sozlesmedeki PublicReportView alanlarini doldurur ve damgalari ISO 8601 metnine cevirir', () => {
    const dto = toPublicReportViewDto(RECORD, [PHOTO]);

    expect(dto).toEqual({
      title: RECORD.title,
      templateName: RECORD.templateName,
      note: RECORD.note,
      status: 'shared',
      createdAt: '2026-08-14T09:00:00.000Z',
      isApproved: false,
      disclaimer: PUBLIC_REPORT_DISCLAIMER,
      photos: [{ id: PHOTO.id, capturedAt: PHOTO.capturedAt, url: PHOTO.url }],
    });
  });

  it('fotograf basina yalnizca kimlik, damga ve URL tasir — depolama anahtari/tutanak kimligi sizmaz', () => {
    const [photo] = toPublicReportViewDto(RECORD, [PHOTO]).photos;

    expect(Object.keys(photo ?? {}).sort()).toEqual(['capturedAt', 'id', 'url']);
    expect(JSON.stringify(photo)).not.toContain('storageKey');
    expect(JSON.stringify(photo)).not.toContain(REPORT_ID);
  });

  it('fotograf sirasini oldugu gibi korur (kaynak sorgu (sort_order, captured_at) siralar — §3.14)', () => {
    const second: PhotoDto = {
      ...PHOTO,
      id: 'ikinci-foto',
      capturedAt: '2026-08-14T09:07:00.000Z',
    };

    const dto = toPublicReportViewDto(RECORD, [PHOTO, second]);

    expect(dto.photos.map((item) => item.id)).toEqual([PHOTO.id, 'ikinci-foto']);
  });

  it('fotografsiz tutanakta bos dizi doner (paylasim fotografsiz da yapilabilir)', () => {
    expect(toPublicReportViewDto(RECORD, []).photos).toEqual([]);
  });

  it('onay yokken `approval` alanini yanit govdesine HIC KOYMAZ (CLAUDE.md §3.5)', () => {
    const dto = toPublicReportViewDto(RECORD, [PHOTO]);

    expect('approval' in dto).toBe(false);
    expect(JSON.parse(JSON.stringify(dto))).not.toHaveProperty('approval');
  });

  it('onay varsa `isApproved` true ve `approval` sozlesmedeki alanlarla dolar', () => {
    const dto = toPublicReportViewDto(
      {
        ...RECORD,
        status: 'approved',
        approval: {
          id: '66666666-6666-4666-8666-666666666666',
          approverEmail: 'kiraci@ornek.test',
          approvedAt: new Date('2026-08-14T10:00:00.000Z'),
        },
      },
      [PHOTO],
    );

    expect(dto.isApproved).toBe(true);
    expect(dto.approval).toEqual({
      id: '66666666-6666-4666-8666-666666666666',
      approverEmail: 'kiraci@ornek.test',
      approvedAt: '2026-08-14T10:00:00.000Z',
    });
  });

  it('yanit govdesi ic kimlikleri (ownerId, reportId, shareLinkId) SIZDIRMAZ (kriter 3)', () => {
    const body = JSON.stringify(toPublicReportViewDto(RECORD, [PHOTO]));

    expect(body).not.toContain('ownerId');
    expect(body).not.toContain('reportId');
    expect(body).not.toContain('shareLinkId');
    expect(body).not.toContain('token');
  });

  it('uyari metni sozlesmedeki "destekleyici kanit" ifadesini tasir', () => {
    expect(PUBLIC_REPORT_DISCLAIMER).toContain('resmi hukuki delil değildir');
    expect(PUBLIC_REPORT_DISCLAIMER).toContain('destekleyici kanıttır');
  });
});
