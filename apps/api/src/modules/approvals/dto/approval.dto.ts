// Yanit tipi — api-contract.yaml → Approval ile birebir. Onay sozlesmesinin sahibi bu
// moduldur; goruntuleme (PublicReportView.approval) ve tutanak detayi
// (ReportDetail.approval) ayni tipi buradan tuketir (photos → PhotoDto ile ayni desen).

export interface ApprovalDto {
  id: string;
  approverEmail: string;
  /** Sunucu tarafinda uretilen, degistirilemez onay damgasi (CLAUDE.md §3.7). */
  approvedAt: string;
}
