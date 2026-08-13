// Dis sistem siniri: obje depolama (CLAUDE.md §7 Adapter + Port). Modul kodu yalnizca
// bu arayuzu bilir; R2/MinIO/S3 tipleri `modules/*` icine SIZMAZ.

/** Depoya yazilacak obje; anahtar sunucuda uretilir (kullanici dosya adi KULLANILMAZ). */
export interface StorageObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
}

export interface StoragePort {
  /** Objeyi yazar; depolama erisilemezse ExternalServiceError(STORAGE_UNAVAILABLE) firlatir (§4.2.1). */
  putObject(input: StorageObjectInput): Promise<void>;
  /** Kisa omurlu (PRESIGNED_URL_TTL_SECONDS) on-imzali okuma URL'si uretir. */
  createReadUrl(key: string): Promise<string>;
}

/**
 * Arayuz calisma zamaninda var olmadigi icin DI token'i ayrica tanimlanir;
 * saglayici secimi `storage.module.ts` icindedir.
 */
export const STORAGE_PORT = 'StoragePort';
