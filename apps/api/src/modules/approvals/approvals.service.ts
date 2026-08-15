// Tek tikla onay is mantigi (T-010). Servis HTTP'yi bilmez (CLAUDE.md §3.2); durum kodlari
// AppError alt siniflarindan gelir (§4.2).
//
// YETKILENDIRME KURALI: bu akista tek anahtar gecerli paylasim token'idir — kiracinin
// hesabi yoktur, bu yuzden `assertOwnership` (§3.8) UYGULANMAZ; onun yerine "token
// cozulemiyorsa kayit yoktur" guard clause'u calisir (§7 Guard Clause) — T-009 ile ayni.

import { Injectable } from '@nestjs/common';
import { ConflictError, NotFoundError } from '../../common/errors/app-error';
import type { ApprovalDto } from './dto/approval.dto';
import { toApprovalDto } from './mappers/approval.mapper';
import { ApprovalsRepository } from './approvals.repository';

const INVALID_LINK_MESSAGE = 'Bu baglanti gecersiz veya artik kullanilmiyor.';
const ALREADY_APPROVED_MESSAGE = 'Bu tutanak zaten onaylanmis; ikinci bir onay kaydedilmez.';

@Injectable()
export class ApprovalsService {
  constructor(private readonly approvalsRepository: ApprovalsRepository) {}

  /**
   * Paylasim token'i ile tutanagi onaylar (kriter 2). Onay; sunucu damgasi + onaylayanin
   * e-posta kimligi ile kaydedilir ve tutanak `approved` durumuna gecer (§3.10 — gecis
   * onay kaydiyla ayni transaction icinde, depo katmaninda).
   *
   * Mukerrer onay (kriter 4) uygulama icinde "once oku sonra yaz" ile DEGIL, DB unique
   * kisitiyla engellenir: depo `null` dondugunde istek 409 ile reddedilir. Istek basina
   * en fazla iki sorgu yapilir; dongu ve sayfalama gerektiren veri yoktur.
   */
  async approveByShareToken(shareToken: string, approverEmail: string): Promise<ApprovalDto> {
    const link = await this.approvalsRepository.findLinkByToken(shareToken);
    if (link === null) {
      throw new NotFoundError('SHARE_LINK_NOT_FOUND', INVALID_LINK_MESSAGE);
    }

    const approval = await this.approvalsRepository.createApproval({
      reportId: link.reportId,
      shareLinkId: link.shareLinkId,
      approverEmail,
    });
    if (approval === null) {
      throw new ConflictError('REPORT_ALREADY_APPROVED', ALREADY_APPROVED_MESSAGE);
    }

    return toApprovalDto(approval);
  }
}
