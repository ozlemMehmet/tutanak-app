// T-003 — kayit, giris ve korumali endpoint erisimi (CLAUDE.md §8.2).
// Test kendi izole veritabanini olusturur, migration'i belgelenen npm script'i ile kosar
// ve gercek HTTP katmanindan gecer; kabul kriterlerinin her biri en az bir testtedir.

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';

const TEST_DATABASE_NAME = 'tutanak_t003_auth_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';

// DB tarafinda uretilen created_at, testin host saatiyle karsilastirilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

const BCRYPT_COST_PREFIX = '$2b$10$';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('T-003 kimlik dogrulama akisi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let databaseUrl: string;
  // Uygulama izole test veritabanina baglanir; yonetim komutlari (DROP DATABASE) ise
  // temel adresten kosmalidir — aksi halde teardown kendi baglantisini dusurur.
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  let uniqueCounter = 0;
  const freshEmail = (): string => {
    uniqueCounter += 1;
    return `selin-${uniqueCounter.toString()}@ornek.test`;
  };

  async function registerUser(email: string, password = PASSWORD): Promise<request.Response> {
    return request(httpServer()).post('/api/v1/auth/register').send({ email, password });
  }

  beforeAll(async () => {
    baseDatabaseUrl = process.env.DATABASE_URL;
    databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    prisma = createTestPrisma(databaseUrl);

    // Uygulama ortam degiskenlerini yalnizca config/ uzerinden okur (CLAUDE.md §5);
    // testte de gercek bootstrap yolu kullanilir.
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';

    const { createApiApp } = await import('../src/main');
    app = await createApiApp();
    await app.init();
  }, MIGRATION_TIMEOUT_MS);

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    process.env.DATABASE_URL = baseDatabaseUrl;
    await dropDatabase(TEST_DATABASE_NAME);
  }, MIGRATION_TIMEOUT_MS);

  describe('POST /api/v1/auth/register', () => {
    it('gecerli e-posta ve parola ile 201 doner ve kullaniciyi veritabaninda olusturur', async () => {
      const email = freshEmail();
      const before = new Date();

      const response = await registerUser(email);

      const after = new Date();
      expect(response.status).toBe(201);
      const body = response.body as { id: string; email: string; createdAt: string };
      // Sozlesmedeki User semasi tam olarak bu uc alandan olusur (fazlasi sizinti olurdu).
      expect(Object.keys(body).sort()).toEqual(['createdAt', 'email', 'id']);
      expect(body.email).toBe(email);
      expect(body.id).toMatch(UUID_PATTERN);

      const stored = await prisma.user.findUnique({ where: { email } });
      expect(stored).not.toBeNull();
      expect(stored?.id).toBe(body.id);

      // created_at sunucu/DB tarafinda uretilir (CLAUDE.md §3.7); iki tarafli tolerans §8.5.
      const createdAt = new Date(body.createdAt).getTime();
      expect(createdAt).toBeGreaterThanOrEqual(before.getTime() - CLOCK_SKEW_TOLERANCE_MS);
      expect(createdAt).toBeLessThanOrEqual(after.getTime() + CLOCK_SKEW_TOLERANCE_MS);
    });

    it("parolayi veritabaninda duz metin saklamaz, bcrypt hash'i olarak saklar", async () => {
      const email = freshEmail();

      await registerUser(email);

      const stored = await prisma.user.findUnique({ where: { email } });
      expect(stored?.passwordHash).toBeDefined();
      expect(stored?.passwordHash).not.toBe(PASSWORD);
      expect(stored?.passwordHash.startsWith(BCRYPT_COST_PREFIX)).toBe(true);
      await expect(bcrypt.compare(PASSWORD, stored?.passwordHash ?? '')).resolves.toBe(true);
    });

    it("yanit govdesinde parola veya parola hash'i sizmaz", async () => {
      const response = await registerUser(freshEmail());

      expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
      expect(JSON.stringify(response.body)).not.toContain('$2b$');
    });

    it('kayitli e-posta ile ikinci kayit 409 EMAIL_ALREADY_REGISTERED ve alan bazli hata doner', async () => {
      const email = freshEmail();
      await registerUser(email);

      const response = await registerUser(email);

      expect(response.status).toBe(409);
      const envelope = (
        response.body as {
          error: {
            code: string;
            message: string;
            details: { field: string; message: string }[];
            traceId: string;
          };
        }
      ).error;
      expect(envelope.code).toBe('EMAIL_ALREADY_REGISTERED');
      expect(envelope.message.length).toBeGreaterThan(0);
      // T-003 kriteri: 409 yaniti ALAN BAZLI hata tasir (CLAUDE.md §4.2.3).
      expect(envelope.details).toHaveLength(1);
      expect(envelope.details[0]?.field).toBe('email');
      expect(envelope.details[0]?.message.length).toBeGreaterThan(0);
      expect(typeof envelope.traceId).toBe('string');
    });

    it('ayni e-postanin farkli harf buyuklugu ile kaydini da 409 ile reddeder (citext)', async () => {
      const email = freshEmail();
      await registerUser(email);

      const response = await registerUser(email.toUpperCase());

      expect(response.status).toBe(409);
      expect((response.body as { error: { code: string } }).error.code).toBe(
        'EMAIL_ALREADY_REGISTERED',
      );
    });

    it('gecersiz e-posta ve kisa parolada 400 VALIDATION_ERROR + alan detaylari doner', async () => {
      const response = await request(httpServer())
        .post('/api/v1/auth/register')
        .send({ email: 'gecersiz-eposta', password: 'kisa' });

      expect(response.status).toBe(400);
      const body = response.body as { error: { code: string; details: { field: string }[] } };
      expect(body.error.code).toBe('VALIDATION_ERROR');
      expect(body.error.details.map((detail) => detail.field).sort()).toEqual([
        'email',
        'password',
      ]);
    });

    it('beyaz liste disi alan tasiyan govdeyi 400 ile reddeder (CLAUDE.md §3.7)', async () => {
      const response = await request(httpServer())
        .post('/api/v1/auth/register')
        .send({ email: freshEmail(), password: PASSWORD, isAdmin: true });

      expect(response.status).toBe(400);
      expect((response.body as { error: { code: string } }).error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('gecerli kimlik bilgileriyle 200 ve erisim tokeni doner', async () => {
      const email = freshEmail();
      await registerUser(email);

      const response = await request(httpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });

      expect(response.status).toBe(200);
      const body = response.body as {
        accessToken: string;
        expiresIn: number;
        user: { email: string };
      };
      expect(body.accessToken.split('.')).toHaveLength(3);
      expect(body.expiresIn).toBe(604_800);
      expect(body.user.email).toBe(email);
    });

    it('hatali parola ile 401 INVALID_CREDENTIALS doner', async () => {
      const email = freshEmail();
      await registerUser(email);

      const response = await request(httpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: 'yanlis-parola-123' });

      expect(response.status).toBe(401);
      expect((response.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
    });

    it('kayitli olmayan e-posta ile de ayni 401 INVALID_CREDENTIALS doner', async () => {
      const response = await request(httpServer())
        .post('/api/v1/auth/login')
        .send({ email: 'hic-kayitli-degil@ornek.test', password: PASSWORD });

      expect(response.status).toBe(401);
      expect((response.body as { error: { code: string } }).error.code).toBe('INVALID_CREDENTIALS');
    });

    it('e-postanin harf buyuklugu farkli yazilsa da giris yapilabilir (citext)', async () => {
      const email = freshEmail();
      await registerUser(email);

      const response = await request(httpServer())
        .post('/api/v1/auth/login')
        .send({ email: email.toUpperCase(), password: PASSWORD });

      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/v1/me (korumali endpoint)', () => {
    async function tokenFor(email: string): Promise<string> {
      await registerUser(email);
      const response = await request(httpServer())
        .post('/api/v1/auth/login')
        .send({ email, password: PASSWORD });
      return (response.body as { accessToken: string }).accessToken;
    }

    it('token olmadan 401 UNAUTHENTICATED doner', async () => {
      const response = await request(httpServer()).get('/api/v1/me');

      expect(response.status).toBe(401);
      expect((response.body as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    });

    it('bozuk token ile 401 doner', async () => {
      const response = await request(httpServer())
        .get('/api/v1/me')
        .set('Authorization', 'Bearer bozuk.token.degeri');

      expect(response.status).toBe(401);
      expect((response.body as { error: { code: string } }).error.code).toBe('UNAUTHENTICATED');
    });

    it('baska bir anahtarla imzalanmis token ile 401 doner', async () => {
      const foreignToken = [
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
        'eyJzdWIiOiIxMTExMTExMS0xMTExLTQxMTEtODExMS0xMTExMTExMTExMTEifQ',
        'gecersiz-imza',
      ].join('.');

      const response = await request(httpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${foreignToken}`);

      expect(response.status).toBe(401);
    });

    it('gecerli token ile 200 ve profil bilgisi doner', async () => {
      const email = freshEmail();
      const token = await tokenFor(email);

      const response = await request(httpServer())
        .get('/api/v1/me')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      const body = response.body as {
        id: string;
        email: string;
        createdAt: string;
        subscription: unknown;
      };
      expect(Object.keys(body).sort()).toEqual(['createdAt', 'email', 'id', 'subscription']);
      expect(body.email).toBe(email);
      expect(body.id).toMatch(UUID_PATTERN);
      expect(typeof body.createdAt).toBe('string');
      // Abonelik satiri yokken sozlesmedeki varsayilan nesne doner (CLAUDE.md §3.11).
      expect(body.subscription).toEqual({
        status: 'inactive',
        priceAmount: null,
        currency: 'TRY',
        currentPeriodEnd: null,
      });
    });

    it('profil sorgusu abonelik satiri OLUSTURMAZ (CLAUDE.md §3.11)', async () => {
      const email = freshEmail();
      const token = await tokenFor(email);

      await request(httpServer()).get('/api/v1/me').set('Authorization', `Bearer ${token}`);

      const user = await prisma.user.findUnique({
        where: { email },
        include: { subscriptions: true },
      });
      expect(user?.subscriptions).toEqual([]);
    });
  });
});
