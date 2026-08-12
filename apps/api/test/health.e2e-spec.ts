import type { Server } from 'node:http';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApiApp } from '../src/main';

describe('GET /health', () => {
  let app: INestApplication;

  // Nest'in getHttpServer() imzasi `any` doner; supertest'e verilmeden once daraltilir.
  const httpServer = (): Server => app.getHttpServer() as Server;

  beforeAll(async () => {
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
