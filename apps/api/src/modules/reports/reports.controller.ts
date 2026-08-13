// POST /reports (taslak olusturma) ve GET /reports/{reportId} (kendi tutanagini getirme)
// — api-contract.yaml: T-005. Her iki endpoint de global JwtAuthGuard altindadir;
// @Public() KONULMAZ (sozlesme: 401 tanimli).

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import type { ReportDetailDto, ReportDto } from './dto/report.dto';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateReportDto): Promise<ReportDto> {
    return this.reportsService.createDraft(user.userId, dto);
  }

  @Get(':reportId')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('reportId') reportId: string,
  ): Promise<ReportDetailDto> {
    return this.reportsService.getReport(reportId, user.userId);
  }
}
