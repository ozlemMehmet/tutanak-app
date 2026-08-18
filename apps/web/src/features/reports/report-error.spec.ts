// Taslak olusturma hatalarinin ekran durumuna cevrimi (T-019 kriter 6 ve 7).
import { ApiError } from '../../api/client';
import {
  DRAFT_FALLBACK_MESSAGE,
  isTemplateInvalidError,
  TEMPLATE_NOT_FOUND_MESSAGE,
  toReportFormError,
} from './report-error';

const KNOWN_FIELDS = ['title', 'note'] as const;
const OPTIONS = { knownFields: KNOWN_FIELDS, fallbackMessage: DRAFT_FALLBACK_MESSAGE };

describe('toReportFormError', () => {
  it('hata yokken banner ve alan hatasi uretmez', () => {
    expect(toReportFormError(null, OPTIONS)).toEqual({ banner: null, fields: {} });
    expect(toReportFormError(undefined, OPTIONS)).toEqual({ banner: null, fields: {} });
  });

  it('API hatasi olmayan durumda (ag kesintisi) genel banner metnini doner', () => {
    const result = toReportFormError(new Error('network down'), OPTIONS);

    expect(result).toEqual({ banner: DRAFT_FALLBACK_MESSAGE, fields: {} });
  });

  it('400 VALIDATION_ERROR detayini ilgili alana baglar', () => {
    const result = toReportFormError(
      new ApiError('VALIDATION_ERROR', 'Girdi doğrulanamadı.', 400, [
        { field: 'title', message: 'başlık zorunludur' },
      ]),
      OPTIONS,
    );

    expect(result).toEqual({ banner: null, fields: { title: 'başlık zorunludur' } });
  });

  it('formda karsiligi olmayan alan detayini banner"a dusurur', () => {
    const result = toReportFormError(
      new ApiError('VALIDATION_ERROR', 'Girdi doğrulanamadı.', 400, [
        { field: 'templateId', message: 'gecerli bir sablon seciniz' },
      ]),
      OPTIONS,
    );

    expect(result).toEqual({ banner: 'Girdi doğrulanamadı.', fields: {} });
  });

  it('404 TEMPLATE_NOT_FOUND icin sabit sablon banner metnini doner', () => {
    const result = toReportFormError(
      new ApiError('TEMPLATE_NOT_FOUND', 'Sablon bulunamadi.', 404),
      OPTIONS,
    );

    expect(result).toEqual({ banner: TEMPLATE_NOT_FOUND_MESSAGE, fields: {} });
  });

  it('detaysiz diger API hatalarinda sunucu mesajini banner"a koyar', () => {
    const result = toReportFormError(
      new ApiError('INTERNAL_ERROR', 'Sunucu hatasi.', 500),
      OPTIONS,
    );

    expect(result).toEqual({ banner: 'Sunucu hatasi.', fields: {} });
  });
});

describe('isTemplateInvalidError', () => {
  it('TEMPLATE_NOT_FOUND kodunda true doner', () => {
    expect(isTemplateInvalidError(new ApiError('TEMPLATE_NOT_FOUND', 'yok', 404))).toBe(true);
  });

  it('diger hata kodlarinda ve API disi hatalarda false doner', () => {
    expect(isTemplateInvalidError(new ApiError('NOT_FOUND', 'yok', 404))).toBe(false);
    expect(isTemplateInvalidError(new Error('network down'))).toBe(false);
    expect(isTemplateInvalidError(null)).toBe(false);
  });
});
