// Yukleme hatalarinin kullaniciya gosterilen karsiliklari. Metinler design.md →
// "ReportDetailPage → Durumlar → error (fotograf yukleme)" bolumunden birebir alinmistir;
// dallanma HATA KODU uzerinden yapilir, mesaj metnine gore degil (CLAUDE.md §4.3).
import { ApiError } from '../../api/client';

const RETRY_MESSAGE = 'Yükleme başarısız, tekrar deneyin';

const MESSAGE_BY_CODE: Record<string, string> = {
  UNSUPPORTED_MEDIA_FORMAT: 'Desteklenmeyen dosya türü',
  FILE_TOO_LARGE: 'Dosya çok büyük, en fazla 10 MB',
  STORAGE_UNAVAILABLE: RETRY_MESSAGE,
};

export function photoUploadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return RETRY_MESSAGE;
  }
  // Ust sinir mesaji sunucudan gelir: esik yapilandirmadir (PHOTO_MAX_PER_REPORT),
  // istemciye gomulmez (CLAUDE.md §5.1).
  return MESSAGE_BY_CODE[error.code] ?? error.message;
}

/** Ust sinira ulasildiginda kamera girisi proaktif olarak kapatilir (design.md). */
export function isPhotoLimitReached(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'PHOTO_LIMIT_REACHED';
}
