import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ReportDetailDto, ReportDto } from './dto/report.dto';
import { toReportDetailDto, toReportDto } from './mappers/report.mapper';
import type { ReportRecord } from './reports.repository';
import { ReportsRepository } from './reports.repository';

/** Sozlesmedeki `note` varsayilani (CreateReportRequest.note: default ''). */
const DEFAULT_NOTE = '';

@Injectable()
export class ReportsService {
  constructor(private readonly reportsRepository: ReportsRepository) {}

  /**
   * Yeni tutanak taslagi olusturur. Sahiplik YALNIZCA oturum kullanicisindan gelir;
   * durum DDL varsayilani ile `draft` baslar (CLAUDE.md §3.10 — durumu belirleyen bir
   * girdi alani yoktur).
   */
  async createDraft(ownerId: string, input: CreateReportDto): Promise<ReportDto> {
    const report = await this.reportsRepository.createDraft({
      ownerId,
      templateId: input.templateId,
      title: input.title,
      note: input.note ?? DEFAULT_NOTE,
    });

    if (report === null) {
      throw new NotFoundError('TEMPLATE_NOT_FOUND', 'Secilen sablon bulunamadi.');
    }
    return toReportDto(report);
  }

  /** Oturum sahibinin kendi tutanagini doner; sahiplik kurali is mantigindadir (§3.8). */
  async getReport(reportId: string, userId: string): Promise<ReportDetailDto> {
    const report = await this.assertOwnership(reportId, userId);
    return toReportDetailDto(report);
  }

  /**
   * Kaynak erisim kurali (CLAUDE.md §3.8, §7 Guard Clause): kayit yoksa NotFoundError,
   * baskasina aitse ForbiddenError. Bulunan kaydi doner ki cagiran metod ayni satiri
   * ikinci kez sorgulamak zorunda kalmasin (istek basina tek gidis-donus).
   */
  private async assertOwnership(reportId: string, userId: string): Promise<ReportRecord> {
    const report = await this.reportsRepository.findById(reportId);
    if (report === null) {
      throw new NotFoundError('NOT_FOUND', 'Tutanak bulunamadi.');
    }
    if (report.ownerId !== userId) {
      throw new ForbiddenError('Bu tutanaga erisim yetkiniz yok.');
    }
    return report;
  }
}
