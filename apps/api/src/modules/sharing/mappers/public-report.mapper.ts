// Entity -> DTO donusumu (CLAUDE.md §3.5, §7 Mapper): oturumsuz gorunumun yanit govdesi
// YALNIZCA burada kurulur. Kiraci kimlik dogrulamasi yapmadigi icin bu sinir ozellikle
// kritiktir: `ownerId`, `reportId`, `storageKey` ve paylasim token'i govdeye GIRMEZ.

import { toApprovalDto } from '../../approvals/mappers/approval.mapper';
import type { PhotoDto } from '../../photos/dto/photo.dto';
import type { PublicPhotoDto, PublicReportViewDto } from '../dto/public-report.dto';
import type { PublicReportRecord } from '../sharing.repository';

/**
 * Sozlesmedeki PublicReportView.disclaimer metni (api-contract.yaml ornegi ile birebir).
 * Metin sabittir: kullaniciya/ortama gore degismez, bu yuzden yapilandirma degildir (§5.1).
 */
export const PUBLIC_REPORT_DISCLAIMER =
  'Bu tutanak resmi hukuki delil değildir, destekleyici kanıttır.';

function toPublicPhotoDto(photo: PhotoDto): PublicPhotoDto {
  return { id: photo.id, capturedAt: photo.capturedAt, url: photo.url };
}

/**
 * Fotograflarin sirasi kaynak sorgudan gelir ((sort_order, captured_at) — §3.14) ve
 * burada DEGISTIRILMEZ. Onay yoksa `approval` alani govdeye hic konulmaz (§3.5).
 */
export function toPublicReportViewDto(
  report: PublicReportRecord,
  photos: PhotoDto[],
): PublicReportViewDto {
  return {
    title: report.title,
    templateName: report.templateName,
    note: report.note,
    photos: photos.map(toPublicPhotoDto),
    status: report.status,
    createdAt: report.createdAt.toISOString(),
    isApproved: report.status === 'approved',
    ...(report.approval === null ? {} : { approval: toApprovalDto(report.approval) }),
    disclaimer: PUBLIC_REPORT_DISCLAIMER,
  };
}
