import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { createValidationPipe } from './common/pipes/validation-pipe.factory';

const API_PORT = 3000;
const GLOBAL_API_PREFIX = 'api/v1';
/** Altyapi endpoint'leri surumlu API onekinin disinda kalir (architecture.md §10). */
const PREFIX_EXCLUDED_ROUTES = ['health'];

/**
 * Uygulamayi kurar ama dinlemeye baslamaz; e2e testleri de ayni kurulumu kullanir
 * (bootstrap yapilandirmasi ile test kurulumunun birbirinden sapmamasi icin).
 */
export async function createApiApp(): Promise<INestApplication> {
  // rawBody: webhook imza dogrulamasi ham govde ister (CLAUDE.md §1, §3.13).
  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.use(helmet());
  app.setGlobalPrefix(GLOBAL_API_PREFIX, { exclude: PREFIX_EXCLUDED_ROUTES });
  // Govde katiligi (CLAUDE.md §3.7) ve tek tip hata zarfi (§4.1) global olarak kurulur.
  app.useGlobalPipes(createValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  return app;
}

export async function bootstrap(): Promise<void> {
  const app = await createApiApp();
  await app.listen(API_PORT);
}

if (require.main === module) {
  void bootstrap();
}
