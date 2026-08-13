// POST /reports (taslak olusturma, T-005), GET /reports (listeleme + arama, T-011) ve
// GET /reports/{reportId} (kendi tutanagini getirme, T-005) — api-contract.yaml.
// Endpoint'lerin tamami global JwtAuthGuard altindadir; @Public() KONULMAZ
// (sozlesme: 401 tanimli).

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import type { ReportDetailDto, ReportDto, ReportListDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

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
}
