// E-posta sinirinin baglanmasi (CLAUDE.md §7): uretim adapteri Resend'dir; testler
// saglayiciyi FakeEmailAdapter ile degistirir — bunun icin ayri bir env anahtari
// UYDURULMAZ (§5.1 tablosunda e-posta saglayici secimi anahtari yok; storage ile ayni karar).

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { AppEnv } from '../../config/env.schema';
import { EMAIL_PORT } from './email.port';
import type { EmailPort } from './email.port';
import { ResendEmailAdapter } from './resend-email.adapter';

/**
 * RESEND_API_KEY tanimli degilken (yerel `docker compose up` dis hesapsiz calisir, §10)
 * gonderim denemesi saglayicida reddedilir ve §4.2.2 geregi 202 + `status: failed` olarak
 * yanita yansir — uygulama ACILMAYA devam eder. Yer tutucu, SDK'nin kendi ortam
 * degiskeni okumasina dusmemek icindir; sir DEGILDIR.
 */
const MISSING_API_KEY_PLACEHOLDER = 'resend-anahtari-tanimsiz';

function createEmailAdapter(config: ConfigService<AppEnv, true>): EmailPort {
  // Semadaki transform '' degerini undefined'a cevirir, ama ConfigService dogrulanmis deger
  // undefined oldugunda process.env'e duser ve `.env`'deki bos `RESEND_API_KEY=` satirini
  // '' olarak geri verir; bos string de anahtarsizlik demektir (nullish kontrolu yetmez).
  const apiKey: string | undefined = config.get('RESEND_API_KEY', { infer: true });
  const client = new Resend(
    apiKey === undefined || apiKey === '' ? MISSING_API_KEY_PLACEHOLDER : apiKey,
  );
  return new ResendEmailAdapter({ from: config.get('EMAIL_FROM', { infer: true }) }, client);
}

@Module({
  providers: [{ provide: EMAIL_PORT, inject: [ConfigService], useFactory: createEmailAdapter }],
  exports: [EMAIL_PORT],
})
export class EmailModule {}
