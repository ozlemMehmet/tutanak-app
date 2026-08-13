import { Injectable } from '@nestjs/common';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error';
import { PhotosService } from '../photos/photos.service';
import type { CreateReportDto } from './dto/create-report.dto';
import type { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE } from './dto/list-reports-query.dto';
import type { ReportDetailDto, ReportDto, ReportListDto } from './dto/report.dto';
import { toReportDetailDto, toReportDto, toReportListDto } from './mappers/report.mapper';
import type { ReportRecord } from './reports.repository';
import { ReportsRepository } from './reports.repository';

/** Sozlesmedeki `note` varsayilani (CreateReportRequest.note: default ''). */
const DEFAULT_NOTE = '';

@Injectable()
export class ReportsService {
  constructor(
    private readonly reportsRepository: ReportsRepository,
    private readonly photosService: PhotosService,
  ) {}

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

  /**
   * Oturum sahibinin kendi tutanaklarini sayfali olarak listeler; arama terimi verilirse
   * baslik/notta filtreler. Sahiplik YALNIZCA token'daki kimlikten gelir — istemci baska
   * bir kullanicinin listesini isteyemez. Eslesme olmamasi hata degildir: bos liste doner.
   */
  async listReports(ownerId: string, query: ListReportsQueryDto): Promise<ReportListDto> {
    const page = query.page ?? DEFAULT_PAGE;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;

    const { records, total } = await this.reportsRepository.findManyByOwner({
      ownerId,
      searchTerm: query.q,
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return toReportListDto(records, { page, pageSize, total });
  }

  /**
   * Oturum sahibinin kendi tutanagini doner; sahiplik kurali is mantigindadir (§3.8).
   * Fotograf listesi T-006 ile doldurulur: sahiplik burada dogrulandigi icin fotograflar
   * ikinci bir sahiplik sorgusu YAPILMADAN okunur (istek basina iki sorgu).
   */
  async getReport(reportId: string, userId: string): Promise<ReportDetailDto> {
    const report = await this.assertOwnership(reportId, userId);
    const photos = await this.photosService.listOwnedPhotos(reportId);
    return toReportDetailDto(report, photos);
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
