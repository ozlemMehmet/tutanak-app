// Entity -> DTO donusumu (CLAUDE.md §3.5): yanit govdesi YALNIZCA burada kurulur,
// boylece owner_id gibi ic alanlarin sizmasi yapisal olarak engellenir.

import type { PhotoDto } from '../../photos/dto/photo.dto';
import type { ReportDetailDto, ReportDto, ReportListDto } from '../dto/report.dto';
import type { ReportRecord } from '../reports.repository';

/** Sozlesmedeki ReportListResponse'un sayfalama alanlari. */
interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

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

export function toReportListDto(reports: ReportRecord[], pagination: Pagination): ReportListDto {
  return {
    items: reports.map(toReportDto),
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
  };
}

export function toReportDetailDto(report: ReportRecord, photos: PhotoDto[]): ReportDetailDto {
  return { ...toReportDto(report), photos };
}
