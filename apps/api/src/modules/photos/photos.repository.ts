// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma
// tipleri bu dosyanin disina cikmaz.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { ReportStatusDto } from '../reports/dto/report.dto';
import type { PhotoContentTypeDto } from './dto/photo.dto';

/** Sutun tipine uymayan deger (uuid sutununa uuid olmayan metin) — Prisma P2023. */
const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';

/** Ilk fotografin sirasi 0'dir (CLAUDE.md §3.14). */
const FIRST_SORT_ORDER = 0;

/** Servis sinirinda tasinan fotograf kaydi. */
export interface PhotoRecord {
  id: string;
  reportId: string;
  storageKey: string;
  contentType: PhotoContentTypeDto;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  capturedAt: Date;
}

/** Sahiplik ve kanit butunlugu kurallarinin ihtiyac duydugu asgari tutanak alanlari. */
export interface ReportAccessRecord {
  ownerId: string;
  status: ReportStatusDto;
}

export interface CreatePhotoInput {
  reportId: string;
  storageKey: string;
  contentType: PhotoContentTypeDto;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
}

interface PrismaPhotoLike {
  id: string;
  reportId: string;
  storageKey: string;
  contentType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  capturedAt: Date;
}

function toPhotoRecord(photo: PrismaPhotoLike): PhotoRecord {
  return {
    id: photo.id,
    reportId: photo.reportId,
    storageKey: photo.storageKey,
    // Sutun degeri DDL CHECK ile izin verilen kumeyle sinirlidir.
    contentType: photo.contentType as PhotoContentTypeDto,
    sizeBytes: photo.sizeBytes,
    widthPx: photo.widthPx,
    heightPx: photo.heightPx,
    capturedAt: photo.capturedAt,
  };
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class PhotosRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fotograf satirini yazar. `captured_at` GONDERILMEZ — damga DDL'deki `DEFAULT now()`
   * ile sunucuda dogar (CLAUDE.md §3.7). `sort_order` sunucuda "mevcut en buyuk + 1"
   * olarak ekleme ile AYNI transaction icinde atanir (§3.14); es zamanli iki yuklemenin
   * ayni degeri almasi DDL yorumunda bilincli olarak tolere edilmistir (tie-break
   * `captured_at`).
   */
  async create(input: CreatePhotoInput): Promise<PhotoRecord> {
    const photo = await this.prisma.$transaction(async (tx) => {
      const { _max } = await tx.reportPhoto.aggregate({
        where: { reportId: input.reportId },
        _max: { sortOrder: true },
      });
      const sortOrder = _max.sortOrder === null ? FIRST_SORT_ORDER : _max.sortOrder + 1;
      return tx.reportPhoto.create({ data: { ...input, sortOrder } });
    });
    return toPhotoRecord(photo);
  }

  /** Listeleme her yerde (sort_order, captured_at) sirasini kullanir — sirasiz sorgu yasak (§3.14). */
  async findByReport(reportId: string): Promise<PhotoRecord[]> {
    const photos = await this.prisma.reportPhoto.findMany({
      where: { reportId },
      orderBy: [{ sortOrder: 'asc' }, { capturedAt: 'asc' }],
    });
    return photos.map(toPhotoRecord);
  }

  /** Ust sinir kontrolu icin sayim veritabaninda yapilir (satirlar uygulamaya cekilmez). */
  countByReport(reportId: string): Promise<number> {
    return this.prisma.reportPhoto.count({ where: { reportId } });
  }

  /**
   * Sahiplik/durum kontrolu icin tutanagin asgari alanlarini okur. Fotograf modulunun
   * kendi guard clause'u icin gerekli oldugundan burada okunur; boylece modul grafi
   * dongusuz kalir (reports -> photos tek yonlu).
   * Kimlik uuid bicimine uymuyorsa P2023 "kayit yok" ile ayni anlama gelir (T-005 karari).
   */
  async findReportForAccess(reportId: string): Promise<ReportAccessRecord | null> {
    try {
      return await this.prisma.report.findUnique({
        where: { id: reportId },
        select: { ownerId: true, status: true },
      });
    } catch (error: unknown) {
      if (hasPrismaErrorCode(error, PRISMA_INCONSISTENT_COLUMN_DATA)) {
        return null;
      }
      throw error;
    }
  }
}
