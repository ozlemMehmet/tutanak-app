// Test verisi fabrikasi: onay kaydi (CLAUDE.md §8.4 — dosya basina bir varlik).
// T-009 yalnizca GORUNTULEME ticket'idir: onay OLUSTURMA endpoint'i T-010'dadir, bu
// yuzden "onaylanmis tutanak" durumu testte dogrudan veritabanina yazilarak kurulur.

import type { Approval, PrismaClient } from '@prisma/client';

interface ApprovalInput {
  reportId: string;
  shareLinkId: string;
  approverEmail?: string;
}

export function createApproval(prisma: PrismaClient, input: ApprovalInput): Promise<Approval> {
  return prisma.approval.create({
    data: {
      reportId: input.reportId,
      shareLinkId: input.shareLinkId,
      approverEmail: input.approverEmail ?? 'kiraci@ornek.test',
    },
  });
}
