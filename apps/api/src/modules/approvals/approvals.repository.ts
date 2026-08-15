// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma tipleri
// bu dosyanin disina cikmaz. Mukerrer onayin birincil garantisi DB unique index'idir
// (`approvals_report_id_key`): once INSERT denenir, unique ihlali yakalanip "zaten onayli"
// anlamina gelen `null`'a cevrilir — "once oku sonra yaz" yarisi yapisal olarak imkansizdir
// (§7 Unique kisit).

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Unique kisit ihlali (SQLSTATE 23505) — Prisma P2002. */
const PRISMA_UNIQUE_VIOLATION = 'P2002';

/** Onayin baglanacagi paylasim linki; token'in cozumu YALNIZCA bu iki alani tasir. */
export interface ShareLinkTargetRecord {
  shareLinkId: string;
  reportId: string;
}

/** Servis sinirinda tasinan onay kaydi (yanit alanlari — §3.5). */
export interface ApprovalRecord {
  id: string;
  approverEmail: string;
  approvedAt: Date;
}

export interface CreateApprovalInput {
  reportId: string;
  shareLinkId: string;
  approverEmail: string;
}

function hasPrismaErrorCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

@Injectable()
export class ApprovalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Paylasim token'ini onaylanacak tutanaga cevirir. Token `share_links_token_key` ile
   * benzersizdir; bulunamazsa `null` doner ve servis bunu 404'e cevirir.
   */
  async findLinkByToken(token: string): Promise<ShareLinkTargetRecord | null> {
    const link = await this.prisma.shareLink.findUnique({
      where: { token },
      select: { id: true, reportId: true },
    });
    return link === null ? null : { shareLinkId: link.id, reportId: link.reportId };
  }

  /**
   * Onay kaydini yazar ve tutanagi AYNI transaction icinde `approved` yapar (CLAUDE.md
   * §3.10 — gecis, onay kaydini yazan transaction icindedir). Zaman damgasi
   * GONDERILMEZ: `approved_at` DDL varsayilani (`DEFAULT now()`) ile sunucuda dogar (§3.7).
   *
   * Durum guncellemesi kosulsuzdur: paylasim linki var oldugu icin tutanak `shared` ya da
   * `approved` durumundadir (`draft` link uretimiyle birlikte `shared` olur) ve `approved`
   * hali INSERT'i unique kisit ile zaten reddettirirdi. Kosulsuz yazim "onay kaydi varsa
   * durum approved'dir" degismezini garanti eder; geri gecis uretmez.
   *
   * Unique ihlalinde `null` doner (tutanak zaten onayli); HTTP karsiligini servis secer.
   */
  async createApproval(input: CreateApprovalInput): Promise<ApprovalRecord | null> {
    try {
      const approval = await this.prisma.$transaction(async (tx) => {
        const created = await tx.approval.create({
          data: {
            reportId: input.reportId,
            shareLinkId: input.shareLinkId,
            approverEmail: input.approverEmail,
          },
        });
        await tx.report.update({ where: { id: input.reportId }, data: { status: 'approved' } });
        return created;
      });
      return {
        id: approval.id,
        approverEmail: approval.approverEmail,
        approvedAt: approval.approvedAt,
      };
    } catch (error: unknown) {
      if (hasPrismaErrorCode(error, PRISMA_UNIQUE_VIOLATION)) {
        return null;
      }
      throw error;
    }
  }
}
