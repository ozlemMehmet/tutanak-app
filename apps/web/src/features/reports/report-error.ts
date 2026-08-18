// Taslak olusturma hatasini ekran durumuna ceviren SAF fonksiyon. Metin secimi hata KODUNA
// gore yapilir, sunucu mesajina gore DEGIL (CLAUDE.md §4.3).
import { ApiError } from '../../api/client';

/** design.md §3 ReportCreatePage error durumu: metin birebir sartnameden gelir. */
export const TEMPLATE_NOT_FOUND_MESSAGE = 'Seçilen şablon artık geçerli değil, sayfayı yenileyin';
export const DRAFT_FALLBACK_MESSAGE = 'Taslak oluşturulamadı, birazdan tekrar deneyin';

const TEMPLATE_NOT_FOUND_CODE = 'TEMPLATE_NOT_FOUND';

export interface ReportFormError {
  /** Form-genel banner metni; alan bazli gosterim yeterliyse `null`. */
  banner: string | null;
  fields: Partial<Record<string, string>>;
}

interface ReportFormErrorOptions {
  /** Formda gercekten bulunan alanlar; yalnizca bunlara hata baglanabilir. */
  knownFields: readonly string[];
  /** API hatasi olmayan durumlar (ag kesintisi) icin gosterilecek metin. */
  fallbackMessage: string;
}

const EMPTY_ERROR: ReportFormError = { banner: null, fields: {} };

/** Sablon secimi sunucu tarafinda gecersizlesti mi (liste yeniden cekilmeli, kriter 7). */
export function isTemplateInvalidError(error: unknown): boolean {
  return error instanceof ApiError && error.code === TEMPLATE_NOT_FOUND_CODE;
}

export function toReportFormError(
  error: unknown,
  options: ReportFormErrorOptions,
): ReportFormError {
  if (error === null || error === undefined) {
    return EMPTY_ERROR;
  }
  if (!(error instanceof ApiError)) {
    return { banner: options.fallbackMessage, fields: {} };
  }
  if (isTemplateInvalidError(error)) {
    return { banner: TEMPLATE_NOT_FOUND_MESSAGE, fields: {} };
  }

  // `details[]` yalnizca VALIDATION_ERROR yanitlarinda dolar (CLAUDE.md §4.2.3); alan bazli
  // baglama tek yerde, alan adina bakilarak yapilir.
  const fields: Partial<Record<string, string>> = {};
  for (const detail of error.details ?? []) {
    if (options.knownFields.includes(detail.field)) {
      fields[detail.field] = detail.message;
    }
  }

  // Formda karsiligi olmayan alan detayi sessizce yutulmaz: mesaj banner'a duser.
  return Object.keys(fields).length > 0
    ? { banner: null, fields }
    : { banner: error.message, fields: {} };
}
