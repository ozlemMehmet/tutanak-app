// T-008 — paylasim linki uretimi (idempotan), e-posta ile gonderim ve wa.me URL'si
// (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur, gercek HTTP katmanindan
// gecer; e-posta saglayicisi FakeEmailAdapter ile degistirilir (§8.2) — boylece hem
// basarili hem basarisiz gonderim senaryosu kurgulanir (kabul kriteri 4).

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { FakeEmailAdapter } from '../src/infra/email/fake-email.adapter';
import { EMAIL_PORT } from '../src/infra/email/email.port';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';

const TEST_DATABASE_NAME = 'tutanak_t008_sharing_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';
const PUBLIC_APP_URL = 'http://localhost:5173';
const RECIPIENT = 'kiraci@ornek.test';

const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';
const MALFORMED_ID = 'tutanak-42';
/** 32 bayt entropi base64url'de 43 karakter uretir; DDL CHECK 32..128 araligindadir. */
const BASE64URL_TOKEN = /^[A-Za-z0-9_-]{43}$/;
// DB damgasi host saatinden kayabilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

interface ShareLinkBody {
  token: string;
  url: string;
  whatsAppUrl: string;
  createdAt: string;
}

interface ShareDeliveryBody {
  id: string;
  channel: string;
  recipientEmail: string;
  status: string;
  errorMessage: string | null;
  createdAt: string;
}

interface ErrorBody {
  error: { code: string; message: string; traceId: string; details?: { field: string }[] };
}

describe('T-008 paylasim linki ve e-posta/WhatsApp paylasimi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let email: FakeEmailAdapter;
  let ownerToken: string;
  let otherToken: string;
  let templateId: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  const withAuth = (test: request.Test, token?: string): request.Test =>
    token === undefined ? test : test.set('Authorization', `Bearer ${token}`);

  const createLink = (reportId: string, token?: string): request.Test =>
    withAuth(request(httpServer()).post(`/api/v1/reports/${reportId}/share-link`), token);

  const getLink = (reportId: string, token?: string): request.Test =>
    withAuth(request(httpServer()).get(`/api/v1/reports/${reportId}/share-link`), token);

  const sendEmail = (
    reportId: string,
    body: Record<string, unknown>,
    token?: string,
  ): request.Test =>
    withAuth(
      request(httpServer()).post(`/api/v1/reports/${reportId}/share-link/email`),
      token,
    ).send(body);

  const registerAndLogin = async (emailAddress: string): Promise<string> => {
    await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailAddress, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailAddress, password: PASSWORD });
    return (login.body as { accessToken: string }).accessToken;
  };

  const createReport = async (title = 'Paylasilacak tutanak'): Promise<string> => {
    const created = await request(httpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ templateId, title });
    return (created.body as { id: string }).id;
  };

  const reportStatus = async (reportId: string): Promise<string> => {
    const report = await prisma.report.findUniqueOrThrow({
      where: { id: reportId },
      select: { status: true },
    });
    return report.status;
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
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';
    // Bu dosya hiz sinirini test etmez (T-014 kendi suite'inde); kurulum 429'a dusmesin.
    process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '1000';
    // T-012 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.SUBSCRIPTION_PRICE_AMOUNT = '199.00';
    process.env.PUBLIC_APP_URL = PUBLIC_APP_URL;
    // T-006: obje depolama anahtarlari sema dogrulamasi icindir; bu testler depolamayi kullanmaz.
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';
    // T-008: e-posta gonderen adresi zorunlu; saglayici FakeEmailAdapter ile degistirilir.
    process.env.EMAIL_FROM = 'Tutanak <noreply@ornek.test>';
    // T-024/S-03 ile zorunlu hale geldi (varsayilani YOK); uygulama bu deger olmadan ACILMAZ.
    process.env.PAYMENT_PROVIDER = 'fake';

    const { AppModule } = await import('../src/app.module');
    const { configureApiApp } = await import('../src/main');

    email = new FakeEmailAdapter();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EMAIL_PORT)
      .useValue(email)
      .compile();
    app = configureApiApp(moduleRef.createNestApplication());
    await app.init();

    ownerToken = await registerAndLogin('kaan-t008@ornek.test');
    otherToken = await registerAndLogin('baska-t008@ornek.test');

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

  describe('POST /api/v1/reports/{reportId}/share-link', () => {
    it('sahip olunan tutanak icin 201 + benzersiz base64url token ve /t/{token} URL doner (kriter 1-2)', async () => {
      const reportId = await createReport();
      const before = Date.now();

      const response = await createLink(reportId, ownerToken);
      const after = Date.now();

      expect(response.status).toBe(201);
      const body = response.body as ShareLinkBody;
      expect(body.token).toMatch(BASE64URL_TOKEN);
      // Genel URL formati: kimlik dogrulamasi gerektirmeyen /t/{token} yolu (bkz. T-009).
      expect(body.url).toBe(`${PUBLIC_APP_URL}/t/${body.token}`);

      const createdAt = new Date(body.createdAt).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(createdAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('yanit yalnizca sozlesmedeki ShareLink alanlarini tasir (ic kimlikler sizmaz)', async () => {
      const reportId = await createReport();

      const response = await createLink(reportId, ownerToken);

      expect(Object.keys(response.body as ShareLinkBody).sort()).toEqual([
        'createdAt',
        'token',
        'url',
        'whatsAppUrl',
      ]);
    });

    it('iki farkli tutanagin tokenlari birbirinden farklidir (kriter 1)', async () => {
      const first = (await createLink(await createReport(), ownerToken)).body as ShareLinkBody;
      const second = (await createLink(await createReport(), ownerToken)).body as ShareLinkBody;

      expect(first.token).not.toBe(second.token);
    });

    it('basarili istekte tutanak draft -> shared olur (CLAUDE.md §3.10)', async () => {
      const reportId = await createReport();
      await expect(reportStatus(reportId)).resolves.toBe('draft');

      await createLink(reportId, ownerToken);

      await expect(reportStatus(reportId)).resolves.toBe('shared');
    });

    it('ayni tutanak icin ikinci istek AYNI token"i doner ve tabloda tek satir kalir (kriter 3)', async () => {
      const reportId = await createReport();

      const first = (await createLink(reportId, ownerToken)).body as ShareLinkBody;
      const secondResponse = await createLink(reportId, ownerToken);
      const second = secondResponse.body as ShareLinkBody;

      expect(secondResponse.status).toBe(201);
      expect(second.token).toBe(first.token);
      await expect(prisma.shareLink.count({ where: { reportId } })).resolves.toBe(1);
    });

    it('onaylanmis tutanakta mevcut link doner ve durum approved KALIR (geri gecis yok, §3.10)', async () => {
      const reportId = await createReport();
      const first = (await createLink(reportId, ownerToken)).body as ShareLinkBody;
      // Onay akisi T-010'dadir; durum dogrudan DB'de kurgulanir (test kurgusudur, endpoint degil).
      await prisma.report.update({ where: { id: reportId }, data: { status: 'approved' } });

      const response = await createLink(reportId, ownerToken);

      expect(response.status).toBe(201);
      expect((response.body as ShareLinkBody).token).toBe(first.token);
      await expect(reportStatus(reportId)).resolves.toBe('approved');
    });

    it('kimliksiz istek 401 doner', async () => {
      const response = await createLink(await createReport());

      expect(response.status).toBe(401);
    });

    it('baska kullaniciya ait tutanak icin 403 FORBIDDEN doner (kriter 6)', async () => {
      const response = await createLink(await createReport(), otherToken);

      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
    });

    it('var olmayan tutanak icin 404 NOT_FOUND doner (kriter 6)', async () => {
      const response = await createLink(UNKNOWN_UUID, ownerToken);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('NOT_FOUND');
    });

    it('uuid bicimine uymayan kimlik de 404 doner (T-005 karari)', async () => {
      const response = await createLink(MALFORMED_ID, ownerToken);

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/v1/reports/{reportId}/share-link', () => {
    it('link uretilmeden once 404 SHARE_LINK_NOT_FOUND doner', async () => {
      const response = await getLink(await createReport(), ownerToken);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('SHARE_LINK_NOT_FOUND');
    });

    it('uretilmis linki ayni token ile doner', async () => {
      const reportId = await createReport();
      const created = (await createLink(reportId, ownerToken)).body as ShareLinkBody;

      const response = await getLink(reportId, ownerToken);

      expect(response.status).toBe(200);
      expect((response.body as ShareLinkBody).token).toBe(created.token);
    });

    it('baska kullanici linki okuyamaz (403)', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);

      const response = await getLink(reportId, otherToken);

      expect(response.status).toBe(403);
    });
  });

  describe('whatsAppUrl (kriter 5)', () => {
    it('paylasim linkini iceren onceden doldurulmus wa.me URL"si uretilir', async () => {
      const response = await createLink(await createReport(), ownerToken);

      const body = response.body as ShareLinkBody;
      const whatsAppUrl = new URL(body.whatsAppUrl);
      expect(whatsAppUrl.origin).toBe('https://wa.me');
      expect(whatsAppUrl.searchParams.get('text')).toContain(body.url);
    });
  });

  describe('POST /api/v1/reports/{reportId}/share-link/email (kriter 4)', () => {
    it('link varken 202 + status=sent doner; e-posta govdesi paylasim linkini icerir', async () => {
      const reportId = await createReport();
      const link = (await createLink(reportId, ownerToken)).body as ShareLinkBody;
      const sentBefore = email.sentEmails.length;

      const response = await sendEmail(reportId, { recipientEmail: RECIPIENT }, ownerToken);

      expect(response.status).toBe(202);
      const body = response.body as ShareDeliveryBody;
      expect(body.channel).toBe('email');
      expect(body.recipientEmail).toBe(RECIPIENT);
      expect(body.status).toBe('sent');
      expect(body.errorMessage).toBeNull();
      expect(email.sentEmails).toHaveLength(sentBefore + 1);
      expect(email.sentEmails.at(-1)?.to).toBe(RECIPIENT);
      expect(email.sentEmails.at(-1)?.text).toContain(link.url);

      // Teslim kaydi denetlenebilir sekilde yazilir (share_deliveries).
      const delivery = await prisma.shareDelivery.findUniqueOrThrow({ where: { id: body.id } });
      expect(delivery.status).toBe('sent');
      expect(delivery.recipientEmail).toBe(RECIPIENT);
    });

    it('saglayici hatasinda 202 + status=failed + errorMessage doner (502 DONMEZ, §4.2.2)', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);
      email.failNextWith('E-posta sağlayıcısına ulaşılamadı.');

      const response = await sendEmail(reportId, { recipientEmail: RECIPIENT }, ownerToken);

      expect(response.status).toBe(202);
      const body = response.body as ShareDeliveryBody;
      expect(body.status).toBe('failed');
      expect(body.errorMessage).toBe('E-posta sağlayıcısına ulaşılamadı.');

      // Kayit `failed` + neden ile yazilir (DDL CHECK: failed ise error_message zorunlu).
      const delivery = await prisma.shareDelivery.findUniqueOrThrow({ where: { id: body.id } });
      expect(delivery.status).toBe('failed');
      expect(delivery.errorMessage).toBe('E-posta sağlayıcısına ulaşılamadı.');

      // Paylasim linki gecerliligini korur: kullanici wa.me/kopyalama ile devam edebilir.
      const linkAfter = await getLink(reportId, ownerToken);
      expect(linkAfter.status).toBe(200);
    });

    it('link yokken 404 SHARE_LINK_NOT_FOUND doner; link URETMEZ ve durum DEGISMEZ (§3.10)', async () => {
      const reportId = await createReport();

      const response = await sendEmail(reportId, { recipientEmail: RECIPIENT }, ownerToken);

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('SHARE_LINK_NOT_FOUND');
      await expect(prisma.shareLink.count({ where: { reportId } })).resolves.toBe(0);
      await expect(reportStatus(reportId)).resolves.toBe('draft');
    });

    it('e-posta gonderimi tutanak durumunu DEGISTIRMEZ (§3.10)', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);

      await sendEmail(reportId, { recipientEmail: RECIPIENT }, ownerToken);

      await expect(reportStatus(reportId)).resolves.toBe('shared');
    });

    it('gecersiz e-posta adresi 400 + alan bazli hata doner', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);

      const response = await sendEmail(reportId, { recipientEmail: 'gecersiz' }, ownerToken);

      expect(response.status).toBe(400);
      const body = response.body as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details?.some((detail) => detail.field === 'recipientEmail')).toBe(true);
    });

    it('govdedeki beyaz liste disi alan 400 uretir (forbidNonWhitelisted, §3.7)', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);

      const response = await sendEmail(
        reportId,
        { recipientEmail: RECIPIENT, subject: 'ele gecirilmis konu' },
        ownerToken,
      );

      expect(response.status).toBe(400);
    });

    it('baska kullaniciya ait tutanak icin 403 doner ve e-posta gonderilmez (kriter 6)', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);
      const sentBefore = email.sentEmails.length;

      const response = await sendEmail(reportId, { recipientEmail: RECIPIENT }, otherToken);

      expect(response.status).toBe(403);
      expect(email.sentEmails).toHaveLength(sentBefore);
    });

    it('kimliksiz istek 401 doner', async () => {
      const reportId = await createReport();
      await createLink(reportId, ownerToken);

      const response = await sendEmail(reportId, { recipientEmail: RECIPIENT });

      expect(response.status).toBe(401);
    });
  });
});
