// Test verisi fabrikasi: tutanak (CLAUDE.md §8.4 — dosya basina bir varlik).

import type { PrismaClient, Report } from '@prisma/client';

interface ReportInput {
  ownerId: string;
  templateId: string;
  title?: string;
  note?: string;
}

export function createReport(prisma: PrismaClient, input: ReportInput): Promise<Report> {
  return prisma.report.create({
    data: {
      ownerId: input.ownerId,
      templateId: input.templateId,
      title: input.title ?? 'Ornek teslim tutanagi',
      note: input.note ?? '',
    },
  });
}
