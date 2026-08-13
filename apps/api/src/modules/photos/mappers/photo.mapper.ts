// Entity -> DTO donusumu (CLAUDE.md §3.5): `storage_key` gibi ic alanlarin yanit
// govdesine sizmasi yapisal olarak burada engellenir.

import type { PhotoDto } from '../dto/photo.dto';
import type { PhotoRecord } from '../photos.repository';

export function toPhotoDto(photo: PhotoRecord, url: string): PhotoDto {
  return {
    id: photo.id,
    reportId: photo.reportId,
    capturedAt: photo.capturedAt.toISOString(),
    contentType: photo.contentType,
    sizeBytes: photo.sizeBytes,
    widthPx: photo.widthPx,
    heightPx: photo.heightPx,
    url,
  };
}
