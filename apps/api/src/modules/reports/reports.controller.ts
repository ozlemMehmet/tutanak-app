// POST /reports (taslak olusturma, T-005), GET /reports (listeleme + arama, T-011),
// GET /reports/{reportId} (kendi tutanagini getirme, T-005) ve
// GET /reports/{reportId}/pdf (PDF ciktisi, T-007) — api-contract.yaml.
// Endpoint'lerin tamami global JwtAuthGuard altindadir; @Public() KONULMAZ
// (sozlesme: 401 tanimli).

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import type { ReportDetailDto, ReportDto, ReportListDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

/** Sozlesme: 200 yaniti `application/pdf` + `attachment; filename="tutanak-<id>.pdf"`. */
const PDF_CONTENT_TYPE = 'application/pdf';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto): Promise<ReportDto> {
    return this.reportsService.createDraft(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListReportsQueryDto,
  ): Promise<ReportListDto> {
    return this.reportsService.listReports(user.userId, query);
  }

  @Get(':reportId')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
  ): Promise<ReportDetailDto> {
    return this.reportsService.getReport(reportId, user.userId);
  }

  // Belge TAMAMEN uretildikten sonra tek parca halinde donulur; hata durumunda yarim
  // dosya stream edilmez (CLAUDE.md §4.2.1) ve hata zarfi global filtreden gecer.
  @Get(':reportId/pdf')
  async downloadPdf(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
  ): Promise<StreamableFile> {
    const pdf = await this.reportsService.generatePdf(reportId, user.userId);
    return new StreamableFile(pdf, {
      type: PDF_CONTENT_TYPE,
      disposition: `attachment; filename="tutanak-${reportId}.pdf"`,
    });
  }
}
