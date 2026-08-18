// Kimlik formlarinin (LoginPage/RegisterPage) hata zarfini ekran durumuna ceviren SAF
// fonksiyon. Iki ekran ayni cozumlemeyi paylasir; metin secimi hata KODUNA gore yapilir,
// sunucu mesajina gore DEGIL (CLAUDE.md §4.3).
import { ApiError } from '../../api/client';

/**
 * 401'de hangi alanin hatali oldugu ASLA belirtilmez: "e-posta kayitli degil" ile "sifre
 * yanlis" ayrimi, saldirgana gecerli hesaplari numaralandirma imkani verir (design.md §3
 * LoginPage error durumu — T-015 ile ayni gerekce).
 */
export const INVALID_CREDENTIALS_MESSAGE = 'E-posta veya şifre hatalı';
export const RATE_LIMITED_MESSAGE = 'Çok fazla deneme yaptınız, birazdan tekrar deneyin';

const RATE_LIMITED_STATUS = 429;
const UNAUTHENTICATED_STATUS = 401;

/** Alan adi -> o alanin altinda gosterilecek mesaj. */
export type FieldErrors = Partial<Record<string, string>>;

export interface AuthFormError {
  /** Form-genel banner metni; alan bazli gosterim yeterliyse `null`. */
  banner: string | null;
  fields: FieldErrors;
}

interface AuthFormErrorOptions {
  /** Formda gercekten bulunan alanlar; yalnizca bunlara hata baglanabilir. */
  knownFields: readonly string[];
  /** API hatasi olmayan durumlar (ag kesintisi) icin gosterilecek metin. */
  fallbackMessage: string;
}

const EMPTY_ERROR: AuthFormError = { banner: null, fields: {} };

export function toAuthFormError(error: unknown, options: AuthFormErrorOptions): AuthFormError {
  if (error === null || error === undefined) {
    return EMPTY_ERROR;
  }
  if (!(error instanceof ApiError)) {
    return { banner: options.fallbackMessage, fields: {} };
  }
  if (error.code === 'INVALID_CREDENTIALS' || error.status === UNAUTHENTICATED_STATUS) {
    return { banner: INVALID_CREDENTIALS_MESSAGE, fields: {} };
  }
  if (error.code === 'RATE_LIMIT_EXCEEDED' || error.status === RATE_LIMITED_STATUS) {
    return { banner: RATE_LIMITED_MESSAGE, fields: {} };
  }

  // `details[]` yalnizca VALIDATION_ERROR ve EMAIL_ALREADY_REGISTERED yanitlarinda dolar
  // (CLAUDE.md §4.2.3); alan bazli baglama tek yerde, alan adina bakilarak yapilir.
  const fields: FieldErrors = {};
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
