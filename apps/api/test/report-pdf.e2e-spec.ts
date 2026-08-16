// T-007 — tutanak PDF ciktisi (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur,
// belgelenen npm script'leriyle migration + seed kosar ve gercek HTTP katmanindan gecer;
// obje depolama FakeStorageAdapter ile degistirilir (§8.2), PDF uretimi (PDFKit + sharp)
// ve fotograf isleme zinciri GERCEKTIR.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { FakeStorageAdapter } from '../src/infra/storage/fake-storage.adapter';
import { STORAGE_PORT } from '../src/infra/storage/storage.port';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';
import { countPdfImages, extractPdfText } from './pdf-text';
import { createPhotoBytes } from './factories/photo.factory';

const TEST_DATABASE_NAME = 'tutanak_t007_pdf_test';
const MIGRATION_TIMEOUT_MS = 180_000;
const PDF_TIMEOUT_MS = 30_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';

const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';
const MALFORMED_ID = 'tutanak-42';

const REPORT_TITLE = 'Bahcelievler 3+1 cikis teslimi';
const REPORT_NOTE = 'Salon duvarinda cizik var, mutfak dolabi eksiksiz.';

interface ErrorBody {
  error: { code: string; message: string; traceId: string };
}

/** PDF damgasinin beklenen metni; uretim tarafiyla ayni saat dilimi (Europe/Istanbul). */
function expectedStamp(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(isoTimestamp));
}

describe('T-007 tutanak PDF ciktisi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
  let otherToken: string;
  let templateId: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  /** PDF ikili bir yanittir; superagent'in JSON cozumleyicisi devre disi birakilir. */
  const downloadPdf = (reportId: string, token?: string): request.Test => {
    const test = request(httpServer()).get(`/api/v1/reports/${reportId}/pdf`).responseType('blob');
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  const registerAndLogin = async (email: string): Promise<string> => {
    await request(httpServer()).post('/api/v1/auth/register').send({ email, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    return (login.body as { accessToken: string }).accessToken;
  };

  const createReport = async (token: string): Promise<string> => {
    const created = await request(httpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId, title: REPORT_TITLE, note: REPORT_NOTE });
    return (created.body as { id: string }).id;
  };

  const uploadPhoto = async (reportId: string, token: string): Promise<string> => {
    const response = await request(httpServer())
      .post(`/api/v1/reports/${reportId}/photos`)
      .set('Authorization', `Bearer ${token}`)
      .attach('file', await createPhotoBytes({ width: 120, height: 90 }), 'kamera.jpg');
    return (response.body as { capturedAt: string }).capturedAt;
  };

  beforeAll(async () => {
    baseDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    runApiScript('seed', databaseUrl);
    prisma = createTestPrisma(databaseUrl);

    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    // Zorunlu yapilandirma: uygulama bunlar olmadan ACILMAZ (CLAUDE.md §5). Her e2e suite'i
    // kendi env'ini KENDISI kurar; komsu suite'ten sizan degere guvenilmez.
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';
    process.env.SUBSCRIPTION_PRICE_AMOUNT = '199.00';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    // T-008 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.EMAIL_FROM = 'Tutanak <noreply@ornek.test>';
    // T-024/S-03 ile zorunlu hale geldi (varsayilani YOK); uygulama bu deger olmadan ACILMAZ.
    process.env.PAYMENT_PROVIDER = 'fake';
    // Obje depolama testte sahtelendigi icin bu degerler yalnizca sema dogrulamasini
    // gecmek icindir; hicbir ag cagrisi yapilmaz (CLAUDE.md §5).
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';

    const { AppModule } = await import('../src/app.module');
    const { configureApiApp } = await import('../src/main');

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_PORT)
      .useValue(new FakeStorageAdapter())
      .compile();
    app = configureApiApp(moduleRef.createNestApplication());
    await app.init();

    ownerToken = await registerAndLogin('kaan-t007@ornek.test');
    otherToken = await registerAndLogin('baska-t007@ornek.test');

    const templates = await request(httpServer())
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${ownerToken}`);
    templateId = (templates.body as { id: string }[])[0]?.id ?? '';
  }, MIGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropDatabase(TEST_DATABASE_NAME);
  }, MIGRATION_TIMEOUT_MS);

  describe('GET /api/v1/reports/{reportId}/pdf', () => {
    it(
      'en az bir fotografi olan tutanak icin 200 + application/pdf dosyasi doner',
      async () => {
        const reportId = await createReport(ownerToken);
        await uploadPhoto(reportId, ownerToken);

        const response = await downloadPdf(reportId, ownerToken);

        expect(response.status).toBe(200);
        expect(response.headers['content-type']).toContain('application/pdf');
        expect(response.headers['content-disposition']).toBe(
          `attachment; filename="tutanak-${reportId}.pdf"`,
        );
        const pdf = response.body as Buffer;
        expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
        expect(pdf.toString('latin1')).toContain('%%EOF');
      },
      PDF_TIMEOUT_MS,
    );

    it(
      'uretilen PDF tutanagin basligini, sablon adini ve notunu icerir',
      async () => {
        const reportId = await createReport(ownerToken);
        await uploadPhoto(reportId, ownerToken);
        const template = await prisma.template.findUniqueOrThrow({ where: { id: templateId } });

        const response = await downloadPdf(reportId, ownerToken);

        const text = extractPdfText(response.body as Buffer);
        expect(text).toContain(REPORT_TITLE);
        expect(text).toContain(template.name);
        expect(text).toContain(REPORT_NOTE);
      },
      PDF_TIMEOUT_MS,
    );

    it(
      'uretilen PDF eklenen fotografi ve o fotografin tarih-saat damgasini icerir',
      async () => {
        const reportId = await createReport(ownerToken);
        const capturedAt = await uploadPhoto(reportId, ownerToken);

        const response = await downloadPdf(reportId, ownerToken);

        const pdf = response.body as Buffer;
        expect(countPdfImages(pdf)).toBe(1);
        expect(extractPdfText(pdf)).toContain(expectedStamp(capturedAt));
      },
      PDF_TIMEOUT_MS,
    );

    it(
      'birden fazla fotografta her fotograf kendi damgasiyla PDF"e girer',
      async () => {
        const reportId = await createReport(ownerToken);
        const ilkDamga = await uploadPhoto(reportId, ownerToken);
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const ikinciDamga = await uploadPhoto(reportId, ownerToken);
        expect(expectedStamp(ilkDamga)).not.toBe(expectedStamp(ikinciDamga));

        const response = await downloadPdf(reportId, ownerToken);

        const pdf = response.body as Buffer;
        expect(countPdfImages(pdf)).toBe(2);
        const text = extractPdfText(pdf);
        expect(text).toContain(expectedStamp(ilkDamga));
        expect(text).toContain(expectedStamp(ikinciDamga));
        // Sira (sort_order, captured_at) ikilisine gore sabittir (CLAUDE.md §3.14).
        expect(text.indexOf(expectedStamp(ilkDamga))).toBeLessThan(
          text.indexOf(expectedStamp(ikinciDamga)),
        );
      },
      PDF_TIMEOUT_MS,
    );

    it('hic fotografi olmayan tutanakta 400 REPORT_HAS_NO_PHOTOS + aciklayici mesaj doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await request(httpServer())
        .get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('REPORT_HAS_NO_PHOTOS');
      expect(envelope.message.length).toBeGreaterThan(0);
      expect(envelope.traceId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('baska kullaniciya ait tutanagin PDF"ini isteme 403 FORBIDDEN doner', async () => {
      const reportId = await createReport(ownerToken);
      await uploadPhoto(reportId, ownerToken);

      const response = await request(httpServer())
        .get(`/api/v1/reports/${reportId}/pdf`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(response.status).toBe(403);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('FORBIDDEN');
      // Baskasinin tutanak icerigi yetkisiz istege sizmaz (CLAUDE.md §4.3).
      expect(envelope.message).not.toContain(REPORT_TITLE);
    });

    it('var olmayan ve bicimsiz tutanak kimliginde 404 NOT_FOUND doner', async () => {
      const bilinmeyen = await request(httpServer())
        .get(`/api/v1/reports/${UNKNOWN_UUID}/pdf`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const bicimsiz = await request(httpServer())
        .get(`/api/v1/reports/${MALFORMED_ID}/pdf`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(bilinmeyen.status).toBe(404);
      expect((bilinmeyen.body as ErrorBody).error.code).toBe('NOT_FOUND');
      expect(bicimsiz.status).toBe(404);
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const reportId = await createReport(ownerToken);
      await uploadPhoto(reportId, ownerToken);

      const response = await request(httpServer()).get(`/api/v1/reports/${reportId}/pdf`);

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });
});
