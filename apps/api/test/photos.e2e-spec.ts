// T-006 — tutanaga fotograf ekleme + otomatik degistirilemez tarih-saat damgasi
// (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur, belgelenen npm script'leriyle
// migration + seed kosar ve gercek HTTP katmanindan gecer; obje depolama FakeStorageAdapter
// ile degistirilir (§8.2), goruntu isleme zinciri GERCEKTIR.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
// AppModule ve main, env dogrulamasini MODUL YUKLENIRKEN tetikler; bu yuzden
// degiskenler atandiktan SONRA dinamik import edilir (T-005 e2e testiyle ayni desen).
import { FakeStorageAdapter } from '../src/infra/storage/fake-storage.adapter';
import { STORAGE_PORT } from '../src/infra/storage/storage.port';
import { PHOTO_MAX_EDGE_PX } from '../src/modules/photos/photo-image.processor';
import {
  CHECK_VIOLATION,
  createEmptyDatabase,
  createTestPrisma,
  dropDatabase,
  expectSqlState,
  runApiScript,
} from './db';
import { createNoisyPhotoBytes, createPhotoBytes } from './factories/photo.factory';

const TEST_DATABASE_NAME = 'tutanak_t006_photos_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';
const TEST_PHOTO_MAX_PER_REPORT = 3;
const TEST_PHOTO_MAX_BYTES = 200_000;

const UNKNOWN_UUID = '99999999-9999-4999-8999-999999999999';
const MALFORMED_ID = 'tutanak-42';
// DB damgasi host saatinden kayabilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

interface PhotoBody {
  id: string;
  reportId: string;
  capturedAt: string;
  contentType: string;
  sizeBytes: number;
  widthPx: number;
  heightPx: number;
  url: string;
}

interface ErrorBody {
  error: { code: string; message: string; traceId: string; details?: { field: string }[] };
}

describe('T-006 tutanaga fotograf ekleme ve sunucu damgasi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let storage: FakeStorageAdapter;
  let ownerToken: string;
  let otherToken: string;
  let templateId: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  const uploadPhoto = (
    reportId: string,
    body: Buffer,
    options: { token?: string; filename?: string; fields?: Record<string, string> } = {},
  ): request.Test => {
    const test = request(httpServer()).post(`/api/v1/reports/${reportId}/photos`);
    if (options.token !== undefined) {
      test.set('Authorization', `Bearer ${options.token}`);
    }
    for (const [name, value] of Object.entries(options.fields ?? {})) {
      test.field(name, value);
    }
    return test.attach('file', body, options.filename ?? 'kamera.jpg');
  };

  const listPhotos = (reportId: string, token?: string): request.Test => {
    const test = request(httpServer()).get(`/api/v1/reports/${reportId}/photos`);
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  const registerAndLogin = async (email: string): Promise<string> => {
    await request(httpServer()).post('/api/v1/auth/register').send({ email, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    return (login.body as { accessToken: string }).accessToken;
  };

  const createReport = async (token: string, title = 'Fotografli tutanak'): Promise<string> => {
    const created = await request(httpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId, title });
    return (created.body as { id: string }).id;
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
    // T-012 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    // Bu dosya bunlari kendisi ATAMALIDIR: aksi halde deger yalnizca ayni surecte daha once
    // kosan bir spec'ten sizdigi icin gelir ve suite sirasi degisince kosum kirmiziya doner.
    process.env.SUBSCRIPTION_PRICE_AMOUNT = '199.00';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    // T-008 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.EMAIL_FROM = 'Tutanak <noreply@ornek.test>';
    // T-024/S-03 ile zorunlu hale geldi (varsayilani YOK); uygulama bu deger olmadan ACILMAZ.
    process.env.PAYMENT_PROVIDER = 'fake';
    // Obje depolama saglayicisi testte sahtelendigi icin bu degerler yalnizca sema
    // dogrulamasini gecmek icindir; hicbir ag cagrisi yapilmaz (CLAUDE.md §5).
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';
    process.env.PHOTO_MAX_PER_REPORT = String(TEST_PHOTO_MAX_PER_REPORT);
    process.env.PHOTO_MAX_BYTES = String(TEST_PHOTO_MAX_BYTES);

    const { AppModule } = await import('../src/app.module');
    const { configureApiApp } = await import('../src/main');

    storage = new FakeStorageAdapter();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(STORAGE_PORT)
      .useValue(storage)
      .compile();
    app = configureApiApp(moduleRef.createNestApplication());
    await app.init();

    ownerToken = await registerAndLogin('kaan-t006@ornek.test');
    otherToken = await registerAndLogin('baska-t006@ornek.test');

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

  describe('POST /api/v1/reports/{reportId}/photos', () => {
    it('taslak tutanaga yuklenen fotograf icin 201 + kimlik ve damga doner', async () => {
      const reportId = await createReport(ownerToken);
      const before = Date.now();

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });
      const after = Date.now();

      expect(response.status).toBe(201);
      const body = response.body as PhotoBody;
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.reportId).toBe(reportId);
      expect(body.contentType).toBe('image/jpeg');
      expect(body.widthPx).toBe(16);
      expect(body.heightPx).toBe(12);
      expect(body.sizeBytes).toBeGreaterThan(0);
      expect(body.url).toMatch(/^https:\/\//);

      // Damga sunucu saatinde uretilir; iki tarafli tolerans penceresi (CLAUDE.md §8.5).
      const capturedAt = new Date(body.capturedAt).getTime();
      expect(capturedAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(capturedAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('yanit yalnizca sozlesmedeki Photo alanlarini tasir (storage_key sizmaz)', async () => {
      const reportId = await createReport(ownerToken);

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });

      expect(Object.keys(response.body as PhotoBody).sort()).toEqual([
        'capturedAt',
        'contentType',
        'heightPx',
        'id',
        'reportId',
        'sizeBytes',
        'url',
        'widthPx',
      ]);
    });

    it('damga veritabaninda sunucu saatiyle yazilir; istemci gonderemez', async () => {
      const reportId = await createReport(ownerToken);
      const before = Date.now();

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });
      const after = Date.now();

      const stored = await prisma.reportPhoto.findUnique({
        where: { id: (response.body as PhotoBody).id },
      });
      const capturedAt = stored?.capturedAt.getTime() ?? 0;
      expect(capturedAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(capturedAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('govdeye eklenen capturedAt alani 400 URETMEZ; damga yine sunucu saatindedir', async () => {
      // CLAUDE.md §3.7 istisna 1 + §8.2 zorunlu senaryo: multipart govdede `file` disindaki
      // alanlar SESSIZCE yok sayilir.
      const reportId = await createReport(ownerToken);
      const gecmisTarih = '2001-01-01T00:00:00.000Z';
      const before = Date.now();

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
        fields: { capturedAt: gecmisTarih, sortOrder: '99', reportId: UNKNOWN_UUID },
      });
      const after = Date.now();

      expect(response.status).toBe(201);
      const body = response.body as PhotoBody;
      expect(body.capturedAt).not.toBe(gecmisTarih);
      expect(body.reportId).toBe(reportId);

      const capturedAt = new Date(body.capturedAt).getTime();
      expect(capturedAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(capturedAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);

      const stored = await prisma.reportPhoto.findUnique({ where: { id: body.id } });
      expect(stored?.capturedAt.getFullYear()).not.toBe(2001);
      expect(stored?.sortOrder).toBe(0);
    });

    it('fotograf icerigi obje depolamaya yazilir; veritabaninda ikili icerik tutulmaz', async () => {
      const reportId = await createReport(ownerToken);
      const oncekiSayi = storage.storedCount;

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });

      expect(storage.storedCount).toBe(oncekiSayi + 1);
      const stored = await prisma.reportPhoto.findUnique({
        where: { id: (response.body as PhotoBody).id },
      });
      // Depolama anahtari sunucuda uretilir; kullanicinin dosya adi kullanilmaz.
      expect(stored?.storageKey).toMatch(new RegExp(`^reports/${reportId}/[0-9a-f-]{36}\\.jpg$`));
      expect(stored?.storageKey).not.toContain('kamera');
    });

    it('depoya yazilan fotografin uzun kenari 1600 px ile sinirlidir (T-026)', async () => {
      // architecture.md §104: yuklenen fotograf DEPOYA kucultulmus haliyle yazilir.
      // Dogrulama, yanit alanlarindan degil DEPOLANAN BAYTLARDAN yapilir.
      const reportId = await createReport(ownerToken);
      const sharp = (await import('sharp')).default;

      const response = await uploadPhoto(
        reportId,
        await createPhotoBytes({ width: 2400, height: 3200 }),
        { token: ownerToken },
      );

      expect(response.status).toBe(201);
      const body = response.body as PhotoBody;
      const stored = await prisma.reportPhoto.findUnique({ where: { id: body.id } });
      const storedObject = storage.read(stored?.storageKey ?? '');
      const { width, height } = await sharp(storedObject?.body ?? Buffer.alloc(0)).metadata();

      expect(Math.max(width, height)).toBeLessThanOrEqual(PHOTO_MAX_EDGE_PX);
      // En-boy orani korunur ve yanit/veritabani depolanan hali yansitir.
      expect([width, height]).toEqual([1200, PHOTO_MAX_EDGE_PX]);
      expect([body.widthPx, body.heightPx]).toEqual([1200, PHOTO_MAX_EDGE_PX]);
      expect([stored?.widthPx, stored?.heightPx]).toEqual([1200, PHOTO_MAX_EDGE_PX]);
      expect(stored?.sizeBytes).toBe(storedObject?.body.length);
    });

    it('sinirin altindaki fotograf depoya OLDUGU GIBI yazilir (buyutulmez)', async () => {
      const reportId = await createReport(ownerToken);
      const sharp = (await import('sharp')).default;

      const response = await uploadPhoto(
        reportId,
        await createPhotoBytes({ width: 640, height: 480 }),
        { token: ownerToken },
      );

      const stored = await prisma.reportPhoto.findUnique({
        where: { id: (response.body as PhotoBody).id },
      });
      const storedObject = storage.read(stored?.storageKey ?? '');
      const { width, height } = await sharp(storedObject?.body ?? Buffer.alloc(0)).metadata();

      expect([width, height]).toEqual([640, 480]);
    });

    it('desteklenmeyen dosya formati (.txt) yuklendiginde 400 + hata mesaji doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await uploadPhoto(reportId, Buffer.from('bu bir metin dosyasidir'), {
        token: ownerToken,
        filename: 'notlar.txt',
      });

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('UNSUPPORTED_MEDIA_FORMAT');
      expect(envelope.message.length).toBeGreaterThan(0);
      expect(envelope.traceId).toMatch(/^[0-9a-f-]{36}$/);
      expect(await prisma.reportPhoto.count({ where: { reportId } })).toBe(0);
    });

    it('jpg uzantisi ve image/jpeg beyani ile gonderilen metin de 400 doner (beyana guvenilmez)', async () => {
      const reportId = await createReport(ownerToken);

      const response = await request(httpServer())
        .post(`/api/v1/reports/${reportId}/photos`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', Buffer.from('aslinda metin'), {
          filename: 'kamera.jpg',
          contentType: 'image/jpeg',
        });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('UNSUPPORTED_MEDIA_FORMAT');
    });

    it('izin verilmeyen goruntu bicimi (gif) 400 UNSUPPORTED_MEDIA_FORMAT doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await uploadPhoto(
        reportId,
        await createPhotoBytes({ format: 'png' }).then(async (png) => {
          const sharp = (await import('sharp')).default;
          return sharp(png).gif().toBuffer();
        }),
        { token: ownerToken, filename: 'hareketli.gif' },
      );

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('UNSUPPORTED_MEDIA_FORMAT');
    });

    it('dosya alani hic gonderilmediginde 400 VALIDATION_ERROR doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await request(httpServer())
        .post(`/api/v1/reports/${reportId}/photos`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('capturedAt', '2001-01-01T00:00:00.000Z');

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('boyut sinirini asan dosya 400 FILE_TOO_LARGE doner (413 degil)', async () => {
      const reportId = await createReport(ownerToken);
      const buyukFotograf = await createNoisyPhotoBytes(600, 600);
      expect(buyukFotograf.length).toBeGreaterThan(TEST_PHOTO_MAX_BYTES);

      const response = await uploadPhoto(reportId, buyukFotograf, {
        token: ownerToken,
        filename: 'buyuk.png',
      });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('FILE_TOO_LARGE');
      expect(await prisma.reportPhoto.count({ where: { reportId } })).toBe(0);
    });

    it('tutanak basina ust sinir asildiginda 409 PHOTO_LIMIT_REACHED doner', async () => {
      const reportId = await createReport(ownerToken);
      for (let index = 0; index < TEST_PHOTO_MAX_PER_REPORT; index += 1) {
        const kabul = await uploadPhoto(reportId, await createPhotoBytes(), {
          token: ownerToken,
        });
        expect(kabul.status).toBe(201);
      }

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).error.code).toBe('PHOTO_LIMIT_REACHED');
      expect(await prisma.reportPhoto.count({ where: { reportId } })).toBe(
        TEST_PHOTO_MAX_PER_REPORT,
      );
    });

    it('onaylanmis tutanaga yukleme 409 REPORT_ALREADY_APPROVED doner (kanit butunlugu)', async () => {
      const reportId = await createReport(ownerToken);
      // Onay akisi T-010 kapsamindadir; burada yalnizca durum on kosulu kurulur.
      await prisma.report.update({ where: { id: reportId }, data: { status: 'approved' } });

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).error.code).toBe('REPORT_ALREADY_APPROVED');
      expect(await prisma.reportPhoto.count({ where: { reportId } })).toBe(0);
    });

    it('paylasilmis (shared) tutanaga yukleme serbesttir', async () => {
      const reportId = await createReport(ownerToken);
      await prisma.report.update({ where: { id: reportId }, data: { status: 'shared' } });

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });

      expect(response.status).toBe(201);
    });

    it('baska kullaniciya ait tutanaga yukleme 403 FORBIDDEN doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: otherToken,
      });

      expect(response.status).toBe(403);
      expect((response.body as ErrorBody).error.code).toBe('FORBIDDEN');
      expect(await prisma.reportPhoto.count({ where: { reportId } })).toBe(0);
    });

    it('var olmayan tutanakta 404 NOT_FOUND doner', async () => {
      const response = await uploadPhoto(UNKNOWN_UUID, await createPhotoBytes(), {
        token: ownerToken,
      });

      expect(response.status).toBe(404);
      expect((response.body as ErrorBody).error.code).toBe('NOT_FOUND');
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await uploadPhoto(reportId, await createPhotoBytes());

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /api/v1/reports/{reportId}/photos', () => {
    it('bir tutanaga eklenen birden fazla fotografi damgalariyla ve sirali doner', async () => {
      const reportId = await createReport(ownerToken, 'Cok fotografli tutanak');
      const yuklenen: PhotoBody[] = [];
      for (let index = 0; index < 3; index += 1) {
        const response = await uploadPhoto(reportId, await createPhotoBytes(), {
          token: ownerToken,
        });
        yuklenen.push(response.body as PhotoBody);
      }

      const response = await listPhotos(reportId, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as PhotoBody[];
      expect(body).toHaveLength(3);
      expect(body.map((photo) => photo.id)).toEqual(yuklenen.map((photo) => photo.id));
      for (const photo of body) {
        expect(new Date(photo.capturedAt).getTime()).not.toBeNaN();
        expect(photo.url).toMatch(/^https:\/\//);
      }
      // Sira sunucuda atanir: ilk fotograf 0, sonrakiler +1 (CLAUDE.md §3.14).
      const stored = await prisma.reportPhoto.findMany({
        where: { reportId },
        orderBy: { sortOrder: 'asc' },
      });
      expect(stored.map((photo) => photo.sortOrder)).toEqual([0, 1, 2]);
    });

    it('her fotograf kendi damgasini tasir (damgalar paylasilmaz)', async () => {
      const reportId = await createReport(ownerToken);
      await uploadPhoto(reportId, await createPhotoBytes(), { token: ownerToken });
      await new Promise((resolve) => setTimeout(resolve, 10));
      await uploadPhoto(reportId, await createPhotoBytes(), { token: ownerToken });

      const response = await listPhotos(reportId, ownerToken);

      const body = response.body as PhotoBody[];
      expect(body[0]?.capturedAt).not.toBe(body[1]?.capturedAt);
    });

    it('fotografsiz tutanakta bos dizi doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await listPhotos(reportId, ownerToken);

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });

    it('tutanak detayi (GET /reports/{id}) ayni fotograflari damgalariyla tasir', async () => {
      const reportId = await createReport(ownerToken);
      const yuklenen = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });

      const response = await request(httpServer())
        .get(`/api/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(200);
      const body = response.body as { photos: PhotoBody[]; photoCount: number };
      expect(body.photoCount).toBe(1);
      expect(body.photos).toHaveLength(1);
      expect(body.photos[0]?.id).toBe((yuklenen.body as PhotoBody).id);
      expect(body.photos[0]?.capturedAt).toBe((yuklenen.body as PhotoBody).capturedAt);
    });

    it('baskasinin tutanagini listeleme 403, var olmayan tutanak 404 doner', async () => {
      const reportId = await createReport(ownerToken);

      await expect(listPhotos(reportId, otherToken)).resolves.toMatchObject({ status: 403 });
      await expect(listPhotos(UNKNOWN_UUID, ownerToken)).resolves.toMatchObject({ status: 404 });
      await expect(listPhotos(MALFORMED_ID, ownerToken)).resolves.toMatchObject({ status: 404 });
    });

    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const reportId = await createReport(ownerToken);

      const response = await listPhotos(reportId);

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('damganin degistirilemezligi (kabul kriteri 4)', () => {
    it('fotograf guncelleme/PATCH rotasi TANIMLI DEGILDIR ve damga degismez', async () => {
      const reportId = await createReport(ownerToken);
      const created = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });
      const photo = created.body as PhotoBody;

      const guncellemeDenemeleri: [string, string][] = [
        ['patch', `/api/v1/reports/${reportId}/photos/${photo.id}`],
        ['put', `/api/v1/reports/${reportId}/photos/${photo.id}`],
        ['patch', `/api/v1/reports/${reportId}/photos`],
        ['delete', `/api/v1/reports/${reportId}/photos/${photo.id}`],
      ];
      for (const [method, path] of guncellemeDenemeleri) {
        const response = await (
          method === 'patch'
            ? request(httpServer()).patch(path)
            : method === 'put'
              ? request(httpServer()).put(path)
              : request(httpServer()).delete(path)
        )
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({ capturedAt: '2001-01-01T00:00:00.000Z' });
        expect(response.status).toBe(404);
      }

      const stored = await prisma.reportPhoto.findUnique({ where: { id: photo.id } });
      expect(stored?.capturedAt.toISOString()).toBe(photo.capturedAt);
    });

    it('captured_at dogrudan veritabani guncellemesiyle de degistirilemez (trigger reddi)', async () => {
      const reportId = await createReport(ownerToken);
      const created = await uploadPhoto(reportId, await createPhotoBytes(), {
        token: ownerToken,
      });
      const photo = created.body as PhotoBody;

      // Ham (parametreli) SQL: SQLSTATE kodunu dogrudan gormek icin — Prisma'nin tipli
      // `update` cagrisi hatayi sarmalayip kodu meta'da tasimiyor (test/db.ts §SQLSTATE).
      await expectSqlState(
        prisma.$executeRaw`UPDATE report_photos SET captured_at = ${new Date(
          '2001-01-01T00:00:00.000Z',
        )} WHERE id = ${photo.id}::uuid`,
        CHECK_VIOLATION,
      );

      const stored = await prisma.reportPhoto.findUnique({ where: { id: photo.id } });
      expect(stored?.capturedAt.toISOString()).toBe(photo.capturedAt);
    });
  });
});
