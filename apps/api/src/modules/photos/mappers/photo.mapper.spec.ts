import type { PhotoRecord } from '../photos.repository';
import { toPhotoDto } from './photo.mapper';

const RECORD: PhotoRecord = {
  id: '55555555-5555-4555-8555-555555555555',
  reportId: '22222222-2222-4222-8222-222222222222',
  storageKey: 'reports/22222222-2222-4222-8222-222222222222/abc.jpg',
  contentType: 'image/jpeg',
  sizeBytes: 2048,
  widthPx: 800,
  heightPx: 600,
  capturedAt: new Date('2026-08-13T10:00:00.000Z'),
};

const READ_URL = 'https://depolama.test/reports/abc.jpg?imza=sahte';

describe('toPhotoDto', () => {
  it('sozlesmedeki Photo alanlarini doldurur ve damgayi ISO 8601 metnine cevirir', () => {
    expect(toPhotoDto(RECORD, READ_URL)).toEqual({
      id: RECORD.id,
      reportId: RECORD.reportId,
      capturedAt: '2026-08-13T10:00:00.000Z',
      contentType: 'image/jpeg',
      sizeBytes: 2048,
      widthPx: 800,
      heightPx: 600,
      url: READ_URL,
    });
  });

  it('depolama anahtarini yanit govdesine SIZDIRMAZ (CLAUDE.md §3.5)', () => {
    const dto = toPhotoDto(RECORD, READ_URL);

    expect(Object.keys(dto).sort()).toEqual([
      'capturedAt',
      'contentType',
      'heightPx',
      'id',
      'reportId',
      'sizeBytes',
      'url',
      'widthPx',
    ]);
    expect(JSON.stringify(dto)).not.toContain('storageKey');
  });
});
