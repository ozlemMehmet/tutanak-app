// T-004 — hazir sablon listesi ve secimi (CLAUDE.md §8.2).
// Test kendi izole veritabanini olusturur, belgelenen npm script'leriyle migration + seed
// kosar ve gercek HTTP katmanindan gecer; her kabul kriterinin en az bir testi vardir.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';

const TEST_DATABASE_NAME = 'tutanak_t004_templates_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';

// PRD kapsam ici madde 3 / ticket kriteri 1 — adlar ve siralari birebir eslesmelidir.
const EXPECTED_TEMPLATE_NAMES = [
  'Giris/Cikis Teslim Tutanagi',
  'Sayac/Demirbas Tespiti',
  'Periyodik Durum Kontrolu',
];

const UNKNOWN_TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';
const MALFORMED_TEMPLATE_ID = 'sablon-42';

interface TemplateBody {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface ErrorBody {
  error: { code: string; message: string; traceId: string; details?: unknown };
}

describe('T-004 hazir sablon listesi ve secimi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let accessToken: string;
  // Uygulama izole test veritabanina baglanir; yonetim komutlari (DROP DATABASE) ise
  // temel adresten kosmalidir — aksi halde teardown kendi baglantisini dusurur.
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  const listTemplates = (token?: string): request.Test => {
    const test = request(httpServer()).get('/api/v1/templates');
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  const getTemplate = (templateId: string, token?: string): request.Test => {
    const test = request(httpServer()).get(`/api/v1/templates/${templateId}`);
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  beforeAll(async () => {
    baseDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    // Sablon verisi T-002'de seed edilir; bu ticket yalnizca okur (ticket teknik notu).
    runApiScript('seed', databaseUrl);
    prisma = createTestPrisma(databaseUrl);

    // Uygulama ortam degiskenlerini yalnizca config/ uzerinden okur (CLAUDE.md §5);
    // env atandiktan SONRA dinamik import edilir, aksi halde sema modul yuklenirken kosar.
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';

    const { createApiApp } = await import('../src/main');
    app = await createApiApp();
    await app.init();

    const email = 'kaan-t004@ornek.test';
    await request(httpServer()).post('/api/v1/auth/register').send({ email, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    accessToken = (login.body as { accessToken: string }).accessToken;
  }, MIGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropDatabase(TEST_DATABASE_NAME);
  }, MIGRATION_TIMEOUT_MS);

  describe('GET /api/v1/templates', () => {
    it('giris yapmis kullaniciya 200 ile tam olarak uc sablonu ad ve aciklamasiyla doner', async () => {
      const response = await listTemplates(accessToken);

      expect(response.status).toBe(200);
      const body = response.body as TemplateBody[];
      expect(body).toHaveLength(3);
      expect(body.map((template) => template.name)).toEqual(EXPECTED_TEMPLATE_NAMES);
      for (const template of body) {
        expect(template.description.length).toBeGreaterThan(0);
      }
    });

    it('yalnizca sozlesmedeki Template alanlarini doner (sort_order/created_at sizmaz)', async () => {
      const response = await listTemplates(accessToken);

      const body = response.body as TemplateBody[];
      for (const template of body) {
        expect(Object.keys(template).sort()).toEqual(['code', 'description', 'id', 'name']);
      }
    });

    it('ad ve aciklama metinlerini veritabanindaki seed satirlariyla birebir ayni doner', async () => {
      const response = await listTemplates(accessToken);

      const stored = await prisma.template.findMany({ orderBy: { sortOrder: 'asc' } });
      expect(response.body).toEqual(
        stored.map((template) => ({
          id: template.id,
          code: template.code,
          name: template.name,
          description: template.description,
        })),
      );
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const response = await listTemplates();

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });

    it('gecersiz token ile 401 doner', async () => {
      const response = await listTemplates('gecersiz.token.degeri');

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /api/v1/templates/{templateId}', () => {
    it('gecerli sablon kimligiyle 200 ve secilen sablonun kimligi ile adini doner', async () => {
      const list = await listTemplates(accessToken);
      const selected = (list.body as TemplateBody[])[1];

      const response = await getTemplate(selected?.id ?? '', accessToken);

      expect(response.status).toBe(200);
      const body = response.body as TemplateBody;
      expect(body.id).toBe(selected?.id);
      expect(body.name).toBe('Sayac/Demirbas Tespiti');
      expect(body).toEqual(selected);
    });

    it('var olmayan sablon kimliginde 404 TEMPLATE_NOT_FOUND doner', async () => {
      const response = await getTemplate(UNKNOWN_TEMPLATE_ID, accessToken);

      expect(response.status).toBe(404);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('TEMPLATE_NOT_FOUND');
      expect(envelope.message.length).toBeGreaterThan(0);
      expect(typeof envelope.traceId).toBe('string');
      // 404 yaniti alan bazli detay tasimaz (CLAUDE.md §4.2.3).
      expect(envelope.details).toBeUndefined();
    });

    it('uuid bicimine uymayan sablon kimliginde de 404 doner (sozlesmede 400 tanimli degil)', async () => {
      const response = await getTemplate(MALFORMED_TEMPLATE_ID, accessToken);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('TEMPLATE_NOT_FOUND');
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const list = await listTemplates(accessToken);
      const selected = (list.body as TemplateBody[])[0];

      const response = await getTemplate(selected?.id ?? '');

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });
});
