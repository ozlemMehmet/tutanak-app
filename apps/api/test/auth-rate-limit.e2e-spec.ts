// T-014 — /auth/* hiz siniri (429 RATE_LIMIT_EXCEEDED), gercek HTTP katmanindan (CLAUDE.md §8.2).
// Limitler env uzerinden geldigi icin bu dosya kasten KUCUK limitlerle kosar; limit ALTINDAKI
// davranisin bozulmadigini `auth.e2e-spec.ts` dogrular (o dosya yuksek limitle kosar).

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';
import { createUser } from './factories/user.factory';

const TEST_DATABASE_NAME = 'tutanak_t014_rate_limit_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';
const BCRYPT_COST = 10;

// Sayaclar route + IP basina tutuldugu icin her endpoint kendi kotasini kullanir.
const AUTH_LIMIT = 2;
const GENERAL_LIMIT = 3;
const WINDOW_SECONDS = 60;

interface ErrorEnvelopeBody {
  error: { code: string; message: string; details?: unknown; traceId: string };
}

describe('T-014 /auth/* hiz siniri', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let databaseUrl: string;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  let uniqueCounter = 0;
  const freshEmail = (): string => {
    uniqueCounter += 1;
    return `hiz-${uniqueCounter.toString()}@ornek.test`;
  };

  beforeAll(async () => {
    baseDatabaseUrl = process.env.DATABASE_URL;
    databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    prisma = createTestPrisma(databaseUrl);

    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';
    // Limitler yapilandirmadan okunur (CLAUDE.md §5.1); test kucuk degerlerle kosar.
    process.env.RATE_LIMIT_WINDOW_SECONDS = WINDOW_SECONDS.toString();
    process.env.RATE_LIMIT_MAX_REQUESTS = GENERAL_LIMIT.toString();
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = AUTH_LIMIT.toString();
    // T-012 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.SUBSCRIPTION_PRICE_AMOUNT = '199.00';
    process.env.PUBLIC_APP_URL = 'http://localhost:5173';
    // T-008 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.EMAIL_FROM = 'Tutanak <noreply@ornek.test>';
    // Obje depolama yapilandirmasi T-006 ile zorunlu hale geldi; bu testler depolamayi
    // kullanmaz, degerler yalnizca env semasini gecmek icindir (CLAUDE.md §5).
    process.env.R2_ENDPOINT = 'http://localhost:9000';
    process.env.R2_BUCKET = 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID = 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY = 'test-gizli';

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

  it('POST /auth/register: limit icindeki istekler 201 doner, limit asilinca 429 RATE_LIMIT_EXCEEDED doner', async () => {
    for (let attempt = 0; attempt < AUTH_LIMIT; attempt += 1) {
      const allowed = await request(httpServer())
        .post('/api/v1/auth/register')
        .send({ email: freshEmail(), password: PASSWORD });

      expect(allowed.status).toBe(201);
    }

    const blocked = await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email: freshEmail(), password: PASSWORD });

    expect(blocked.status).toBe(429);
    const { error } = blocked.body as ErrorEnvelopeBody;
    // Sozlesmedeki tek tip hata zarfi (CLAUDE.md §4.1): code + message + traceId.
    expect(error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(error.message.length).toBeGreaterThan(0);
    // Framework metni istemciye sizmaz, mesaj Turkce'dir (CLAUDE.md §4.3).
    expect(error.message).not.toMatch(/throttler|too many/i);
    expect(typeof error.traceId).toBe('string');
    // details yalnizca VALIDATION_ERROR / EMAIL_ALREADY_REGISTERED'da doner (§4.2.3).
    expect(error.details).toBeUndefined();
  });

  it('limit asildiktan sonra kayit yeni kullanici OLUSTURMAZ (istek islenmeden reddedilir)', async () => {
    const email = freshEmail();

    const blocked = await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD });

    expect(blocked.status).toBe(429);
    await expect(prisma.user.findUnique({ where: { email } })).resolves.toBeNull();
  });

  it('POST /auth/login: limit icindeki denemeler normal yanit verir, limit asilinca 429 doner', async () => {
    // Kullanici dogrudan fabrikayla olusturulur; register kotasi login testini etkilemesin (§8.4).
    const email = freshEmail();
    await createUser(prisma, { email, passwordHash: await bcrypt.hash(PASSWORD, BCRYPT_COST) });

    const successful = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    expect(successful.status).toBe(200);

    // Basarisiz deneme de sayaci tuketir — kaba kuvvet korumasinin sarti budur.
    const wrongPassword = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'yanlis-parola-123' });
    expect(wrongPassword.status).toBe(401);

    const blocked = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });

    expect(blocked.status).toBe(429);
    expect((blocked.body as ErrorEnvelopeBody).error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('hiz siniri kimlik dogrulamasindan ONCE calisir: korumali endpoint token olmadan 401 yerine 429 doner', async () => {
    for (let attempt = 0; attempt < GENERAL_LIMIT; attempt += 1) {
      const allowed = await request(httpServer()).get('/api/v1/me');

      expect(allowed.status).toBe(401);
    }

    const blocked = await request(httpServer()).get('/api/v1/me');

    expect(blocked.status).toBe(429);
    expect((blocked.body as ErrorEnvelopeBody).error.code).toBe('RATE_LIMIT_EXCEEDED');
  });

  it('genel limit ile /auth/* limiti ayri yapilandirilir: kimlik uclari daha erken kesilir', async () => {
    // /auth/register kotasi (2) ilk testte tukendi; /health genel kotayla (3) hala calisiyor.
    const health = await request(httpServer()).get('/health');
    expect(health.status).toBe(200);

    const blockedAuth = await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email: freshEmail(), password: PASSWORD });
    expect(blockedAuth.status).toBe(429);
    expect(AUTH_LIMIT).toBeLessThan(GENERAL_LIMIT);
  });
});
