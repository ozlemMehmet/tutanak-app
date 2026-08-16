// T-009 — kiracinin hesap acmadan, paylasim linki uzerinden tutanagi SALT-OKUNUR
// goruntulemesi (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur ve gercek HTTP
// katmanindan gecer; obje depolama FakeStorageAdapter ile degistirilir (fotograf URL'leri
// icin gercek ag cagrisi yapilmaz). Goruntuleme istekleri Authorization basligi TASIMAZ:
// kabul kriteri 4'un kaniti, istegin kimliksiz gonderilmesidir.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { FakeStorageAdapter } from '../src/infra/storage/fake-storage.adapter';
import { STORAGE_PORT } from '../src/infra/storage/storage.port';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';
import { createApproval } from './factories/approval.factory';
import { createPhotoBytes } from './factories/photo.factory';

const TEST_DATABASE_NAME = 'tutanak_t009_public_report_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';
const PUBLIC_APP_URL = 'http://localhost:5173';

const TITLE = 'Kadikoy 3+1 teslim tutanagi';
const NOTE = 'Salon duvarinda cizik var, mutfak dolabi saglam.';
// Var olmayan ama bicimsel olarak gecerli token (43 karakter, base64url).
const UNKNOWN_TOKEN = 'bilinmeyen-token_bilinmeyen-token_bilinmey1';
// DB damgasi host saatinden kayabilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

interface PublicPhotoBody {
  id: string;
  capturedAt: string;
  url: string;
}

interface PublicReportBody {
  title: string;
  templateName: string;
  note: string;
  photos: PublicPhotoBody[];
  status: string;
  createdAt: string;
  isApproved: boolean;
  disclaimer: string;
  approval?: { id: string; approverEmail: string; approvedAt: string };
}

interface ErrorBody {
  error: { code: string; message: string; traceId: string };
}

describe('T-009 oturumsuz (hesapsiz) tutanak goruntuleme', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let storage: FakeStorageAdapter;
  let ownerToken: string;
  let templateId: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  /** KIMLIKSIZ istek: Authorization basligi bilerek EKLENMEZ (kriter 1 ve 4). */
  const viewPublic = (shareToken: string): request.Test =>
    request(httpServer()).get(`/api/v1/public/reports/${shareToken}`);

  const registerAndLogin = async (emailAddress: string): Promise<string> => {
    await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailAddress, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailAddress, password: PASSWORD });
    return (login.body as { accessToken: string }).accessToken;
  };

  const createReport = async (title = TITLE, note = NOTE): Promise<string> => {
    const created = await request(httpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ templateId, title, note });
    return (created.body as { id: string }).id;
  };

  const addPhoto = async (reportId: string): Promise<void> => {
    const bytes = await createPhotoBytes();
    await request(httpServer())
      .post(`/api/v1/reports/${reportId}/photos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', bytes, 'kare.jpg');
  };

  /** Paylasim linki (T-008); kiraci token'i YALNIZCA bu yanittan ogrenir. */
  const issueShareToken = async (reportId: string): Promise<string> => {
    const response = await request(httpServer())
      .post(`/api/v1/reports/${reportId}/share-link`)
      .set('Authorization', `Bearer ${ownerToken}`);
    return (response.body as { token: string }).token;
  };

  const sharedReportWithPhoto = async (): Promise<{ reportId: string; shareToken: string }> => {
    const reportId = await createReport();
    await addPhoto(reportId);
    return { reportId, shareToken: await issueShareToken(reportId) };
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
    // T-006: obje depolama anahtarlari; saglayici FakeStorageAdapter ile degistirilir.
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';
    // T-008: e-posta gonderen adresi zorunlu; bu suite e-posta gondermez.
    process.env.EMAIL_FROM = 'Tutanak <noreply@ornek.test>';
    // T-024/S-03 ile zorunlu hale geldi (varsayilani YOK); uygulama bu deger olmadan ACILMAZ.
    process.env.PAYMENT_PROVIDER = 'fake';

    const { AppModule } = await import('../src/app.module');
    const { configureApiApp } = await import('../src/main');

    storage = new FakeStorageAdapter();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_PORT)
      .useValue(storage)
      .compile();
    app = configureApiApp(moduleRef.createNestApplication());
    await app.init();

    ownerToken = await registerAndLogin('kaan-t009@ornek.test');

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

  describe('GET /api/v1/public/reports/{shareToken} — kriter 1', () => {
    it('kimlik dogrulamasi OLMADAN 200 + baslik, sablon adi, not ve tarih damgasi doner', async () => {
      const before = Date.now();
      const { shareToken } = await sharedReportWithPhoto();
      const after = Date.now();

      const response = await viewPublic(shareToken);

      expect(response.status).toBe(200);
      const body = response.body as PublicReportBody;
      expect(body.title).toBe(TITLE);
      expect(body.note).toBe(NOTE);
      expect(body.templateName).not.toBe('');
      expect(body.status).toBe('shared');
      expect(body.isApproved).toBe(false);
      expect(body.disclaimer).not.toBe('');

      const createdAt = new Date(body.createdAt).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(createdAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('sablon adi seed edilmis sablonun adiyla birebir ayni gelir', async () => {
      const { shareToken } = await sharedReportWithPhoto();
      const template = await prisma.template.findUniqueOrThrow({ where: { id: templateId } });

      const response = await viewPublic(shareToken);

      expect((response.body as PublicReportBody).templateName).toBe(template.name);
    });

    it('her fotografi kendi tarih-saat damgasi ve goruntulenebilir URL ile doner', async () => {
      const before = Date.now();
      const { shareToken } = await sharedReportWithPhoto();
      const after = Date.now();

      const body = (await viewPublic(shareToken)).body as PublicReportBody;

      expect(body.photos).toHaveLength(1);
      const [photo] = body.photos;
      expect(photo?.url).toContain('https://depolama.test/');
      const capturedAt = new Date(photo?.capturedAt ?? '').getTime();
      expect(capturedAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(capturedAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('fotograflari yukleme sirasinda (sort_order, captured_at) doner (§3.14)', async () => {
      const reportId = await createReport();
      await addPhoto(reportId);
      await addPhoto(reportId);
      const shareToken = await issueShareToken(reportId);

      const body = (await viewPublic(shareToken)).body as PublicReportBody;

      const stored = await prisma.reportPhoto.findMany({
        where: { reportId },
        orderBy: [{ sortOrder: 'asc' }, { capturedAt: 'asc' }],
        select: { id: true },
      });
      expect(body.photos.map((photo) => photo.id)).toEqual(stored.map((photo) => photo.id));
    });

    it('fotografsiz paylasilan tutanakta bos fotograf dizisi + 200 doner', async () => {
      const reportId = await createReport('Fotografsiz tutanak');
      const shareToken = await issueShareToken(reportId);

      const response = await viewPublic(shareToken);

      expect(response.status).toBe(200);
      expect((response.body as PublicReportBody).photos).toEqual([]);
    });

    it('her token yalnizca KENDI tutanaginin icerigini doner', async () => {
      const first = await createReport('Birinci tutanak');
      const second = await createReport('Ikinci tutanak');
      const firstToken = await issueShareToken(first);
      const secondToken = await issueShareToken(second);

      const firstBody = (await viewPublic(firstToken)).body as PublicReportBody;
      const secondBody = (await viewPublic(secondToken)).body as PublicReportBody;

      expect(firstBody.title).toBe('Birinci tutanak');
      expect(secondBody.title).toBe('Ikinci tutanak');
    });

    it('onaylanmis tutanakta isApproved true ve onay bilgisi doner', async () => {
      const { reportId, shareToken } = await sharedReportWithPhoto();
      const shareLink = await prisma.shareLink.findUniqueOrThrow({ where: { reportId } });
      await createApproval(prisma, { reportId, shareLinkId: shareLink.id });
      await prisma.report.update({ where: { id: reportId }, data: { status: 'approved' } });

      const body = (await viewPublic(shareToken)).body as PublicReportBody;

      expect(body.isApproved).toBe(true);
      expect(body.status).toBe('approved');
      expect(body.approval?.approverEmail).toBe('kiraci@ornek.test');
    });
  });

  describe('GET /api/v1/public/reports/{shareToken} — kriter 2 (gecersiz token)', () => {
    it('var olmayan token icin 404 SHARE_LINK_NOT_FOUND zarfi doner', async () => {
      const response = await viewPublic(UNKNOWN_TOKEN);

      expect(response.status).toBe(404);
      const body = response.body as ErrorBody;
      expect(body.error.code).toBe('SHARE_LINK_NOT_FOUND');
      expect(body.error.message).not.toBe('');
      expect(body.error.traceId).not.toBe('');
    });

    it('bicimsiz (cok kisa) token icin de 404 doner — 400/500 DEGIL', async () => {
      const response = await viewPublic('abc');

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('SHARE_LINK_NOT_FOUND');
    });

    it('URL-kodlanmis/ozel karakterli token icin de 404 doner', async () => {
      const response = await viewPublic(encodeURIComponent("' OR 1=1 --"));

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('SHARE_LINK_NOT_FOUND');
    });

    it('hata yaniti tutanak icerigini SIZDIRMAZ', async () => {
      await sharedReportWithPhoto();

      const response = await viewPublic(UNKNOWN_TOKEN);

      expect(JSON.stringify(response.body)).not.toContain(TITLE);
      expect(JSON.stringify(response.body)).not.toContain(NOTE);
    });
  });

  describe('salt-okunurluk — kriter 3', () => {
    it('yanit yalnizca sozlesmedeki PublicReportView alanlarini tasir (ic kimlikler yok)', async () => {
      const { shareToken } = await sharedReportWithPhoto();

      const response = await viewPublic(shareToken);

      expect(Object.keys(response.body as PublicReportBody).sort()).toEqual([
        'createdAt',
        'disclaimer',
        'isApproved',
        'note',
        'photos',
        'status',
        'templateName',
        'title',
      ]);
      const raw = JSON.stringify(response.body);
      expect(raw).not.toContain('ownerId');
      expect(raw).not.toContain('storageKey');
      expect(raw).not.toContain('reportId');
      expect(raw).not.toContain(shareToken);
    });

    it('her fotograf yalnizca id, damga ve URL tasir', async () => {
      const { shareToken } = await sharedReportWithPhoto();

      const body = (await viewPublic(shareToken)).body as PublicReportBody;

      expect(Object.keys(body.photos[0] ?? {}).sort()).toEqual(['capturedAt', 'id', 'url']);
    });

    it('ayni token uzerinde yazma metodlari (POST/PUT/PATCH/DELETE) tanimli DEGILDIR', async () => {
      const { shareToken } = await sharedReportWithPhoto();
      const path = `/api/v1/public/reports/${shareToken}`;

      // Istek nesneleri SIRAYLA kurulup gonderilir: supertest her istek icin sunucuyu
      // gecici bir portta dinletip kapattigi icin toplu kurulum/paralel gonderim
      // baglanti hatasi uretir (urun davranisi degil, test kosum artefakti).
      const attempts: ((path: string) => request.Test)[] = [
        (target) => request(httpServer()).post(target).send({ title: 'ele gecirildi' }),
        (target) => request(httpServer()).put(target).send({ title: 'ele gecirildi' }),
        (target) => request(httpServer()).patch(target).send({ title: 'ele gecirildi' }),
        (target) => request(httpServer()).delete(target),
      ];

      for (const attempt of attempts) {
        // Yazma route'u TANIMLI DEGIL: istek hicbir handler'a ulasmadan 404 olur.
        await attempt(path).expect(404);
      }
    });

    it('goruntuleme tutanagi DEGISTIRMEZ: durum, baslik ve fotograf sayisi aynen kalir', async () => {
      const { reportId, shareToken } = await sharedReportWithPhoto();
      const before = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });

      await viewPublic(shareToken).expect(200);
      await viewPublic(shareToken).expect(200);

      const after = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
      expect(after.status).toBe(before.status);
      expect(after.title).toBe(before.title);
      expect(after.updatedAt.toISOString()).toBe(before.updatedAt.toISOString());
      await expect(prisma.reportPhoto.count({ where: { reportId } })).resolves.toBe(1);
    });
  });

  describe('oturumsuzluk — kriter 4', () => {
    it('kayit/giris adimi olmadan, yalnizca linkteki token ile icerik goruntulenir', async () => {
      const { shareToken } = await sharedReportWithPhoto();

      // Kiracinin tarayicisi: hicbir kimlik bilgisi (Authorization/cookie) gondermez.
      const response = await request(httpServer())
        .get(`/api/v1/public/reports/${shareToken}`)
        .set('Cookie', '');

      expect(response.status).toBe(200);
      expect((response.body as PublicReportBody).title).toBe(TITLE);
      // Sunucu da oturum kurmaz: yanitta oturum cerezi yoktur.
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('goruntuleme sirasinda yeni bir kullanici hesabi olusmaz', async () => {
      const { shareToken } = await sharedReportWithPhoto();
      const usersBefore = await prisma.user.count();

      await viewPublic(shareToken).expect(200);

      await expect(prisma.user.count()).resolves.toBe(usersBefore);
    });

    it('gecersiz bir Authorization basligi gonderilse bile goruntuleme calisir (route @Public)', async () => {
      const { shareToken } = await sharedReportWithPhoto();

      const response = await request(httpServer())
        .get(`/api/v1/public/reports/${shareToken}`)
        .set('Authorization', 'Bearer gecersiz.jwt.token');

      expect(response.status).toBe(200);
      expect((response.body as PublicReportBody).title).toBe(TITLE);
    });
  });
});
