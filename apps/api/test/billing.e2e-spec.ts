// T-012 — abonelik odeme akisi (CLAUDE.md §8.2). Test kendi izole veritabanini olusturur,
// migration'i belgelenen npm script'i ile kosar ve gercek HTTP katmanindan gecer.
// Odeme saglayicisi yerine FakePaymentAdapter baglidir (PAYMENT_PROVIDER=fake).

import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { createEmptyDatabase, createTestPrisma, dropDatabase, runApiScript } from './db';

const TEST_DATABASE_NAME = 'tutanak_t012_billing_test';
const MIGRATION_TIMEOUT_MS = 180_000;

// Yalnizca test kosumunda kullanilan degerler; gercek bir sir degildir (CLAUDE.md §5).
const TEST_JWT_SECRET = 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
const PASSWORD = 'gizli-parola-123';
const PRICE_AMOUNT = '149.00';
const PERIOD_DAYS = 30;
const PUBLIC_APP_URL = 'http://localhost:5173';
/** FakePaymentAdapter imzanin yalnizca VARLIGINI arar (gercek HMAC yalnizca iyzico'da). */
const FAKE_SIGNATURE = 'yerel-sahte-imza';
const SIGNATURE_HEADER = 'X-Iyzico-Signature';

const MS_PER_DAY = 86_400_000;
// DB/sunucu tarafinda uretilen damgalar host saatiyle karsilastirilir (CLAUDE.md §8.5).
const CLOCK_SKEW_TOLERANCE_MS = 5000;

interface ErrorBody {
  error: { code: string; message: string; traceId: string };
}

interface CheckoutBody {
  transactionReference: string;
  checkoutUrl: string;
  amount: string;
  currency: string;
}

interface SubscriptionBody {
  status: string;
  priceAmount: string | null;
  currency: string;
  currentPeriodEnd: string | null;
}

describe('T-012 abonelik odeme akisi', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let baseDatabaseUrl: string | undefined;

  const httpServer = (): Server => app.getHttpServer() as Server;

  let uniqueCounter = 0;
  const freshEmail = (): string => {
    uniqueCounter += 1;
    return `selin-t012-${uniqueCounter.toString()}@ornek.test`;
  };

  /** Kayit + giris; kabul kriterlerindeki "giris yapmis kullanici" bu sekilde uretilir. */
  async function signedInUser(): Promise<{ token: string; email: string; userId: string }> {
    const email = freshEmail();
    const registered = await request(httpServer())
      .post('/api/v1/auth/register')
      .send({ email, password: PASSWORD });
    const login = await request(httpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });
    // Kurulum sessizce basarisiz olursa undefined token/id Prisma `where` filtresine sizar
    // ve senaryo yanlis yerde patlar; hatayi kaynaginda gorunur kil.
    expect(registered.status).toBe(201);
    expect(login.status).toBe(200);
    return {
      token: (login.body as { accessToken: string }).accessToken,
      email,
      userId: (registered.body as { id: string }).id,
    };
  }

  function startCheckout(token: string): request.Test {
    return request(httpServer())
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`);
  }

  function sendNotification(
    payload: unknown,
    signature: string | null = FAKE_SIGNATURE,
  ): request.Test {
    const call = request(httpServer()).post('/api/v1/billing/webhook');
    if (signature !== null) {
      call.set(SIGNATURE_HEADER, signature);
    }
    return call.send(payload as object);
  }

  async function getMe(token: string): Promise<SubscriptionBody> {
    const response = await request(httpServer())
      .get('/api/v1/me')
      .set('Authorization', `Bearer ${token}`);
    return (response.body as { subscription: SubscriptionBody }).subscription;
  }

  /** Odemesi baslatilmis (pending) bir kullanici; cogu senaryonun ortak baslangici. */
  async function userWithPendingPayment(): Promise<{ token: string; reference: string }> {
    const user = await signedInUser();
    const checkout = await startCheckout(user.token);
    return {
      token: user.token,
      reference: (checkout.body as CheckoutBody).transactionReference,
    };
  }

  async function activeSubscriptionUser(): Promise<{ token: string; reference: string }> {
    const { token, reference } = await userWithPendingPayment();
    await sendNotification({ providerReference: reference, status: 'succeeded' });
    return { token, reference };
  }

  beforeAll(async () => {
    baseDatabaseUrl = process.env.DATABASE_URL;
    const databaseUrl = await createEmptyDatabase(TEST_DATABASE_NAME);
    runApiScript('migrate:deploy', databaseUrl);
    prisma = createTestPrisma(databaseUrl);

    // Uygulama env'i yalnizca config/ uzerinden okur (CLAUDE.md §5); testte de gercek
    // bootstrap yolu kullanilir, bu yuzden main dinamik olarak import edilir.
    process.env.DATABASE_URL = databaseUrl;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    process.env.JWT_EXPIRES_IN = '7d';
    process.env.SUBSCRIPTION_CURRENCY = 'TRY';
    // Bu dosya hiz sinirini TEST ETMEZ; her senaryo yeni kayit+giris yaptigi icin uretim
    // varsayilani (5 istek/dk/IP) kurulumu 429'a dusururdu. Sinir davranisi T-014'un
    // `auth-rate-limit.e2e-spec.ts` dosyasinda dogrulanir; limitler env'den gelir (§5.1).
    process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
    process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '1000';
    process.env.SUBSCRIPTION_PRICE_AMOUNT = PRICE_AMOUNT;
    process.env.SUBSCRIPTION_PERIOD_DAYS = PERIOD_DAYS.toString();
    process.env.PAYMENT_PROVIDER = 'fake';
    process.env.PUBLIC_APP_URL = PUBLIC_APP_URL;
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

  describe('POST /api/v1/billing/checkout', () => {
    it('tokensiz istek 401 UNAUTHENTICATED doner', async () => {
      const response = await request(httpServer()).post('/api/v1/billing/checkout');

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });

    it('bozuk token ile 401 doner', async () => {
      const response = await startCheckout('bozuk.token.degeri');

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('UNAUTHENTICATED');
    });

    it('giris yapmis kullanicida 201 + islem referansi ve yonlendirme adresi doner', async () => {
      const user = await signedInUser();

      const response = await startCheckout(user.token);

      expect(response.status).toBe(201);
      const body = response.body as CheckoutBody;
      expect(Object.keys(body).sort()).toEqual([
        'amount',
        'checkoutUrl',
        'currency',
        'transactionReference',
      ]);
      expect(body.transactionReference.length).toBeGreaterThan(0);
      // Tutar yapilandirmadan gelir ve METIN olarak doner (CLAUDE.md §5.1).
      expect(body.amount).toBe(PRICE_AMOUNT);
      expect(body.currency).toBe('TRY');
      const checkoutUrl = new URL(body.checkoutUrl);
      expect(checkoutUrl.origin).toBe(PUBLIC_APP_URL);
    });

    it('abonelik satirini olusturup pending yapar ve odeme satirini initiated yazar', async () => {
      const user = await signedInUser();

      const response = await startCheckout(user.token);

      const subscription = await prisma.subscription.findUniqueOrThrow({
        where: { userId: user.userId },
        include: { transactions: true },
      });
      expect(subscription.status).toBe('pending');
      expect(subscription.priceAmount?.toFixed(2)).toBe(PRICE_AMOUNT);
      // provider sutunu DB varsayilanindan degil PAYMENT_PROVIDER'dan yazilir (§8.3).
      expect(subscription.provider).toBe('fake');
      expect(subscription.currentPeriodEnd).toBeNull();
      expect(subscription.transactions).toHaveLength(1);
      const payment = subscription.transactions[0];
      expect(payment?.status).toBe('initiated');
      expect(payment?.processedAt).toBeNull();
      expect(payment?.providerReference).toBe((response.body as CheckoutBody).transactionReference);
      expect(payment?.amount.toFixed(2)).toBe(PRICE_AMOUNT);
    });

    it('ikinci kez cagrildiginda ayni abonelik satirini kullanir, yeni odeme satiri acar', async () => {
      const user = await signedInUser();

      await startCheckout(user.token);
      await startCheckout(user.token);

      const subscriptions = await prisma.subscription.findMany({
        where: { userId: user.userId },
        include: { transactions: true },
      });
      // subscriptions_user_id_key: kullanici basina TEK satir (get-or-create, §3.11).
      expect(subscriptions).toHaveLength(1);
      expect(subscriptions[0]?.transactions).toHaveLength(2);
    });

    it('abonelik zaten aktifken 409 SUBSCRIPTION_ALREADY_ACTIVE doner', async () => {
      const { token } = await activeSubscriptionUser();

      const response = await startCheckout(token);

      expect(response.status).toBe(409);
      expect((response.body as ErrorBody).error.code).toBe('SUBSCRIPTION_ALREADY_ACTIVE');
    });
  });

  describe('POST /api/v1/billing/webhook — basarili odeme', () => {
    it('succeeded bildiriminde abonelik aktif olur ve donem sonu sunucuda hesaplanir', async () => {
      const { token, reference } = await userWithPendingPayment();
      const before = Date.now();

      const response = await sendNotification({
        providerReference: reference,
        status: 'succeeded',
      });

      const after = Date.now();
      expect(response.status).toBe(200);
      const subscription = await getMe(token);
      expect(subscription.status).toBe('active');
      expect(subscription.priceAmount).toBe(PRICE_AMOUNT);
      const periodEnd = new Date(subscription.currentPeriodEnd ?? '').getTime();
      expect(periodEnd).toBeGreaterThanOrEqual(
        before + PERIOD_DAYS * MS_PER_DAY - CLOCK_SKEW_TOLERANCE_MS,
      );
      expect(periodEnd).toBeLessThanOrEqual(
        after + PERIOD_DAYS * MS_PER_DAY + CLOCK_SKEW_TOLERANCE_MS,
      );
    });

    it('odeme satirini succeeded olarak damgalar (yeni satir YAZMAZ)', async () => {
      const { reference } = await userWithPendingPayment();

      await sendNotification({ providerReference: reference, status: 'succeeded' });

      const payments = await prisma.paymentTransaction.findMany({
        where: { providerReference: reference },
      });
      expect(payments).toHaveLength(1);
      expect(payments[0]?.status).toBe('succeeded');
      expect(payments[0]?.processedAt).not.toBeNull();
      expect(payments[0]?.failureReason).toBeNull();
    });

    it('ayni bildirim ikinci kez geldiginde 200 doner ve donem sonu DEGISMEZ (idempotans)', async () => {
      const { token, reference } = await userWithPendingPayment();

      const first = await sendNotification({ providerReference: reference, status: 'succeeded' });
      const afterFirst = await getMe(token);
      const second = await sendNotification({ providerReference: reference, status: 'succeeded' });
      const afterSecond = await getMe(token);

      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(afterSecond.currentPeriodEnd).toBe(afterFirst.currentPeriodEnd);
      expect(afterSecond.status).toBe('active');
    });

    it('sema disi ek alanlar tasiyan bildirim 400 URETMEZ (CLAUDE.md §3.7 istisna 2)', async () => {
      const { token, reference } = await userWithPendingPayment();

      const response = await sendNotification({
        providerReference: reference,
        status: 'succeeded',
        iyziEventType: 'CHECKOUTFORM_AUTH',
        merchantId: 12345,
        beklenmeyenAlan: { derin: true },
      });

      expect(response.status).toBe(200);
      expect((await getMe(token)).status).toBe('active');
    });
  });

  describe('POST /api/v1/billing/webhook — basarisiz odeme', () => {
    it('failed bildiriminde abonelik aktife GECMEZ, /me pasif doner', async () => {
      const { token, reference } = await userWithPendingPayment();

      const response = await sendNotification({
        providerReference: reference,
        status: 'failed',
        failureReason: 'kart reddedildi',
      });

      expect(response.status).toBe(200);
      const subscription = await getMe(token);
      expect(subscription.status).toBe('inactive');
      expect(subscription.currentPeriodEnd).toBeNull();
    });

    it('reddedilme nedenini odeme satirina yazar (denetlenebilir kayit)', async () => {
      const { reference } = await userWithPendingPayment();

      await sendNotification({
        providerReference: reference,
        status: 'failed',
        failureReason: 'kart reddedildi',
      });

      const payment = await prisma.paymentTransaction.findUniqueOrThrow({
        where: { providerReference: reference },
      });
      expect(payment.status).toBe('failed');
      expect(payment.failureReason).toBe('kart reddedildi');
      expect(payment.processedAt).not.toBeNull();
    });

    it('saglayici neden bildirmediginde sabit varsayilan neden yazilir (DB CHECK)', async () => {
      const { reference } = await userWithPendingPayment();

      const response = await sendNotification({ providerReference: reference, status: 'failed' });

      expect(response.status).toBe(200);
      const payment = await prisma.paymentTransaction.findUniqueOrThrow({
        where: { providerReference: reference },
      });
      expect(payment.failureReason).not.toBeNull();
      expect(payment.failureReason?.length).toBeGreaterThan(0);
    });

    it('abonelik aktifken gelen failed bildirimi durumu DUSURMEZ (CLAUDE.md §3.12)', async () => {
      // Gercek akis: kullanici iki kez odeme baslatir, ilki basarili olur (aktif),
      // ardindan ikinci denemenin reddi bildirilir.
      const user = await signedInUser();
      const first = await startCheckout(user.token);
      const second = await startCheckout(user.token);
      const succeededReference = (first.body as CheckoutBody).transactionReference;
      const failedReference = (second.body as CheckoutBody).transactionReference;
      await sendNotification({ providerReference: succeededReference, status: 'succeeded' });
      const activeBefore = await getMe(user.token);

      const response = await sendNotification({
        providerReference: failedReference,
        status: 'failed',
        failureReason: 'kart reddedildi',
      });

      expect(response.status).toBe(200);
      const subscription = await getMe(user.token);
      expect(subscription.status).toBe('active');
      expect(subscription.currentPeriodEnd).toBe(activeBefore.currentPeriodEnd);
      // Odeme satiri yine de reddedilmis olarak damgalanir (denetlenebilirlik).
      const payment = await prisma.paymentTransaction.findUniqueOrThrow({
        where: { providerReference: failedReference },
      });
      expect(payment.status).toBe('failed');
    });
  });

  describe('POST /api/v1/billing/webhook — dogrulama ve idempotans sinirlari', () => {
    it('imza basligi olmadan 401 INVALID_WEBHOOK_SIGNATURE doner ve durum degismez', async () => {
      const { token, reference } = await userWithPendingPayment();

      const response = await sendNotification(
        { providerReference: reference, status: 'succeeded' },
        null,
      );

      expect(response.status).toBe(401);
      expect((response.body as ErrorBody).error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
      expect((await getMe(token)).status).toBe('pending');
    });

    it('zorunlu alan (providerReference) eksikse 400 VALIDATION_ERROR doner', async () => {
      const response = await sendNotification({ status: 'succeeded' });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('taninmayan status degerinde 400 VALIDATION_ERROR doner', async () => {
      const { reference } = await userWithPendingPayment();

      const response = await sendNotification({
        providerReference: reference,
        status: 'bilinmiyor',
      });

      expect(response.status).toBe(400);
      expect((response.body as ErrorBody).error.code).toBe('VALIDATION_ERROR');
    });

    it('taninmayan providerReference 400/404 DEGIL 200 doner ve hicbir alan degismez', async () => {
      const { token } = await userWithPendingPayment();

      const response = await sendNotification({
        providerReference: 'hic-olmayan-referans',
        status: 'succeeded',
      });

      expect(response.status).toBe(200);
      const subscription = await getMe(token);
      expect(subscription.status).toBe('pending');
      expect(subscription.currentPeriodEnd).toBeNull();
    });
  });
});
