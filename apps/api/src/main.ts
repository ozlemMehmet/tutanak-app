import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Express } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createValidationPipe } from './common/pipes/validation-pipe.factory';

const API_PORT = 3000;
const GLOBAL_API_PREFIX = 'api/v1';
/** Altyapi endpoint'leri surumlu API onekinin disinda kalir (architecture.md §10). */
const PREFIX_EXCLUDED_ROUTES = ['health'];
/**
 * T-024 / S-01: uretim topolojisinde istemci ile API arasinda TEK guvenilen hop vardir
 * (Caddy ters vekili — API portu disari acilmaz). Express bu deger kadar geri giderek
 * `req.ip`'i belirler; hiz siniri sayaci bu adresle tutulur (ClientIpThrottlerGuard).
 * Deger `true` YAPILAMAZ: o zaman istemcinin uydurdugu XFF zincirinin ilk halkasi
 * "gercek istemci" sayilir ve sayac her istekte sifirlanabilirdi.
 */
const TRUSTED_PROXY_HOP_COUNT = 1;

/**
 * Global yapilandirma (onek, guvenlik basliklari, govde katiligi, hata zarfi) TEK yerde
 * durur. Saglayici degistiren e2e testleri (ornegin FakeStorageAdapter) uygulamayi kendi
 * kurar ama yapilandirmayi buradan alir — test ile bootstrap birbirinden sapmaz.
 */
export function configureApiApp(app: INestApplication): INestApplication {
  // `getInstance()` Nest'in genel HttpServer imzasinda `any` doner; Express ornegi
  // acikca daraltilir (ayar yalnizca Express uzerinde anlamlidir).
  const expressApp = app.getHttpAdapter().getInstance() as Express;
  expressApp.set('trust proxy', TRUSTED_PROXY_HOP_COUNT);
  app.use(helmet());
  app.setGlobalPrefix(GLOBAL_API_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
  // Govde katiligi (CLAUDE.md §3.7) ve tek tip hata zarfi (§4.1) global olarak kurulur.
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}

/**
 * Uygulamayi kurar ama dinlemeye baslamaz; e2e testleri de ayni kurulumu kullanir
 * (bootstrap yapilandirmasi ile test kurulumunun birbirinden sapmamasi icin).
 */
export async function createApiApp(): Promise<INestApplication> {
  // rawBody: webhook imza dogrulamasi ham govde ister (CLAUDE.md §1, §3.13).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  return configureApiApp(app);
}

export async function bootstrap(): Promise<void> {
  const app = await createApiApp();
  await app.listen(API_PORT);
}

if (require.main === module) {
  void bootstrap();
}
