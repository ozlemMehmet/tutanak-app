// Entity -> DTO donusumu (CLAUDE.md §3.5): yanit govdesi YALNIZCA burada kurulur,
// boylece owner_id gibi ic alanlarin sizmasi yapisal olarak engellenir.

import type { ReportDetailDto, ReportDto } from '../dto/report.dto';
import type { ReportRecord } from '../reports.repository';

export function toReportDto(report: ReportRecord): ReportDto {
  return {
    id: report.id,
    templateId: report.templateId,
    templateName: report.templateName,
    title: report.title,
    note: report.note,
    status: report.status,
    photoCount: report.photoCount,
    createdAt: report.createdAt.toISOString(),
    updatedAt: report.updatedAt.toISOString(),
  };
}

export function toReportDetailDto(report: ReportRecord): ReportDetailDto {
  // Fotograf listesi T-006'da dolar; bu ticket'ta fotograf satiri olusturan kod yolu yok.
  return { ...toReportDto(report), photos: [] };
}
