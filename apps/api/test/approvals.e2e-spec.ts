// T-010 — karsi tarafin (kiracinin) paylasim linki uzerinden tek tikla onayi
// (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur, belgelenen npm script'leriyle
// migration + seed kosar ve gercek HTTP katmanindan gecer; obje depolama
// FakeStorageAdapter ile degistirilir, PDF uretimi (PDFKit + sharp) GERCEKTIR.
//
// Onay istekleri Authorization basligi TASIMAZ: kiracinin hesabi yoktur.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { FakeStorageAdapter } from '../src/infra/storage/fake-storage.adapter';
import { STORAGE_PORT } from '../src/infra/storage/storage.port';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';
import { createPhotoBytes } from './factories/photo.factory';
import { extractPdfText } from './pdf-text';

const TEST_DATABASE_NAME = 'tutanak_t010_approvals_test';
const MIGRATION_TIMEOUT_MS = 180_000;
const PDF_TIMEOUT_MS = 30_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';
const PUBLIC_APP_URL = 'http://localhost:5173';

const TITLE = 'Kadikoy 3+1 teslim tutanagi';
const NOTE = 'Salon duvarinda cizik var, mutfak dolabi saglam.';
const APPROVER_EMAIL = 'kiraci@ornek.test';
// Var olmayan ama bicimsel olarak gecerli token (43 karakter, base64url).
const UNKNOWN_TOKEN = 'bilinmeyen-token_bilinmeyen-token_bilinmey1';
// DB damgasi host saatinden kayabilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

/** Sozlesmedeki uyari metninin cekirdegi (PublicReportView.disclaimer). */
const DISCLAIMER_CORE = 'resmi hukuki delil değildir, destekleyici kanıttır';

interface ApprovalBody {
  id: string;
  approverEmail: string;
  approvedAt: string;
}

interface PublicReportBody {
  status: string;
  isApproved: boolean;
  disclaimer: string;
  approval?: ApprovalBody;
}

interface ReportDetailBody {
  id: string;
  status: string;
  approval?: ApprovalBody;
}

interface ErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
    traceId: string;
  };
}

/** PDF damgasinin beklenen metni; uretim tarafiyla ayni saat dilimi (Europe/Istanbul). */
function expectedStamp(isoTimestamp: string): string {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'Europe/Istanbul',
  }).format(new Date(isoTimestamp));
}

describe('T-010 tek tikla taraf onayi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let storage: FakeStorageAdapter;
  let ownerToken: string;
  let templateId: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  /** KIMLIKSIZ istek: Authorization basligi bilerek EKLENMEZ. */
  const viewPublic = (shareToken: string): request.Test =>
    request(httpServer()).get(`/api/v1/public/reports/${shareToken}`);

  const approve = (shareToken: string, body: unknown): request.Test =>
    request(httpServer())
      .post(`/api/v1/public/reports/${shareToken}/approval`)
      .send(body as object);

  const registerAndLogin = async (emailAddress: string): Promise<string> => {
    await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email: emailAddress, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailAddress, password: PASSWORD });
    return (login.body as { accessToken: string }).accessToken;
  };

  const createReport = async (): Promise<string> => {
    const created = await request(httpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ templateId, title: TITLE, note: NOTE });
    return (created.body as { id: string }).id;
  };

  const addPhoto = async (reportId: string): Promise<void> => {
    await request(httpServer())
      .post(`/api/v1/reports/${reportId}/photos`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .attach('file', await createPhotoBytes(), 'kare.jpg');
  };

  const issueShareToken = async (reportId: string): Promise<string> => {
    const response = await request(httpServer())
      .post(`/api/v1/reports/${reportId}/share-link`)
      .set('Authorization', `Bearer ${ownerToken}`);
    return (response.body as { token: string }).token;
  };

  /** Fotografi olan, paylasilmis (status = shared) bir tutanak kurar. */
  const sharedReport = async (): Promise<{ reportId: string; shareToken: string }> => {
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
    process.env.SUBSCRIPTION_PRICE_AMOUNT = '199.00';
    process.env.PUBLIC_APP_URL = PUBLIC_APP_URL;
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';
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

    ownerToken = await registerAndLogin('kaan-t010@ornek.test');

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

  describe('uyari metni — kriter 1', () => {
    it('onay ONCESI goruntuleme yaniti "resmi hukuki delil değildir, destekleyici kanıttır" uyarisini tasir', async () => {
      const { shareToken } = await sharedReport();

      const response = await viewPublic(shareToken);

      const body = response.body as PublicReportBody;
      expect(response.status).toBe(200);
      expect(body.disclaimer).toContain(DISCLAIMER_CORE);
      expect(body.isApproved).toBe(false);
      expect(body.approval).toBeUndefined();
    });

    it('onay SONRASI da uyari metni yanitta kalir (metin duruma bagli degildir)', async () => {
      const { shareToken } = await sharedReport();
      await approve(shareToken, { approverEmail: APPROVER_EMAIL });

      const body = (await viewPublic(shareToken)).body as PublicReportBody;

      expect(body.disclaimer).toContain(DISCLAIMER_CORE);
      expect(body.isApproved).toBe(true);
      expect(body.approval?.approverEmail).toBe(APPROVER_EMAIL);
    });
  });

  describe('POST /api/v1/public/reports/{shareToken}/approval — kriter 2', () => {
    it('kimlik dogrulamasi OLMADAN 201 + zaman damgasi ve e-posta iceren onay kaydi doner', async () => {
      const { shareToken } = await sharedReport();

      const before = Date.now();
      const response = await approve(shareToken, { approverEmail: APPROVER_EMAIL });
      const after = Date.now();

      expect(response.status).toBe(201);
      const body = response.body as ApprovalBody;
      expect(body.approverEmail).toBe(APPROVER_EMAIL);
      expect(body.id).not.toBe('');
      const approvedAt = new Date(body.approvedAt).getTime();
      expect(approvedAt).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
      expect(approvedAt).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
    });

    it('onay kaydini tutanak ve paylasim linki ile iliskilendirerek veritabanina yazar', async () => {
      const { reportId, shareToken } = await sharedReport();

      const response = await approve(shareToken, { approverEmail: APPROVER_EMAIL });

      const stored = await prisma.approval.findUniqueOrThrow({ where: { reportId } });
      expect(stored.id).toBe((response.body as ApprovalBody).id);
      expect(stored.approverEmail).toBe(APPROVER_EMAIL);
      const link = await prisma.shareLink.findUniqueOrThrow({ where: { token: shareToken } });
      expect(stored.shareLinkId).toBe(link.id);
    });

    it('yanit govdesi yalnizca sozlesmedeki Approval alanlarini tasir (ic alan sizmaz)', async () => {
      const { shareToken } = await sharedReport();

      const response = await approve(shareToken, { approverEmail: APPROVER_EMAIL });

      expect(Object.keys(response.body as object).sort()).toEqual([
        'approvedAt',
        'approverEmail',
        'id',
      ]);
    });

    it('gecersiz paylasim tokeni ile gonderilen onay 404 SHARE_LINK_NOT_FOUND doner', async () => {
      const response = await approve(UNKNOWN_TOKEN, { approverEmail: APPROVER_EMAIL });

      expect(response.status).toBe(404);
      const body = response.body as ErrorBody;
      expect(body.error.code).toBe('SHARE_LINK_NOT_FOUND');
      expect(body.error.message).not.toContain(UNKNOWN_TOKEN);
      expect(await prisma.approval.count({ where: { approverEmail: 'yok@ornek.test' } })).toBe(0);
    });
  });

  describe('dogrulama — kriter 3', () => {
    it('e-posta alani BOS birakilirsa 400 + alan bazli hata doner ve onay kaydi olusmaz', async () => {
      const { reportId, shareToken } = await sharedReport();

      const response = await approve(shareToken, { approverEmail: '' });

      expect(response.status).toBe(400);
      const body = response.body as ErrorBody;
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details?.[0]?.field).toBe('approverEmail');
      expect(await prisma.approval.count({ where: { reportId } })).toBe(0);
    });

    it('e-posta alani HIC gonderilmezse 400 + alan bazli hata doner', async () => {
      const { shareToken } = await sharedReport();

      const response = await approve(shareToken, {});

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details?.[0]?.field).toBe('approverEmail');
    });

    it('bicimsel olarak gecersiz e-posta 400 doner', async () => {
      const { shareToken } = await sharedReport();

      const response = await approve(shareToken, { approverEmail: 'kiraci-at-ornek' });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('beyaz liste disi ek alan tasiyan istek 400 doner (govde katiligi — §3.7)', async () => {
      const { shareToken } = await sharedReport();

      const response = await approve(shareToken, {
        approverEmail: APPROVER_EMAIL,
        // Damga istemciden OKUNMAZ; alan yok sayilmaz, istek reddedilir.
        approvedAt: '2000-01-01T00:00:00.000Z',
      });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('gecersiz istek tutanagin durumunu degistirmez (shared kalir)', async () => {
      const { reportId, shareToken } = await sharedReport();

      await approve(shareToken, { approverEmail: '' });

      const report = await prisma.report.findUniqueOrThrow({ where: { id: reportId } });
      expect(report.status).toBe('shared');
    });
  });

  describe('mukerrer onay — kriter 4', () => {
    it('ayni link uzerinden ikinci onay istegi 409 REPORT_ALREADY_APPROVED doner', async () => {
      const { shareToken } = await sharedReport();
      await approve(shareToken, { approverEmail: APPROVER_EMAIL });

      const second = await approve(shareToken, { approverEmail: 'baska-kiraci@ornek.test' });

      expect(second.status).toBe(409);
      expect((second.body as ErrorBody).error.code).toBe('REPORT_ALREADY_APPROVED');
    });

    it('ikinci istek MUKERRER kayit olusturmaz ve ilk onayin damgasini degistirmez', async () => {
      const { reportId, shareToken } = await sharedReport();
      const first = (await approve(shareToken, { approverEmail: APPROVER_EMAIL }))
        .body as ApprovalBody;

      await approve(shareToken, { approverEmail: 'baska-kiraci@ornek.test' });

      expect(await prisma.approval.count({ where: { reportId } })).toBe(1);
      const stored = await prisma.approval.findUniqueOrThrow({ where: { reportId } });
      expect(stored.id).toBe(first.id);
      expect(stored.approverEmail).toBe(APPROVER_EMAIL);
      expect(stored.approvedAt.toISOString()).toBe(new Date(first.approvedAt).toISOString());
    });
  });

  describe('onaylanmis tutanagin PDF ciktisi — kriter 5', () => {
    it(
      'onaydan sonra yeniden uretilen PDF onay damgasini ve onaylayan e-postayi tasir',
      async () => {
        const { reportId, shareToken } = await sharedReport();
        const approval = (await approve(shareToken, { approverEmail: APPROVER_EMAIL }))
          .body as ApprovalBody;

        const response = await request(httpServer())
          .get(`/api/v1/reports/${reportId}/pdf`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .responseType('blob');

        expect(response.status).toBe(200);
        const text = extractPdfText(response.body as Buffer);
        expect(text).toContain(APPROVER_EMAIL);
        expect(text).toContain(expectedStamp(approval.approvedAt));
      },
      PDF_TIMEOUT_MS,
    );

    it(
      'onaylanmamis tutanagin PDF ciktisinda onay blogu YOKTUR',
      async () => {
        const { reportId } = await sharedReport();

        const response = await request(httpServer())
          .get(`/api/v1/reports/${reportId}/pdf`)
          .set('Authorization', `Bearer ${ownerToken}`)
          .responseType('blob');

        expect(extractPdfText(response.body as Buffer)).not.toContain('Onaylayan');
      },
      PDF_TIMEOUT_MS,
    );
  });

  describe('durum guncellemesi ve sahibin sorgusu — kriter 6', () => {
    it('onay sonrasi tutanagin durumu approved olur ve sahibi GET /reports/{id} ile gorur', async () => {
      const { reportId, shareToken } = await sharedReport();
      const approval = (await approve(shareToken, { approverEmail: APPROVER_EMAIL }))
        .body as ApprovalBody;

      const detail = await request(httpServer())
        .get(`/api/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const body = detail.body as ReportDetailBody;
      expect(detail.status).toBe(200);
      expect(body.status).toBe('approved');
      expect(body.approval).toEqual(approval);
    });

    it('onay oncesi tutanak detayinda `approval` alani HIC bulunmaz (CLAUDE.md §3.5)', async () => {
      const { reportId } = await sharedReport();

      const detail = await request(httpServer())
        .get(`/api/v1/reports/${reportId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect((detail.body as ReportDetailBody).status).toBe('shared');
      expect('approval' in (detail.body as object)).toBe(false);
    });

    it('onay tutanagin icerigini dondurur: yeni fotograf 409 ile reddedilir (§3.10)', async () => {
      const { reportId, shareToken } = await sharedReport();
      await approve(shareToken, { approverEmail: APPROVER_EMAIL });

      const response = await request(httpServer())
        .post(`/api/v1/reports/${reportId}/photos`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('file', await createPhotoBytes(), 'kare.jpg');

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).error.code).toBe('REPORT_ALREADY_APPROVED');
    });
  });
});
