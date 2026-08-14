// Paylasim is mantigi (T-008). Servis HTTP'yi bilmez (CLAUDE.md §3.2); durum kodlari
// AppError alt siniflarindan gelir (§4.2). Tek kural §3.10: linkin varligi durumu belirler —
// link uretimi `draft` -> `shared` gecisini AYNI transaction icinde yapar (repository),
// e-posta endpoint'i link URETMEZ ve durumu DEGISTIRMEZ.

import { Inject, Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import type { SharingConfig } from '../../config/config.tokens';
import { SHARING_CONFIG } from '../../config/config.tokens';
import type { EmailPort } from '../../infra/email/email.port';
import { EMAIL_PORT } from '../../infra/email/email.port';
import type { ShareDeliveryDto, ShareLinkDto } from './dto/share-link.dto';
import { buildShareUrl, toShareDeliveryDto, toShareLinkDto } from './mappers/share-link.mapper';
import { generateShareToken } from './share-token.generator';
import type { ReportAccessRecord } from './sharing.repository';
import { SharingRepository } from './sharing.repository';

const SHARE_LINK_MISSING_MESSAGE =
  'Bu tutanak icin henuz paylasim linki uretilmedi; once paylasim linki olusturun.';
const SHARE_EMAIL_SUBJECT = 'Emlak teslim tutanagi: goruntuleme ve onay baglantisi';

function buildShareEmailText(shareUrl: string): string {
  return [
    'Merhaba,',
    '',
    'Size bir emlak teslim tutanagi paylasildi. Tutanagi goruntulemek ve onaylamak icin:',
    shareUrl,
    '',
    'Bu baglanti icin kullanici hesabi gerekmez.',
  ].join('\n');
}

@Injectable()
export class ShareLinkService {
  constructor(
    private readonly sharingRepository: SharingRepository,
    @Inject(EMAIL_PORT) private readonly email: EmailPort,
    @Inject(SHARING_CONFIG) private readonly config: SharingConfig,
  ) {}

  /**
   * Paylasim linkini uretir; ayni tutanak icin ikinci cagri AYNI linki doner (kriter 3).
   * Aday token her cagrida uretilir; kalicilik karari DB unique kisitindadir (§7).
   */
  async issueShareLink(reportId: string, userId: string): Promise<ShareLinkDto> {
    await this.assertOwnership(reportId, userId);
    const link = await this.sharingRepository.getOrCreateShareLink(reportId, generateShareToken());
    return toShareLinkDto(link, this.config.publicAppUrl);
  }

  async getShareLink(reportId: string, userId: string): Promise<ShareLinkDto> {
    await this.assertOwnership(reportId, userId);
    const link = await this.sharingRepository.findByReport(reportId);
    if (link === null) {
      throw new NotFoundError('SHARE_LINK_NOT_FOUND', SHARE_LINK_MISSING_MESSAGE);
    }
    return toShareLinkDto(link, this.config.publicAppUrl);
  }

  /**
   * Paylasim linkini e-posta ile gonderir (kriter 4). ON KOSUL: link zaten var olmali —
   * bu metod link URETMEZ (§3.10; get-or-create yapilsaydi `draft` tutanak icin gecerli
   * genel link dogardi). Saglayici hatasi ISTISNA DEGILDIR (§4.2.2): sonuc `failed`
   * teslim kaydi olarak yazilir ve yanitta belirtilir.
   */
  async sendShareEmail(
    reportId: string,
    userId: string,
    recipientEmail: string,
  ): Promise<ShareDeliveryDto> {
    await this.assertOwnership(reportId, userId);
    const link = await this.sharingRepository.findByReport(reportId);
    if (link === null) {
      throw new NotFoundError('SHARE_LINK_NOT_FOUND', SHARE_LINK_MISSING_MESSAGE);
    }

    const result = await this.email.sendEmail({
      to: recipientEmail,
      subject: SHARE_EMAIL_SUBJECT,
      text: buildShareEmailText(buildShareUrl(this.config.publicAppUrl, link.token)),
    });
    const delivery = await this.sharingRepository.createDelivery({
      shareLinkId: link.id,
      recipientEmail,
      status: result.status,
      providerMessageId: result.status === 'sent' ? result.providerMessageId : null,
      errorMessage: result.status === 'failed' ? result.errorMessage : null,
    });
    return toShareDeliveryDto(delivery);
  }

  /** Kaynak erisim kurali (CLAUDE.md §3.8, §7 Guard Clause) — her metodun ilk isi. */
  private async assertOwnership(reportId: string, userId: string): Promise<ReportAccessRecord> {
    const report = await this.sharingRepository.findReportForAccess(reportId);
    if (report === null) {
      throw new NotFoundError('NOT_FOUND', 'Tutanak bulunamadi.');
    }
    if (report.ownerId !== userId) {
      throw new ForbiddenError('Bu tutanaga erisim yetkiniz yok.');
    }
    return report;
  }
}
