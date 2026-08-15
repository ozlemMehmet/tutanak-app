// Entity -> DTO donusumu (CLAUDE.md §3.5, §7 Mapper — saf fonksiyon): onay yanitinin
// govdesi YALNIZCA burada kurulur, boylece `reportId`/`shareLinkId`/`ipAddress` gibi ic
// alanlarin sizmasi yapisal olarak engellenir.

import type { ApprovalDto } from '../dto/approval.dto';

/**
 * Onay kaydinin sinir sekli. Yapisal olarak tanimlidir: onayi okuyan her modul (approvals,
 * sharing, reports) kendi depo kaydini bu sekle uydurur ve tek bir donusum kullanir.
 */
export interface ApprovalSource {
  id: string;
  approverEmail: string;
  approvedAt: Date;
}

export function toApprovalDto(approval: ApprovalSource): ApprovalDto {
  return {
    id: approval.id,
    approverEmail: approval.approverEmail,
    approvedAt: approval.approvedAt.toISOString(),
  };
}
