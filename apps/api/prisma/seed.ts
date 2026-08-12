// T-002 — PRD'de tanimli 3 sabit sablonun idempotent seed'i (CLAUDE.md §1).
// Adlar PRD/data-model.sql ile BIREBIR ayni olmalidir; `code` stabil makine adidir ve
// upsert anahtaridir, boylece seed defalarca kosulsa da kayit sayisi 3 kalir.
// Calistirma: `npm run seed --workspace @tutanak/api` (DATABASE_URL gereklidir).

import { PrismaClient } from '@prisma/client';

interface TemplateSeed {
  code: string;
  name: string;
  description: string;
  sortOrder: number;
}

const TEMPLATE_SEEDS: TemplateSeed[] = [
  {
    code: 'move_in_out',
    name: 'Giris/Cikis Teslim Tutanagi',
    description:
      'Kiraci giris veya cikis teslimi sirasinda mulkun genel durumunun foto ve notlarla kayit altina alinmasi.',
    sortOrder: 1,
  },
  {
    code: 'meter_fixture',
    name: 'Sayac/Demirbas Tespiti',
    description:
      'Elektrik, su, dogalgaz sayac degerleri ve mulkte birakilan demirbaslarin tespiti.',
    sortOrder: 2,
  },
  {
    code: 'periodic_check',
    name: 'Periyodik Durum Kontrolu',
    description: 'Kira donemi icinde yapilan periyodik mulk durum kontrolunun belgelenmesi.',
    sortOrder: 3,
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();

  try {
    for (const template of TEMPLATE_SEEDS) {
      await prisma.template.upsert({
        where: { code: template.code },
        create: template,
        update: {
          name: template.name,
          description: template.description,
          sortOrder: template.sortOrder,
        },
      });
    }
    process.stdout.write(`${String(TEMPLATE_SEEDS.length)} sablon seed edildi.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

// Seed bir CLI script'idir; pino logger'i uygulama baglami disinda kurulmaz (CLAUDE.md §4.4),
// bu yuzden sonuc dogrudan standart cikisa yazilir.
main().catch((error: unknown) => {
  process.exitCode = 1;
  process.stderr.write(`Sablon seed'i basarisiz oldu: ${String(error)}\n`);
});
