import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnprocessableError,
} from '../../common/errors/app-error';
import { PHOTO_MAX_PER_REPORT } from '../../config/config.tokens';
import type { StoragePort } from '../../infra/storage/storage.port';
import { STORAGE_PORT } from '../../infra/storage/storage.port';
import type { PhotoContentTypeDto, PhotoDto } from './dto/photo.dto';
import { toPhotoDto } from './mappers/photo.mapper';
import { detectPhotoContentType, extensionFor } from './photo-format.validator';
import { normalizePhoto } from './photo-image.processor';
import type { PhotoRecord, ReportAccessRecord } from './photos.repository';
import { PhotosRepository } from './photos.repository';

/** Servis HTTP'yi bilmez (CLAUDE.md §3.2): yalnizca dosyanin icerigini alir. */
export interface UploadedPhoto {
  buffer: Buffer;
}

const UNSUPPORTED_MEDIA_MESSAGE = 'Yalnizca JPEG, PNG veya WEBP fotograf yukleyebilirsiniz.';
const APPROVED_REPORT_MESSAGE =
  'Bu tutanak onaylandigi icin icerigi dondurulmustur; yeni fotograf eklenemez.';

@Injectable()
export class PhotosService {
  constructor(
    private readonly photosRepository: PhotosRepository,
    @Inject(STORAGE_PORT) private readonly storage: StoragePort,
    @Inject(PHOTO_MAX_PER_REPORT) private readonly maxPhotosPerReport: number,
  ) {}

  /**
   * Tutanaga fotograf ekler. Damga icin istemciden hicbir tarih degeri OKUNMAZ;
   * `captured_at` veritabaninda `DEFAULT now()` ile uretilir (CLAUDE.md §3.7).
   * Sira: sahiplik -> kanit butunlugu -> ust sinir -> icerik dogrulama -> depolama -> DB
   * (§4.2.1: depolama yazimi basarisizsa satir yazilmaz, yetim kayit olusmaz).
   */
  async addPhoto(reportId: string, userId: string, file: UploadedPhoto): Promise<PhotoDto> {
    const report = await this.assertOwnership(reportId, userId);
    if (report.status === 'approved') {
      throw new ConflictError('REPORT_ALREADY_APPROVED', APPROVED_REPORT_MESSAGE);
    }

    const photoCount = await this.photosRepository.countByReport(reportId);
    if (photoCount >= this.maxPhotosPerReport) {
      throw new ConflictError(
        'PHOTO_LIMIT_REACHED',
        `Bir tutanaga en fazla ${String(this.maxPhotosPerReport)} fotograf eklenebilir.`,
      );
    }

    const contentType = await detectPhotoContentType(file.buffer);
    if (contentType === null) {
      throw new UnprocessableError('UNSUPPORTED_MEDIA_FORMAT', UNSUPPORTED_MEDIA_MESSAGE);
    }

    const normalized = await normalizePhoto(file.buffer, contentType);
    const storageKey = this.buildStorageKey(reportId, contentType);
    await this.storage.putObject({
      key: storageKey,
      body: normalized.body,
      contentType: normalized.contentType,
    });

    const photo = await this.photosRepository.create({
      reportId,
      storageKey,
      contentType: normalized.contentType,
      sizeBytes: normalized.sizeBytes,
      widthPx: normalized.widthPx,
      heightPx: normalized.heightPx,
    });
    return this.withReadUrl(photo);
  }

  /** Tutanagin fotograflarini damgalariyla, (sort_order, captured_at) sirasinda doner. */
  async listPhotos(reportId: string, userId: string): Promise<PhotoDto[]> {
    await this.assertOwnership(reportId, userId);
    return this.listOwnedPhotos(reportId);
  }

  /**
   * Sahipligi ZATEN dogrulanmis bir tutanagin fotograflari (tutanak detayi icin).
   * On-imzali URL uretimi yerel imzalamadir — dongu icinde ag/DB cagrisi YOKTUR ve
   * eleman sayisi PHOTO_MAX_PER_REPORT ile sinirlidir.
   */
  async listOwnedPhotos(reportId: string): Promise<PhotoDto[]> {
    const photos = await this.photosRepository.findByReport(reportId);
    return Promise.all(photos.map((photo) => this.withReadUrl(photo)));
  }

  private async withReadUrl(photo: PhotoRecord): Promise<PhotoDto> {
    const url = await this.storage.createReadUrl(photo.storageKey);
    return toPhotoDto(photo, url);
  }

  /** Depolama anahtari sunucuda uretilir; kullanici dosya adi KULLANILMAZ (architecture.md §7). */
  private buildStorageKey(reportId: string, contentType: PhotoContentTypeDto): string {
    return `reports/${reportId}/${randomUUID()}.${extensionFor(contentType)}`;
  }

  /** Kaynak erisim kurali (CLAUDE.md §3.8, §7 Guard Clause). */
  private async assertOwnership(reportId: string, userId: string): Promise<ReportAccessRecord> {
    const report = await this.photosRepository.findReportForAccess(reportId);
    if (report === null) {
      throw new NotFoundError('NOT_FOUND', 'Tutanak bulunamadi.');
    }
    if (report.ownerId !== userId) {
      throw new ForbiddenError('Bu tutanaga erisim yetkiniz yok.');
    }
    return report;
  }
}
