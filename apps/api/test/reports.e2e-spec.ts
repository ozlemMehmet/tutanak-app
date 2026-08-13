// T-005 — tutanak taslagi olusturma (sablon + baslik + not) ve kendi tutanagini getirme
// (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur, belgelenen npm script'leriyle
// migration + seed kosar ve gercek HTTP katmanindan gecer; her kabul kriterinin testi vardir.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';

const TEST_DATABASE_NAME = 'tutanak_t005_reports_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';

const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';
const MALFORMED_ID = 'tutanak-42';
const TITLE_MAX_LENGTH = 200;
const NOTE_MAX_LENGTH = 5000;
// DB damgasi host saatinden kayabilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

interface ReportBody {
  id: string;
  templateId: string;
  templateName: string;
  title: string;
  note: string;
  status: string;
  photoCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ReportDetailBody extends ReportBody {
  photos: unknown[];
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    traceId: string;
    details?: { field: string; message: string }[];
  };
}

interface TemplateBody {
  id: string;
  name: string;
}

describe('T-005 tutanak taslagi olusturma', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
  let ownerId: string;
  let otherToken: string;
  let templateId: string;
  let templateName: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  const createReport = (body: object, token?: string): request.Test => {
    const test = request(httpServer()).post('/api/v1/reports').send(body);
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  const getReport = (reportId: string, token?: string): request.Test => {
    const test = request(httpServer()).get(`/api/v1/reports/${reportId}`);
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  const registerAndLogin = async (email: string): Promise<{ token: string; userId: string }> => {
    const registered = await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    return {
      token: (login.body as { accessToken: string }).accessToken,
      userId: (registered.body as { id: string }).id,
    };
  };

  beforeAll(async () => {
    baseDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    // Sablon satirlari T-002 seed'inden gelir; bu ticket yalnizca okur.
    runApiScript('seed', databaseUrl);
    prisma = createTestPrisma(databaseUrl);

    // Uygulama env'i yalnizca config/ uzerinden okur (CLAUDE.md §5); env atandiktan
    // SONRA dinamik import edilir, aksi halde sema modul yuklenirken kosar.
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';

    const { createApiApp } = await import('../src/main');
    app = await createApiApp();
    await app.init();

    const owner = await registerAndLogin('kaan-t005@ornek.test');
    ownerToken = owner.token;
    ownerId = owner.userId;
    otherToken = (await registerAndLogin('baska-t005@ornek.test')).token;

    const templates = await request(httpServer())
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${ownerToken}`);
    const selected = (templates.body as TemplateBody[])[0];
    templateId = selected?.id ?? '';
    templateName = selected?.name ?? '';
  }, MIGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropDatabase(TEST_DATABASE_NAME);
  }, MIGRATION_TIMEOUT_MS);

  describe('POST /api/v1/reports', () => {
    it('sablon, baslik ve not ile 201 ve olusturulan tutanagin kimligini doner', async () => {
      const before = Date.now();
      const response = await createReport(
        {
          templateId,
          title: 'Bahcelievler 3+1 cikis teslimi',
          note: 'Salon duvarinda cizik var.',
        },
        ownerToken,
      );
      const after = Date.now();

      expect(response.status).toBe(201);
      const body = response.body as ReportBody;
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.templateId).toBe(templateId);
      expect(body.templateName).toBe(templateName);
      expect(body.title).toBe('Bahcelievler 3+1 cikis teslimi');
      expect(body.note).toBe('Salon duvarinda cizik var.');
      expect(body.photoCount).toBe(0);

      // Damga sunucuda uretilir; iki tarafli tolerans penceresi (CLAUDE.md §8.5).
      const createdAt = new Date(body.createdAt).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(createdAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('olusturulan satir token sahibinin kimligiyle ve draft durumunda kaydedilir', async () => {
      const response = await createReport(
        { templateId, title: 'Sahiplik ve durum kontrolu' },
        ownerToken,
      );

      expect(response.status).toBe(201);
      const body = response.body as ReportBody;
      expect(body.status).toBe('draft');

      const stored = await prisma.report.findUnique({ where: { id: body.id } });
      expect(stored?.ownerId).toBe(ownerId);
      expect(stored?.status).toBe('draft');
    });

    it('not gonderilmediginde tutanak bos not ile olusur', async () => {
      const response = await createReport({ templateId, title: 'Notsuz tutanak' }, ownerToken);

      expect(response.status).toBe(201);
      expect((response.body as ReportBody).note).toBe('');
    });

    it('yanit yalnizca sozlesmedeki Report alanlarini tasir (owner_id sizmaz)', async () => {
      const response = await createReport({ templateId, title: 'Alan kontrolu' }, ownerToken);

      expect(Object.keys(response.body as ReportBody).sort()).toEqual([
        'createdAt',
        'id',
        'note',
        'photoCount',
        'status',
        'templateId',
        'templateName',
        'title',
        'updatedAt',
      ]);
    });

    it('baslik bos gonderildiginde 400 ve baslik zorunludur alan hatasi doner', async () => {
      const response = await createReport({ templateId, title: '', note: 'not' }, ownerToken);

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('VALIDATION_ERROR');
      expect(envelope.details).toEqual([{ field: 'title', message: 'baslik zorunludur' }]);
    });

    it('yalnizca bosluktan olusan baslik da 400 baslik zorunludur doner', async () => {
      const response = await createReport({ templateId, title: '    ' }, ownerToken);

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details).toEqual([
        { field: 'title', message: 'baslik zorunludur' },
      ]);
    });

    it('baslik alani hic gonderilmediginde 400 doner', async () => {
      const response = await createReport({ templateId }, ownerToken);

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('VALIDATION_ERROR');
      expect(envelope.details?.map((detail) => detail.field)).toContain('title');
    });

    it('baslik 200 karakteri asarsa 400 doner (DDL sinirlari ile ayni)', async () => {
      const response = await createReport(
        { templateId, title: 'a'.repeat(TITLE_MAX_LENGTH + 1) },
        ownerToken,
      );

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details?.[0]?.field).toBe('title');
    });

    it('not 5000 karakteri asarsa 400 doner (DDL sinirlari ile ayni)', async () => {
      const response = await createReport(
        { templateId, title: 'Uzun notlu tutanak', note: 'a'.repeat(NOTE_MAX_LENGTH + 1) },
        ownerToken,
      );

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details?.[0]?.field).toBe('note');
    });

    it('var olmayan sablon kimliginde 404 TEMPLATE_NOT_FOUND doner', async () => {
      const response = await createReport(
        { templateId: UNKNOWN_UUID, title: 'Sablonsuz tutanak' },
        ownerToken,
      );

      expect(response.status).toBe(404);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('TEMPLATE_NOT_FOUND');
      // 404 yaniti alan bazli detay tasimaz (CLAUDE.md §4.2.3).
      expect(envelope.details).toBeUndefined();
    });

    it('uuid bicimine uymayan sablon kimliginde 400 VALIDATION_ERROR doner', async () => {
      const response = await createReport(
        { templateId: MALFORMED_ID, title: 'Gecersiz sablon' },
        ownerToken,
      );

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('VALIDATION_ERROR');
      expect(envelope.details?.[0]?.field).toBe('templateId');
    });

    it('istemci owner veya status gondererek sahiplik ya da durum belirleyemez', async () => {
      const response = await createReport(
        { templateId, title: 'Sahiplik denemesi', ownerId: UNKNOWN_UUID, status: 'approved' },
        ownerToken,
      );

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const response = await createReport({ templateId, title: 'Tokensiz tutanak' });

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /api/v1/reports/{reportId}', () => {
    let ownedReportId: string;

    beforeAll(async () => {
      const created = await createReport(
        { templateId, title: 'Getirilecek tutanak', note: 'Kombi calisiyor.' },
        ownerToken,
      );
      ownedReportId = (created.body as ReportBody).id;
    });

    it('kendi tutanagini 200 ile fotograf listesi alaniyla birlikte doner', async () => {
      const response = await getReport(ownedReportId, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportDetailBody;
      expect(body.id).toBe(ownedReportId);
      expect(body.title).toBe('Getirilecek tutanak');
      expect(body.note).toBe('Kombi calisiyor.');
      expect(body.status).toBe('draft');
      // Fotograf yukleme T-006 kapsaminda; bu ticket'ta hicbir fotograf satiri olusamaz.
      expect(body.photos).toEqual([]);
    });

    it('baska kullaniciya ait tutanagi getirme denemesi 403 FORBIDDEN doner', async () => {
      const response = await getReport(ownedReportId, otherToken);

      expect(response.status).toBe(403);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('FORBIDDEN');
      expect(envelope.message).not.toContain('Getirilecek tutanak');
    });

    it('baska kullaniciya ait tutanagin duzenlenmesi mumkun degildir (sozlesmede rota yok)', async () => {
      // api-contract.yaml tutanak guncelleyen bir endpoint TANIMLAMAZ (CLAUDE.md §3.6):
      // duzenleme denemesi bu yuzden 403 degil, "rota yok" ile sonuclanir ve icerik degismez.
      const response = await request(httpServer())
        .patch(`/api/v1/reports/${ownedReportId}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ title: 'ele gecirildi' });

      expect(response.status).toBe(404);
      const stored = await prisma.report.findUnique({ where: { id: ownedReportId } });
      expect(stored?.title).toBe('Getirilecek tutanak');
    });

    it('var olmayan tutanak kimliginde 404 NOT_FOUND doner', async () => {
      const response = await getReport(UNKNOWN_UUID, ownerToken);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('NOT_FOUND');
    });

    it('uuid bicimine uymayan tutanak kimliginde de 404 doner (sozlesmede 400 tanimli degil)', async () => {
      const response = await getReport(MALFORMED_ID, ownerToken);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('NOT_FOUND');
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const response = await getReport(ownedReportId);

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });
});
