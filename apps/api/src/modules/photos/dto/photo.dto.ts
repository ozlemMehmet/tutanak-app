// Yanit tipi — api-contract.yaml → Photo semasi ile birebir.

/** Sozlesmedeki Photo.contentType enum'u; DDL `report_photos_content_type_allowed` ile ayni. */
export type PhotoContentTypeDto = 'image/jpeg' | 'image/png' | 'image/webp';

export interface PhotoDto {
  id: string;
  reportId: string;
  /** Sunucu tarafinda uretilen, degistirilemez tarih-saat damgasi (T-006, CLAUDE.md §3.7). */
  capturedAt: string;
  contentType: PhotoContentTypeDto;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  /** Obje depolamadan uretilmis, kisa omurlu on-imzali okuma URL'si. */
  url: string;
}
