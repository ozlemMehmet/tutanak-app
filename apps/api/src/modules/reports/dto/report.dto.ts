// Yanit tipleri — api-contract.yaml → Report, ReportDetail ve ReportListResponse ile birebir.

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
   * Sozlesmedeki ReportDetail.photos dizisi. Fotograf satiri olusturan kod yolu ve
   * on-imzali URL uretimi T-006 kapsamindadir; bu ticket'ta hicbir `report_photos`
   * satiri olusamayacagi icin dizi her zaman bostur. Eleman tipi (sozlesmedeki `Photo`)
   * T-006'da tanimlanir — simdiden bos bir tip uydurulmaz.
   */
  photos: never[];
}
