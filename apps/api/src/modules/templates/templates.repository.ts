// Veri katmani siniri (CLAUDE.md §3.4, §7 Repository): Prisma cagrilari ve Prisma
// tipleri bu dosyanin disina cikmaz. Sablonlar MVP'de salt okunurdur (PRD kapsam disi
// madde 4), bu yuzden yalnizca okuma metodlari vardir.

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infra/prisma/prisma.service';

/** Sutun tipine uymayan deger (uuid sutununa uuid olmayan metin) — Prisma P2023. */
const PRISMA_INCONSISTENT_COLUMN_DATA = 'P2023';

export interface TemplateRecord {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface PrismaTemplateLike {
  id: string;
  code: string;
  name: string;
  description: string;
}

function toTemplateRecord(template: PrismaTemplateLike): TemplateRecord {
  return {
    id: template.id,
    code: template.code,
    name: template.name,
    description: template.description,
  };
}

function isInconsistentColumnData(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === PRISMA_INCONSISTENT_COLUMN_DATA
  );
}

@Injectable()
export class TemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Sabit 3 sablon; sira sunucuda `sort_order` ile belirlenir (templates_sort_order_idx),
   * boylece liste her istekte PRD'deki sirayla doner. Sayfalama gerekmez: satir sayisi
   * MVP'de sabittir ve kullanici sablon ekleyemez.
   */
  async findAll(): Promise<TemplateRecord[]> {
    const templates = await this.prisma.template.findMany({ orderBy: { sortOrder: 'asc' } });
    return templates.map(toTemplateRecord);
  }

  /**
   * Kimlik uuid bicimine uymuyorsa Prisma sorguyu P2023 ile reddeder; bu "kayit yok"
   * ile ayni anlama gelir ve null'a cevrilir — sozlesme bu endpoint icin 400 tanimlamaz,
   * tanimli tek olumsuz yanit 404'tur (api-contract.yaml → /templates/{templateId}).
   */
  async findById(id: string): Promise<TemplateRecord | null> {
    try {
      const template = await this.prisma.template.findUnique({ where: { id } });
      return template === null ? null : toTemplateRecord(template);
    } catch (error: unknown) {
      if (isInconsistentColumnData(error)) {
        return null;
      }
      throw error;
    }
  }
}
