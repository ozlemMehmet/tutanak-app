// Yanit tipleri — api-contract.yaml → Report, ReportDetail ve ReportListResponse ile birebir.

import type { PhotoDto } from '../../photos/dto/photo.dto';

/** Sozlesmedeki ReportStatus enum'u; tek yonlu yasam dongusu (CLAUDE.md §3.10). */
export type ReportStatusDto = 'draft' | 'shared' | 'approved';

export interface ReportDto {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  note: string;
  status: ReportStatusDto;
  /** Her yanitta veritabaninda hesaplanir (liste ekrani icin). */
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Sozlesmedeki ReportListResponse: sayfalanmis liste (T-011). */
export interface ReportListDto {
  /** created_at azalan sirada, YALNIZCA oturum sahibinin kayitlari. */
  items: ReportDto[];
  page: number;
  pageSize: number;
  /** Sayfalamadan bagimsiz, filtreye uyan toplam kayit sayisi. */
  total: number;
}

export interface ReportDetailDto extends ReportDto {
  /**
   * Sozlesmedeki ReportDetail.photos dizisi; her eleman kendi sunucu damgasini ve
   * kisa omurlu on-imzali okuma URL'sini tasir (T-006). Sira (sort_order, captured_at)
   * ikilisine gore sabittir (CLAUDE.md §3.14).
   */
  photos: PhotoDto[];
}
