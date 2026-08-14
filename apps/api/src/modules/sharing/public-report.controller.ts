// GET /public/reports/{shareToken} — api-contract: T-009 (tag: public, security: []).
// Controller yalnizca HTTP baglama + servis cagirma yapar (CLAUDE.md §3.1).
//
// SALT-OKUNUR (kriter 3): bu sinifta yazma metodu (POST/PUT/PATCH/DELETE) TANIMLANMAZ;
// tek tikla onay (POST .../approval) T-010 kapsamindadir.

import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../../common/decorators/public.decorator';
import type { PublicReportViewDto } from './dto/public-report.dto';
import { PublicReportService } from './public-report.service';

@Controller('public/reports/:shareToken')
export class PublicReportController {
  constructor(private readonly publicReportService: PublicReportService) {}

  /**
   * Kimlik dogrulamasi GEREKTIRMEZ (kriter 4): global JwtAuthGuard @Public() ile atlanir,
   * boylece kiraci hesap acmadan/oturum acmadan tutanagi goruntuler. Token bir yol
   * parametresidir ve DTO dogrulamasindan gecmez: gecersiz her deger 400 degil, 404'tur
   * (sozlesme bu endpoint icin 400 tanimlamaz).
   */
  @Public()
  @Get()
  view(@Param('shareToken') shareToken: string): Promise<PublicReportViewDto> {
    return this.publicReportService.viewByShareToken(shareToken);
  }
}
