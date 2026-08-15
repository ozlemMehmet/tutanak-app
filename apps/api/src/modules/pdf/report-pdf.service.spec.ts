import sharp from 'sharp';
import { countPdfImages, extractPdfText } from '../../../test/pdf-text';
import { ExternalServiceError } from '../../common/errors/app-error';
import { FakeStorageAdapter } from '../../infra/storage/fake-storage.adapter';
import type { StoragePort } from '../../infra/storage/storage.port';
import type { ReportPdfInput } from './report-pdf.service';
import { ReportPdfService } from './report-pdf.service';

const FIRST_KEY = 'reports/22222222-2222-4222-8222-222222222222/birinci.jpg';
const SECOND_KEY = 'reports/22222222-2222-4222-8222-222222222222/ikinci.jpg';
const FIRST_CAPTURED_AT = new Date('2026-08-14T10:45:12.000Z');
const SECOND_CAPTURED_AT = new Date('2026-08-14T11:00:00.000Z');
/** Europe/Istanbul karsiliklari (pdf-timestamp.formatter). */
const FIRST_STAMP = '14.08.2026 13:45:12';
const SECOND_STAMP = '14.08.2026 14:00:00';
const APPROVED_AT = new Date('2026-08-15T06:30:00.000Z');
const APPROVED_AT_STAMP = '15.08.2026 09:30:00';
const APPROVER_EMAIL = 'kiraci@ornek.test';

function photoBytes(): Promise<Buffer> {
  return sharp({
    create: { width: 60, height: 40, channels: 3, background: { r: 10, g: 120, b: 200 } },
  })
    .jpeg()
    .toBuffer();
}

function inputWith(photos: ReportPdfInput['photos']): ReportPdfInput {
  return {
    title: 'Kiraci teslim tutanagi 12A',
    templateName: 'Giris/Cikis Teslim Tutanagi',
    note: 'Salon duvarinda cizik var.',
    photos,
  };
}

async function storageWithPhotos(keys: string[]): Promise<FakeStorageAdapter> {
  const storage = new FakeStorageAdapter();
  const body = await photoBytes();
  for (const key of keys) {
    await storage.putObject({ key, body, contentType: 'image/jpeg' });
  }
  return storage;
}

describe('ReportPdfService.renderReport', () => {
  it('baslik, sablon adi ve notu tasiyan bir PDF uretir', async () => {
    const storage = await storageWithPhotos([FIRST_KEY]);

    const pdf = await new ReportPdfService(storage).renderReport(
      inputWith([{ storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT }]),
    );

    const text = extractPdfText(pdf);
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(text).toContain('Kiraci teslim tutanagi 12A');
    expect(text).toContain('Giris/Cikis Teslim Tutanagi');
    expect(text).toContain('Salon duvarinda cizik var.');
  });

  it('her fotografi depodan okuyup damgasiyla birlikte gomer', async () => {
    const storage = await storageWithPhotos([FIRST_KEY, SECOND_KEY]);

    const pdf = await new ReportPdfService(storage).renderReport(
      inputWith([
        { storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT },
        { storageKey: SECOND_KEY, capturedAt: SECOND_CAPTURED_AT },
      ]),
    );

    expect(countPdfImages(pdf)).toBe(2);
    const text = extractPdfText(pdf);
    expect(text).toContain(FIRST_STAMP);
    expect(text).toContain(SECOND_STAMP);
  });

  it('fotograflari verilen sirayla ekler (sira PDF icinde korunur)', async () => {
    const storage = await storageWithPhotos([FIRST_KEY, SECOND_KEY]);

    const pdf = await new ReportPdfService(storage).renderReport(
      inputWith([
        { storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT },
        { storageKey: SECOND_KEY, capturedAt: SECOND_CAPTURED_AT },
      ]),
    );

    const text = extractPdfText(pdf);
    expect(text.indexOf(FIRST_STAMP)).toBeLessThan(text.indexOf(SECOND_STAMP));
  });

  it('depolama okumasi basarisizsa ExternalServiceError yayilir ve yarim PDF URETILMEZ', async () => {
    const getObject = jest
      .fn()
      .mockRejectedValue(new ExternalServiceError('STORAGE_UNAVAILABLE', 'Depoya erisilemiyor.'));
    const storage: StoragePort = {
      putObject: jest.fn(),
      createReadUrl: jest.fn(),
      getObject,
    };

    const uretim = new ReportPdfService(storage).renderReport(
      inputWith([{ storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT }]),
    );

    await expect(uretim).rejects.toBeInstanceOf(ExternalServiceError);
    await expect(uretim).rejects.toMatchObject({ code: 'STORAGE_UNAVAILABLE', httpStatus: 502 });
  });

  it('onaylanmis tutanakta onaylayanin e-postasini ve onay damgasini PDF`e isler (kriter 5)', async () => {
    const storage = await storageWithPhotos([FIRST_KEY]);

    const pdf = await new ReportPdfService(storage).renderReport({
      ...inputWith([{ storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT }]),
      approval: { approverEmail: APPROVER_EMAIL, approvedAt: APPROVED_AT },
    });

    const text = extractPdfText(pdf);
    expect(text).toContain(APPROVER_EMAIL);
    expect(text).toContain(APPROVED_AT_STAMP);
  });

  it('onaylanmamis tutanakta onay blogu HIC yazilmaz', async () => {
    const storage = await storageWithPhotos([FIRST_KEY]);

    const pdf = await new ReportPdfService(storage).renderReport(
      inputWith([{ storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT }]),
    );

    expect(extractPdfText(pdf)).not.toContain('Onaylayan');
  });

  it('fotograf icerigini yalnizca depolama anahtariyla okur (istemci verisi kullanilmaz)', async () => {
    const storage = await storageWithPhotos([FIRST_KEY]);
    const getObject = jest.spyOn(storage, 'getObject');

    await new ReportPdfService(storage).renderReport(
      inputWith([{ storageKey: FIRST_KEY, capturedAt: FIRST_CAPTURED_AT }]),
    );

    expect(getObject).toHaveBeenCalledWith(FIRST_KEY);
  });
});
