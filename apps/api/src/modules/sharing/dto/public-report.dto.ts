// Yanit tipleri — api-contract.yaml → PublicReportView, PublicPhoto ve Approval ile birebir.
// Bu gorunum SALT-OKUNURDUR: hicbir yazma eylemi/endpoint'i tanimlamaz (T-009 kriter 3).

import type { ApprovalDto } from '../../approvals/dto/approval.dto';
import type { ReportStatusDto } from '../../reports/dto/report.dto';

/** Kiraciya gosterilen fotograf: yalnizca kimlik, sunucu damgasi ve kisa omurlu okuma URL'si. */
export interface PublicPhotoDto {
  id: string;
  /** Sunucu tarafinda uretilen, degistirilemez tarih-saat damgasi (CLAUDE.md §3.7). */
  capturedAt: string;
  url: string;
}

export interface PublicReportViewDto {
  title: string;
  templateName: string;
  note: string;
  photos: PublicPhotoDto[];
  status: ReportStatusDto;
  createdAt: string;
  isApproved: boolean;
  /**
   * Onay yokken bu alan yanit govdesine HIC KONULMAZ (`approval: null` gonderilmez);
   * istemci onayin varligini `isApproved` uzerinden anlar (CLAUDE.md §3.5).
   */
  approval?: ApprovalDto;
  /** Onay oncesi gosterilmesi zorunlu uyari metni (sozlesme: PublicReportView.disclaimer). */
  disclaimer: string;
}
