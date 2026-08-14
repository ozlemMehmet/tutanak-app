// Oturumsuz goruntuleme is mantigi (T-009). Servis HTTP'yi bilmez (CLAUDE.md §3.2);
// durum kodlari AppError alt siniflarindan gelir (§4.2).
//
// YETKILENDIRME KURALI: bu akista tek anahtar gecerli paylasim token'idir — kiracinin
// hesabi yoktur, bu yuzden `assertOwnership` (§3.8) BURADA UYGULANMAZ; onun yerine
// "token cozulemiyorsa kayit yoktur" guard clause'u calisir (§7 Guard Clause).

import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../common/errors/app-error';
import { PhotosService } from '../photos/photos.service';
import type { PublicReportViewDto } from './dto/public-report.dto';
import { toPublicReportViewDto } from './mappers/public-report.mapper';
import { SharingRepository } from './sharing.repository';

const INVALID_LINK_MESSAGE = 'Bu baglanti gecersiz veya artik kullanilmiyor.';

@Injectable()
export class PublicReportService {
  constructor(
    private readonly sharingRepository: SharingRepository,
    private readonly photosService: PhotosService,
  ) {}

  /**
   * Paylasim token'i ile tutanagin SALT-OKUNUR gorunumunu doner (kriter 1). Gecersiz veya
   * var olmayan token 404'tur (kriter 2) — mesaj token'in kendisini icermez (§4.3).
   * Fotograflar, erisim kararindan SONRA okunur: gecersiz token depolamaya hic gitmez.
   * Istek basina iki sorgu (tutanak + fotograflar) yapilir; on-imzali URL uretimi yerel
   * imzalamadir, dongu icinde ag/DB cagrisi yoktur.
   */
  async viewByShareToken(shareToken: string): Promise<PublicReportViewDto> {
    const report = await this.sharingRepository.findReportViewByToken(shareToken);
    if (report === null) {
      throw new NotFoundError('SHARE_LINK_NOT_FOUND', INVALID_LINK_MESSAGE);
    }

    // Erisim karari token ile ZATEN verildi; `listOwnedPhotos` ikinci bir sahiplik
    // sorgusu yapmadan (sort_order, captured_at) sirasinda fotograflari doner (§3.14).
    const photos = await this.photosService.listOwnedPhotos(report.reportId);
    return toPublicReportViewDto(report, photos);
  }
}
