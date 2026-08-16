import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

describe('GET /health', () => {
  let app: INestApplication;

  // Nest'in getHttpServer() imzasi `any` doner; supertest'e verilmeden once daraltilir.
  const httpServer = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
    // T-003 ile uygulama acilista ortam degiskenlerini dogrular (CLAUDE.md §5) ve bu
    // dogrulama modul YUKLENIRKEN calisir; bu yuzden main dinamik olarak import edilir.
    // Disaridan verilmediyse yalnizca test kosumuna ait yerel degerler kullanilir.
    process.env.JWT_SECRET ??= 'test-ortami-icin-yeterince-uzun-imzalama-anahtari';
    process.env.DATABASE_URL ??= 'postgresql://tutanak:tutanak@localhost:5432/tutanak';
    // T-012 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.SUBSCRIPTION_PRICE_AMOUNT ??= '199.00';
    process.env.PUBLIC_APP_URL ??= 'http://localhost:5173';
    // T-008 ile zorunlu hale gelen yapilandirma; uygulama bunlar olmadan ACILMAZ (§5).
    process.env.EMAIL_FROM ??= 'Tutanak <noreply@ornek.test>';
    // T-024/S-03 ile zorunlu hale geldi (varsayilani YOK); uygulama bu deger olmadan ACILMAZ.
    process.env.PAYMENT_PROVIDER ??= 'fake';
    // T-006: obje depolama yapilandirmasi env semasinda zorunludur (CLAUDE.md §5).
    process.env.R2_ENDPOINT ??= 'http://localhost:9000';
    process.env.R2_BUCKET ??= 'test-kovasi';
    process.env.R2_ACCESS_KEY_ID ??= 'test-erisim';
    process.env.R2_SECRET_ACCESS_KEY ??= 'test-gizli';

    const { createApiApp } = await import('../src/main');
    app = await createApiApp();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('kimlik dogrulama olmadan 200 ve { status: ok } doner', async () => {
    const response = await request(httpServer()).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('/api/v1 onekinin altinda yayinlanmaz (404 doner)', async () => {
    // Mimari karari: /health altyapi endpoint'idir, surumlu API sozlesmesinin disindadir.
    const response = await request(httpServer()).get('/api/v1/health');

    expect(response.status).toBe(404);
  });
});
