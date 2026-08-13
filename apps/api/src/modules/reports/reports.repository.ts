// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma
// tipleri bu dosyanin disina cikmaz.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { ReportStatusDto } from './dto/report.dto';

/** Var olmayan sablona referans — Prisma yabanci anahtar ihlali. */
const PRISMA_FOREIGN_KEY_VIOLATION = 'P2003';
/** Sutun tipine uymayan deger (uuid sutununa uuid olmayan metin) — Prisma P2023. */
const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';

/** Servis sinirinda tasinan tutanak kaydi; `ownerId` sahiplik kontrolu icindir (§3.8). */
export interface ReportRecord {
  id: string;
  ownerId: string;
  templateId: string;
  templateName: string;
  title: string;
  note: string;
  status: ReportStatusDto;
  photoCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReportInput {
  ownerId: string;
  templateId: string;
  title: string;
  note: string;
}

export interface FindReportsByOwnerInput {
  ownerId: string;
  /** Baslik/notta aranacak terim; verilmezse filtre uygulanmaz. */
  searchTerm?: string;
  skip: number;
  take: number;
}

export interface ReportPage {
  records: ReportRecord[];
  /** Sayfalamadan bagimsiz, ayni filtreye uyan toplam satir sayisi. */
  total: number;
}

/** Sablon adi ve fotograf sayisi tek sorguda gelir (ek gidis-donus yok). */
const REPORT_INCLUDE = {
  template: { select: { name: true } },
  _count: { select: { photos: true } },
} as const;

/**
 * Liste siralamasi (sozlesme: created_at DESC). Ikincil `id` anahtari yalnizca
 * deterministiklik icindir: ayni mikrosaniyede olusan iki kayit sayfalar arasinda
 * tekrarlanmasin/kaybolmasin. Birincil anahtar `reports_owner_created_at_idx` ile ayni.
 */
const REPORT_LIST_ORDER: Prisma.ReportOrderByWithRelationInput[] = [
  { createdAt: 'desc' },
  { id: 'desc' },
];

/**
 * LIKE/ILIKE joker karakterlerini kacirir: kullanicinin yazdigi `%` ve `_` harfi harfine
 * aranir (Postgres'te LIKE varsayilan kacis karakteri `\`). Prisma `contains` degeri
 * parametre olarak tasir — bu kacis enjeksiyon icin degil, arama dogrulugu icindir.
 */
function escapeLikeWildcards(term: string): string {
  return term.replace(/[\\%_]/g, (character) => `\\${character}`);
}

interface PrismaReportLike {
  id: string;
  ownerId: string;
  templateId: string;
  title: string;
  note: string;
  status: ReportStatusDto;
  createdAt: Date;
  updatedAt: Date;
  template: { name: string };
  _count: { photos: number };
}

function toReportRecord(report: PrismaReportLike): ReportRecord {
  return {
    id: report.id,
    ownerId: report.ownerId,
    templateId: report.templateId,
    templateName: report.template.name,
    title: report.title,
    note: report.note,
    status: report.status,
    photoCount: report._count.photos,
    createdAt: report.createdAt,
    updatedAt: report.updatedAt,
  };
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class ReportsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Taslagi tek sorguda yazar. `status` ve zaman damgalari GONDERILMEZ; DDL
   * varsayilanlari (`draft`, `now()`) sunucuda uretir (CLAUDE.md §3.7).
   * Sablon var mi diye ayrica sorgulanmaz: referans yoksa veritabani yabanci anahtar
   * ihlali ile reddeder ve bu "sablon bulunamadi" anlamina gelen `null`'a cevrilir —
   * boylece "once oku sonra yaz" yarisi olusamaz.
   */
  async createDraft(input: CreateReportInput): Promise<ReportRecord | null> {
    try {
      const report = await this.prisma.report.create({
        data: {
          ownerId: input.ownerId,
          templateId: input.templateId,
          title: input.title,
          note: input.note,
        },
        include: REPORT_INCLUDE,
      });
      return toReportRecord(report);
    } catch (error: unknown) {
      if (hasPrismaErrorCode(error, PRISMA_FOREIGN_KEY_VIOLATION)) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Sahibin tutanaklarini sayfali ve `created_at` azalan sirada doner; arama terimi
   * verilirse baslik VEYA notta ILIKE ile filtreler (`contains` + `insensitive` →
   * `pg_trgm` GIN index'leri kullanilir, architecture.md §4 "Arama").
   * Sayfa ve toplam sayi tek transaction icinde okunur: aksi halde iki sorgu arasina
   * giren bir yazma `total` ile sayfayi celiskiye dusururdu.
   */
  async findManyByOwner(input: FindReportsByOwnerInput): Promise<ReportPage> {
    const where = this.buildOwnerFilter(input.ownerId, input.searchTerm);

    const [reports, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: REPORT_INCLUDE,
        orderBy: REPORT_LIST_ORDER,
        skip: input.skip,
        take: input.take,
      }),
      this.prisma.report.count({ where }),
    ]);

    return { records: reports.map(toReportRecord), total };
  }

  /** Sahiplik filtresi her zaman uygulanir; arama terimi yalnizca varsa eklenir. */
  private buildOwnerFilter(ownerId: string, searchTerm?: string): Prisma.ReportWhereInput {
    if (searchTerm === undefined) {
      return { ownerId };
    }
    const pattern = escapeLikeWildcards(searchTerm);
    return {
      ownerId,
      OR: [
        { title: { contains: pattern, mode: 'insensitive' } },
        { note: { contains: pattern, mode: 'insensitive' } },
      ],
    };
  }

  /**
   * Kimlik uuid bicimine uymuyorsa Prisma sorguyu P2023 ile reddeder; bu "kayit yok" ile
   * ayni anlama gelir ve null'a cevrilir — sozlesme bu yol icin 400 tanimlamaz
   * (api-contract.yaml → GET /reports/{reportId}: 401/403/404).
   */
  async findById(id: string): Promise<ReportRecord | null> {
    try {
      const report = await this.prisma.report.findUnique({
        where: { id },
        include: REPORT_INCLUDE,
      });
      return report === null ? null : toReportRecord(report);
    } catch (error: unknown) {
      if (hasPrismaErrorCode(error, PRISMA_INCONSISTENT_COLUMN_DATA)) {
        return null;
      }
      throw error;
    }
  }
}
