// T-011 — gecmis tutanaklari listeleme ve arama (CLAUDE.md §8.2).
// Test kendi izole veritabanini olusturur, belgelenen npm script'leriyle migration + seed
// kosar ve gercek HTTP katmanindan gecer; her kabul kriterinin en az bir testi vardir.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';

const TEST_DATABASE_NAME = 'tutanak_t011_reports_list_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const SEARCH_TERM_MAX_LENGTH = 100;

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

interface ReportListBody {
  items: ReportBody[];
  page: number;
  pageSize: number;
  total: number;
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
}

describe('T-011 tutanak listeleme ve arama', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let ownerToken: string;
  let otherToken: string;
  let templateId: string;
  let baseDatabaseUrl: string | undefined;

  // Sabit veri kumesi (eskiden yeniye olusturulur); tum testler salt okurdur.
  const ownerReportIds: Record<string, string> = {};
  let otherReportId = '';

  const httpServer = (): Server => app.getHttpServer() as Server;

  const listReports = (query: Record<string, string> = {}, token?: string): request.Test => {
    const test = request(httpServer()).get('/api/v1/reports').query(query);
    return token === undefined ? test : test.set('Authorization', `Bearer ${token}`);
  };

  const createReport = async (token: string, title: string, note: string): Promise<ReportBody> => {
    const response = await request(httpServer())
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${token}`)
      .send({ templateId, title, note });
    return response.body as ReportBody;
  };

  const registerAndLogin = async (email: string): Promise<string> => {
    await request(httpServer()).post('/api/v1/auth/register').send({ email, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    return (login.body as { accessToken: string }).accessToken;
  };

  const titlesOf = (body: ReportListBody): string[] => body.items.map((item) => item.title);

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
    // Bu dosya hiz siniri ALTINDAKI davranisi dogrular; /auth/* uretim varsayilani 5 istek/dk
    // oldugu icin kurulum istekleri limite takilmasin diye limitler yukseltilir (T-014 kalibi).
    process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '1000';
    // T-012 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.SUBSCRIPTION_PRICE_AMOUNT = '199.00';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    // Obje depolama yapilandirmasi T-006 ile zorunlu hale geldi; bu testler depolamayi
    // kullanmaz, degerler yalnizca env semasini gecmek icindir (CLAUDE.md §5).
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';

    const { createApiApp } = await import('../src/main');
    app = await createApiApp();
    await app.init();

    ownerToken = await registerAndLogin('kaan-t011@ornek.test');
    otherToken = await registerAndLogin('baska-t011@ornek.test');

    const templates = await request(httpServer())
      .get('/api/v1/templates')
      .set('Authorization', `Bearer ${ownerToken}`);
    templateId = (templates.body as TemplateBody[])[0]?.id ?? '';

    // Sirayla olusturulur: her istek ayri transaction oldugu icin created_at damgalari
    // birbirinden farklidir; asagidaki siralama beklentileri buna dayanir (en yeni: depo).
    ownerReportIds.giris = (
      await createReport(
        ownerToken,
        'Bahcelievler 3+1 giris teslimi',
        'Kiraci Ayse Yilmaz ile teslim edildi.',
      )
    ).id;
    ownerReportIds.cikis = (
      await createReport(ownerToken, 'Kadikoy 2+1 cikis teslimi', 'Kombi bakimi yapildi.')
    ).id;
    ownerReportIds.ofis = (
      await createReport(ownerToken, 'Besiktas ofis teslimi', 'Mulk sahibi anahtari teslim aldi.')
    ).id;
    ownerReportIds.depo = (
      await createReport(ownerToken, 'Sisli depo teslimi %25 indirimli', 'Ozel karakter kaydi.')
    ).id;

    otherReportId = (
      await createReport(
        otherToken,
        'Bahcelievler 3+1 giris teslimi',
        'Baska kullanicinin kaydi, kiraci notu.',
      )
    ).id;
  }, MIGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropDatabase(TEST_DATABASE_NAME);
  }, MIGRATION_TIMEOUT_MS);

  describe('GET /api/v1/reports — kendi kayitlari (K1)', () => {
    it('giris yapmis kullaniciya 200 ve kendi tutanaklarini doner', async () => {
      const response = await listReports({}, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportListBody;
      expect(body.total).toBe(4);
      expect(body.items).toHaveLength(4);
      expect(body.page).toBe(DEFAULT_PAGE);
      expect(body.pageSize).toBe(DEFAULT_PAGE_SIZE);
    });

    it('baska kullanicinin tutanaklari listede yer almaz', async () => {
      const response = await listReports({}, ownerToken);

      const ids = (response.body as ReportListBody).items.map((item) => item.id);
      expect(ids).toEqual(expect.arrayContaining(Object.values(ownerReportIds)));
      expect(ids).not.toContain(otherReportId);
    });

    it('her kullanici yalnizca kendi kayitlarini gorur (ters yon)', async () => {
      const response = await listReports({}, otherToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportListBody;
      expect(body.total).toBe(1);
      expect(body.items[0]?.id).toBe(otherReportId);
    });

    it('yanit sozlesmedeki ReportListResponse alanlarini tasir ve owner_id sizmaz', async () => {
      const response = await listReports({}, ownerToken);

      const body = response.body as ReportListBody;
      expect(Object.keys(body).sort()).toEqual(['items', 'page', 'pageSize', 'total']);
      expect(Object.keys(body.items[0] ?? {}).sort()).toEqual([
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
  });

  describe('GET /api/v1/reports?q= — arama (K2)', () => {
    it('baslikta gecen terim yalnizca eslesen tutanaklari doner', async () => {
      const response = await listReports({ q: 'Kadikoy' }, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportListBody;
      expect(body.total).toBe(1);
      expect(titlesOf(body)).toEqual(['Kadikoy 2+1 cikis teslimi']);
    });

    it('notta gecen terim yalnizca eslesen tutanaklari doner', async () => {
      const response = await listReports({ q: 'Kombi' }, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.total).toBe(1);
      expect(body.items[0]?.id).toBe(ownerReportIds.cikis);
    });

    it('arama harf buyuklugunden bagimsizdir', async () => {
      const response = await listReports({ q: 'kIrAcI' }, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.total).toBe(1);
      expect(body.items[0]?.id).toBe(ownerReportIds.giris);
    });

    it('arama baska kullanicinin eslesen kaydini getirmez', async () => {
      const response = await listReports({ q: 'Bahcelievler' }, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.total).toBe(1);
      expect(body.items[0]?.id).toBe(ownerReportIds.giris);
      expect(body.items.map((item) => item.id)).not.toContain(otherReportId);
    });

    it('joker karakter (%) harfi harfine aranir, tum kayitlari getirmez', async () => {
      const response = await listReports({ q: '%' }, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.total).toBe(1);
      expect(body.items[0]?.id).toBe(ownerReportIds.depo);
    });

    it('alt cizgi (_) joker degil, harfi harfine aranir', async () => {
      const response = await listReports({ q: 'Sisli_depo' }, ownerToken);

      expect(response.status).toBe(200);
      expect((response.body as ReportListBody).total).toBe(0);
    });

    it('bos birakilan arama parametresi filtre uygulamaz (sozlesme aciklamasi)', async () => {
      const response = await listReports({ q: '   ' }, ownerToken);

      expect(response.status).toBe(200);
      expect((response.body as ReportListBody).total).toBe(4);
    });

    it('arama terimi 100 karakteri asarsa 400 VALIDATION_ERROR doner', async () => {
      const response = await listReports({ q: 'a'.repeat(SEARCH_TERM_MAX_LENGTH + 1) }, ownerToken);

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('VALIDATION_ERROR');
      expect(envelope.details?.[0]?.field).toBe('q');
    });
  });

  describe('GET /api/v1/reports?q= — eslesme yok (K3)', () => {
    it('eslesen kayit olmadiginda 200 ve bos liste doner (hata donmez)', async () => {
      const response = await listReports({ q: 'hicbir-kayitta-gecmeyen-terim' }, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportListBody;
      expect(body.items).toEqual([]);
      expect(body.total).toBe(0);
    });
  });

  describe('GET /api/v1/reports — siralama (K4)', () => {
    it('varsayilan olarak en yeni kayit once doner', async () => {
      const response = await listReports({}, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.items.map((item) => item.id)).toEqual([
        ownerReportIds.depo,
        ownerReportIds.ofis,
        ownerReportIds.cikis,
        ownerReportIds.giris,
      ]);
    });

    it('olusturulma tarihleri azalan sirada gelir', async () => {
      const response = await listReports({}, ownerToken);

      const timestamps = (response.body as ReportListBody).items.map((item) =>
        new Date(item.createdAt).getTime(),
      );
      const sortedDesc = [...timestamps].sort((left, right) => right - left);
      expect(timestamps).toEqual(sortedDesc);
    });

    it('arama sonuclari da en yeniden eskiye siralanir', async () => {
      const response = await listReports({ q: 'teslimi' }, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.total).toBe(4);
      expect(body.items.map((item) => item.id)).toEqual([
        ownerReportIds.depo,
        ownerReportIds.ofis,
        ownerReportIds.cikis,
        ownerReportIds.giris,
      ]);
    });
  });

  describe('GET /api/v1/reports — kimlik dogrulama (K5)', () => {
    it('tokensiz istekte 401 UNAUTHENTICATED doner', async () => {
      const response = await listReports();

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });

    it('gecersiz tokenli istekte de 401 doner', async () => {
      const response = await listReports({}, 'gecersiz.token.degeri');

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });
  });

  describe('GET /api/v1/reports — sayfalama (sozlesme)', () => {
    it('ilk sayfa istenen boyutta ve toplam sayi ile doner', async () => {
      const response = await listReports({ page: '1', pageSize: '2' }, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportListBody;
      expect(body.page).toBe(1);
      expect(body.pageSize).toBe(2);
      expect(body.total).toBe(4);
      expect(body.items.map((item) => item.id)).toEqual([ownerReportIds.depo, ownerReportIds.ofis]);
    });

    it('ikinci sayfa kalan kayitlari doner', async () => {
      const response = await listReports({ page: '2', pageSize: '2' }, ownerToken);

      const body = response.body as ReportListBody;
      expect(body.page).toBe(2);
      expect(body.items.map((item) => item.id)).toEqual([
        ownerReportIds.cikis,
        ownerReportIds.giris,
      ]);
    });

    it('kayit bulunmayan sayfada 200 ve bos liste doner', async () => {
      const response = await listReports({ page: '9', pageSize: '2' }, ownerToken);

      expect(response.status).toBe(200);
      const body = response.body as ReportListBody;
      expect(body.items).toEqual([]);
      expect(body.total).toBe(4);
    });

    it('sifir veya negatif sayfa numarasi 400 VALIDATION_ERROR doner', async () => {
      const response = await listReports({ page: '0' }, ownerToken);

      expect(response.status).toBe(400);
      const envelope = (response.body as ErrorBody).error;
      expect(envelope.code).toBe('VALIDATION_ERROR');
      expect(envelope.details?.[0]?.field).toBe('page');
    });

    it('sayi olmayan sayfa numarasi 400 doner', async () => {
      const response = await listReports({ page: 'ikinci' }, ownerToken);

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details?.[0]?.field).toBe('page');
    });

    it('ust siniri asan sayfa boyutu 400 doner (sozlesme siniri 50)', async () => {
      const response = await listReports({ pageSize: String(MAX_PAGE_SIZE + 1) }, ownerToken);

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details?.[0]?.field).toBe('pageSize');
    });

    it('ondalikli sayfa boyutu 400 doner', async () => {
      const response = await listReports({ pageSize: '2.5' }, ownerToken);

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.details?.[0]?.field).toBe('pageSize');
    });
  });
});
