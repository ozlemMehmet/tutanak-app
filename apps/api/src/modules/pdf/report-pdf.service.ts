// T-007 — tutanagin PDF ciktisini uretir. Servis HTTP'yi bilmez (CLAUDE.md §3.2): domain
// girdisi alir, belgenin baytlarini doner. Sahiplik ve "fotografsiz tutanak" kurallari
// CAGIRANDA (ReportsService) uygulanir; bu servis yalnizca uretimden sorumludur.

import { Inject, Injectable } from '@nestjs/common';
import type { StoragePort } from '../../infra/storage/storage.port';
import { STORAGE_PORT } from '../../infra/storage/storage.port';
import { shrinkPhotoForPdf } from './pdf-photo.processor';
import type { ReportPdfApprovalSection } from './report-pdf.builder';
import { ReportPdfBuilder } from './report-pdf.builder';

/** PDF'e girecek fotografin kaynagi; icerik depodan SUNUCUDA okunur. */
export interface ReportPdfPhoto {
  storageKey: string;
  capturedAt: Date;
}

export interface ReportPdfInput {
  title: string;
  templateName: string;
  note: string;
  /** Sira cagiran tarafindan (sort_order, captured_at) ile belirlenir — CLAUDE.md §3.14. */
  photos: ReportPdfPhoto[];
  /**
   * Karsi tarafin onayi (T-010). Onay yoksa alan HIC verilmez ve belgede onay blogu
   * olusmaz; damga veritabanindan gelir, burada uretilmez (§3.7).
   */
  approval?: ReportPdfApprovalSection;
}

@Injectable()
export class ReportPdfService {
  constructor(@Inject(STORAGE_PORT) private readonly storage: StoragePort) {}

  /**
   * Belgeyi bastan sona uretir ve tam baytlarini doner.
   *
   * Fotograflar SIRAYLA okunup islenir: eleman sayisi PHOTO_MAX_PER_REPORT ile ustten
   * sinirlidir (bilinmeyen buyuklukte bir kume degildir) ve paralel okuma, ayni anda
   * gelen isteklerde bellekte ayni anda tutulan ham fotograf sayisini tutanak basina
   * 1'den 30'a cikarirdi — 4 GB'lik tek sunucuda (architecture.md §6) bu bilincli olarak
   * reddedildi. Depolama okumasi basarisizsa hata (502 STORAGE_UNAVAILABLE) yukari
   * yayilir ve yarim belge URETILMEZ (CLAUDE.md §4.2.1).
   */
  async renderReport(input: ReportPdfInput): Promise<Buffer> {
    const builder = new ReportPdfBuilder()
      .addTitle(input.title)
      .addTemplateName(input.templateName)
      .addNote(input.note);

    for (const photo of input.photos) {
      const stored = await this.storage.getObject(photo.storageKey);
      builder.addPhoto({ image: await shrinkPhotoForPdf(stored), capturedAt: photo.capturedAt });
    }

    if (input.approval !== undefined) {
      builder.addApproval(input.approval);
    }

    return builder.build();
  }
}
