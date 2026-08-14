// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma tipleri
// bu dosyanin disina cikmaz. Paylasim linki idempotansinin birincil garantisi DB unique
// index'idir (`share_links_report_id_key`): once INSERT denenir, unique ihlali yakalaninca
// mevcut kayit okunur — "once oku sonra yaz" yarisi yapisal olarak imkansizdir (§7).

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';
import type { ReportStatusDto } from '../reports/dto/report.dto';
import type { ShareDeliveryStatusDto } from './dto/share-link.dto';

/** Unique kisit ihlali (SQLSTATE 23505) — Prisma P2002. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';
/** Sutun tipine uymayan deger (uuid sutununa uuid olmayan metin) — Prisma P2023. */
const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';

/** Servis sinirinda tasinan paylasim linki kaydi. */
export interface ShareLinkRecord {
  id: string;
  reportId: string;
  token: string;
  createdAt: Date;
}

/** Servis sinirinda tasinan teslim kaydi. */
export interface ShareDeliveryRecord {
  id: string;
  shareLinkId: string;
  channel: 'email';
  recipientEmail: string;
  status: ShareDeliveryStatusDto;
  errorMessage: string | null;
  createdAt: Date;
}

export interface CreateDeliveryInput {
  shareLinkId: string;
  recipientEmail: string;
  status: ShareDeliveryStatusDto;
  providerMessageId: string | null;
  errorMessage: string | null;
}

/** Sahiplik kuralinin ihtiyac duydugu asgari tutanak alanlari (photos ile ayni desen). */
export interface ReportAccessRecord {
  ownerId: string;
  status: ReportStatusDto;
}

/** Onay kaydinin goruntulemede gosterilen alanlari (T-009 salt-okunur; yazma T-010'da). */
export interface ApprovalRecord {
  id: string;
  approverEmail: string;
  approvedAt: Date;
}

/**
 * Oturumsuz goruntulemenin ihtiyac duydugu tutanak alanlari (T-009). `ownerId` bilerek
 * TASINMAZ: bu akista yetkilendirme anahtari gecerli paylasim token'idir, sahiplik degil.
 */
export interface PublicReportRecord {
  reportId: string;
  title: string;
  templateName: string;
  note: string;
  status: ReportStatusDto;
  createdAt: Date;
  approval: ApprovalRecord | null;
}

interface PrismaShareLinkLike {
  id: string;
  reportId: string;
  token: string;
  createdAt: Date;
}

function toShareLinkRecord(link: PrismaShareLinkLike): ShareLinkRecord {
  return { id: link.id, reportId: link.reportId, token: link.token, createdAt: link.createdAt };
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class SharingRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paylasim linkini get-or-create ile uretir (T-008 kriter 3). INSERT ve `draft` ->
   * `shared` durum gecisi AYNI transaction icindedir (CLAUDE.md §3.10); gecis KOSULLUDUR
   * (yalnizca `draft` satiri guncellenir, `shared`/`approved` korunur). Unique ihlalinde
   * mevcut satir okunup doner — yeni token uretilmez ve durum gecisi calismaz (link zaten
   * vardi, durum zaten `shared`/`approved`).
   */
  async getOrCreateShareLink(reportId: string, candidateToken: string): Promise<ShareLinkRecord> {
    try {
      const link = await this.prisma.$transaction(async (tx) => {
        const created = await tx.shareLink.create({ data: { reportId, token: candidateToken } });
        await tx.report.updateMany({
          where: { id: reportId, status: 'draft' },
          data: { status: 'shared' },
        });
        return created;
      });
      return toShareLinkRecord(link);
    } catch (error: unknown) {
      if (hasPrismaErrorCode(error, PRISMA_UNIQUE_VIOLATION)) {
        const existing = await this.prisma.shareLink.findUnique({ where: { reportId } });
        if (existing !== null) {
          return toShareLinkRecord(existing);
        }
        // Teorik dal: ihlal token sutunundan geldiyse (32 bayt entropide carpisma) mevcut
        // satir yoktur; hatayi yutmak yerine yukari tasiriz (500 -> tekrar deneme).
      }
      throw error;
    }
  }

  async findByReport(reportId: string): Promise<ShareLinkRecord | null> {
    const link = await this.prisma.shareLink.findUnique({ where: { reportId } });
    return link === null ? null : toShareLinkRecord(link);
  }

  /** Teslim kaydi (T-008 kriter 4): damga DDL `DEFAULT now()` ile sunucuda dogar (§3.7). */
  async createDelivery(input: CreateDeliveryInput): Promise<ShareDeliveryRecord> {
    const delivery = await this.prisma.shareDelivery.create({
      data: {
        shareLinkId: input.shareLinkId,
        recipientEmail: input.recipientEmail,
        status: input.status,
        providerMessageId: input.providerMessageId,
        errorMessage: input.errorMessage,
      },
    });
    return {
      id: delivery.id,
      shareLinkId: delivery.shareLinkId,
      channel: 'email',
      recipientEmail: delivery.recipientEmail,
      status: delivery.status,
      errorMessage: delivery.errorMessage,
      createdAt: delivery.createdAt,
    };
  }

  /**
   * Paylasim token'i ile tutanagi, sablon adini ve (varsa) onay kaydini TEK sorguda okur
   * (T-009). Token `share_links_token_key` ile benzersizdir; bulunamazsa `null` doner ve
   * servis bunu 404'e cevirir — "token gecersiz" ile "tutanak yok" istemciye ayni gorunur.
   * Fotograflar buraya DAHIL DEGILDIR: on-imzali URL uretimi photos modulunun isidir
   * ve sira kurali (§3.14) orada tek noktada yasar.
   */
  async findReportViewByToken(token: string): Promise<PublicReportRecord | null> {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      select: {
        report: {
          select: {
            id: true,
            title: true,
            note: true,
            status: true,
            createdAt: true,
            template: { select: { name: true } },
            approval: { select: { id: true, approverEmail: true, approvedAt: true } },
          },
        },
      },
    });
    if (link === null) {
      return null;
    }
    const { report } = link;
    return {
      reportId: report.id,
      title: report.title,
      templateName: report.template.name,
      note: report.note,
      status: report.status,
      createdAt: report.createdAt,
      approval: report.approval,
    };
  }

  /**
   * Sahiplik kontrolu icin tutanagin asgari alanlarini okur (photos.repository ile ayni
   * desen; modul grafi dongusuz kalir). Kimlik uuid bicimine uymuyorsa P2023 "kayit yok"
   * ile ayni anlama gelir (T-005 karari).
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
