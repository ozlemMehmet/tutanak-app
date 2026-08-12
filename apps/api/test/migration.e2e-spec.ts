// T-002 — migration + seed + rollback'in TEMIZ bir veritabaninda calistigini dogrular
// (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur ve sonunda dusurur; komutlar
// belgelenen npm script'leriyle ayni (`migrate:deploy`, `seed`, `migrate:down`).

import type { PrismaClient } from '@prisma/client';
import {
  createEmptyDatabase,
  createTestPrisma,
  dropDatabase,
  expectSqlState,
  FOREIGN_KEY_VIOLATION,
  NOT_NULL_VIOLATION,
  runApiScript,
} from './db';
import { createUser } from './factories/user.factory';
import { createReport } from './factories/report.factory';

const TEST_DATABASE_NAME = 'tutanak_t002_migration_test';

// Migration/seed kosumlari npm script'i olarak spawn edildigi icin varsayilan 5 sn yetmez.
const MIGRATION_TIMEOUT_MS = 180_000;

// PRD kapsam ici madde 3 — adlar birebir eslesmelidir.
const EXPECTED_TEMPLATE_NAMES = [
  'Giris/Cikis Teslim Tutanagi',
  'Sayac/Demirbas Tespiti',
  'Periyodik Durum Kontrolu',
];

const EXPECTED_TABLES = [
  'approvals',
  'payment_transactions',
  'report_photos',
  'reports',
  'share_deliveries',
  'share_links',
  'subscriptions',
  'templates',
  'users',
];

describe('T-002 veri modeli migration akisi', () => {
  let databaseUrl: string;
  let prisma: PrismaClient;

  async function tableNames(): Promise<string[]> {
    const rows = await prisma.$queryRaw<{ table_name: string }[]>`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    return rows.map((row) => row.table_name);
  }

  beforeAll(async () => {
    databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    prisma = createTestPrisma(databaseUrl);
  }, MIGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await prisma.$disconnect();
    await dropDatabase(TEST_DATABASE_NAME);
  }, MIGRATION_TIMEOUT_MS);

  describe('migrate deploy', () => {
    it('temiz veritabaninda kullanici, sablon, tutanak, fotograf, onay ve abonelik tablolarini olusturur', async () => {
      const tables = await tableNames();

      expect(tables).toEqual(expect.arrayContaining(EXPECTED_TABLES));
    });

    it('tutanak durum/abonelik/odeme enum tiplerini olusturur', async () => {
      const rows = await prisma.$queryRaw<{ typname: string }[]>`
        SELECT typname FROM pg_type WHERE typtype = 'e' ORDER BY typname
      `;

      expect(rows.map((row) => row.typname)).toEqual(
        expect.arrayContaining([
          'delivery_status',
          'payment_status',
          'report_status',
          'share_channel',
          'subscription_status',
        ]),
      );
    });
  });

  describe('sablon seed', () => {
    it('migration sonrasi sablon tablosunda tam olarak 3 kayit bulunur', async () => {
      const count = await prisma.template.count();

      expect(count).toBe(3);
    });

    it('sablon adlari PRD ile birebir eslesir', async () => {
      const templates = await prisma.template.findMany({ orderBy: { sortOrder: 'asc' } });

      expect(templates.map((template) => template.name)).toEqual(EXPECTED_TEMPLATE_NAMES);
    });

    it(
      'seed script i ikinci kez kosuldugunda kayit sayisi 3 kalir (idempotent)',
      async () => {
        runApiScript('seed', databaseUrl);
        runApiScript('seed', databaseUrl);

        const templates = await prisma.template.findMany({ orderBy: { sortOrder: 'asc' } });

        expect(templates).toHaveLength(3);
        expect(templates.map((template) => template.name)).toEqual(EXPECTED_TEMPLATE_NAMES);
      },
      MIGRATION_TIMEOUT_MS,
    );
  });

  describe('tutanak referans kisitlari', () => {
    it('owner_id bos birakilan tutanak kaydi reddedilir', async () => {
      const template = await prisma.template.findFirstOrThrow();

      await expectSqlState(
        prisma.$executeRaw`
          INSERT INTO reports (owner_id, template_id, title)
          VALUES (NULL, ${template.id}::uuid, 'Sahipsiz tutanak')
        `,
        NOT_NULL_VIOLATION,
      );
    });

    it('template_id bos birakilan tutanak kaydi reddedilir', async () => {
      const owner = await createUser(prisma);

      await expectSqlState(
        prisma.$executeRaw`
          INSERT INTO reports (owner_id, template_id, title)
          VALUES (${owner.id}::uuid, NULL, 'Sablonsuz tutanak')
        `,
        NOT_NULL_VIOLATION,
      );
    });

    it('var olmayan kullaniciya referans veren tutanak kaydi reddedilir', async () => {
      const template = await prisma.template.findFirstOrThrow();

      await expectSqlState(
        prisma.$executeRaw`
          INSERT INTO reports (owner_id, template_id, title)
          VALUES ('00000000-0000-4000-8000-000000000001'::uuid, ${template.id}::uuid, 'Hayali sahip')
        `,
        FOREIGN_KEY_VIOLATION,
      );
    });

    it('var olmayan sablona referans veren tutanak kaydi reddedilir', async () => {
      const owner = await createUser(prisma);

      await expectSqlState(
        prisma.$executeRaw`
          INSERT INTO reports (owner_id, template_id, title)
          VALUES (${owner.id}::uuid, '00000000-0000-4000-8000-000000000002'::uuid, 'Hayali sablon')
        `,
        FOREIGN_KEY_VIOLATION,
      );
    });

    it('gecerli kullanici ve sablon referansiyla tutanak kaydi olusur', async () => {
      const owner = await createUser(prisma);
      const template = await prisma.template.findFirstOrThrow();

      const report = await createReport(prisma, { ownerId: owner.id, templateId: template.id });

      expect(report.ownerId).toBe(owner.id);
      expect(report.templateId).toBe(template.id);
      expect(report.status).toBe('draft');
    });
  });

  describe('rollback (migrate:down)', () => {
    it(
      'geri alma komutu tum tablolari, enum tiplerini ve trigger fonksiyonlarini kaldirir',
      async () => {
        await prisma.$disconnect();
        runApiScript('migrate:down', databaseUrl);
        prisma = createTestPrisma(databaseUrl);

        const tables = await tableNames();
        const enums = await prisma.$queryRaw<{ typname: string }[]>`
          SELECT typname FROM pg_type WHERE typtype = 'e'
        `;
        const functions = await prisma.$queryRaw<{ proname: string }[]>`
          SELECT proname FROM pg_proc
          WHERE proname IN ('set_updated_at', 'reject_timestamp_mutation')
        `;

        expect(tables).toEqual([]);
        expect(enums).toEqual([]);
        expect(functions).toEqual([]);
      },
      MIGRATION_TIMEOUT_MS,
    );

    it(
      'geri alma sonrasi migration yeniden hatasiz uygulanabilir',
      async () => {
        await prisma.$disconnect();
        runApiScript('migrate:deploy', databaseUrl);
        prisma = createTestPrisma(databaseUrl);

        const tables = await tableNames();
        const count = await prisma.template.count();

        expect(tables).toEqual(expect.arrayContaining(EXPECTED_TABLES));
        expect(count).toBe(3);
      },
      MIGRATION_TIMEOUT_MS,
    );
  });
});
