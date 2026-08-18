// T-002 — PRD'de tanimli 3 sabit sablonun idempotent seed'i (CLAUDE.md §1).
// `code` stabil makine adidir ve upsert anahtaridir, boylece seed defalarca kosulsa da
// kayit sayisi 3 kalir.
//
// H-005 — ad ve aciklamalar kullaniciya donuk metinlerdir ve gercek Turkce harflerle
// yazilir (ASCII'ye katlanmis `Tutanagi` bicimi kullanilmaz). `update` dali sayesinde
// daha once yanlis adla seed edilmis veritabanlari normal bir yeniden baslatmada
// (`migrate:deploy && seed`) kendiliginden duzelir; ayri bir migration gerekmez.
// NOT: `factory/04-architecture/data-model.sql` ve init migration'in INSERT blogu hala
// ASCII karsiliklarini tasir; bu dosya kullaniciya donen tek yetkili kaynaktir (seed her
// aciliste migration'dan SONRA kosar). Sapma devlog H-005'te sozlesme boslugu olarak
// raporlanmistir — dev ajani mimari dosyalarini degistirmez (CLAUDE.md §3.6/§11).
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
    name: 'Giriş/Çıkış Teslim Tutanağı',
    description:
      'Kiracı giriş veya çıkış teslimi sırasında mülkün genel durumunun foto ve notlarla kayıt altına alınması.',
    sortOrder: 1,
  },
  {
    code: 'meter_fixture',
    name: 'Sayaç/Demirbaş Tespiti',
    description:
      'Elektrik, su, doğalgaz sayaç değerleri ve mülkte bırakılan demirbaşların tespiti.',
    sortOrder: 2,
  },
  {
    code: 'periodic_check',
    name: 'Periyodik Durum Kontrolü',
    description: 'Kira dönemi içinde yapılan periyodik mülk durum kontrolünün belgelenmesi.',
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
