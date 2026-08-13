// Odeme sinirinin baglanmasi (CLAUDE.md §7): hangi adapter'in devreye girecegi
// PAYMENT_PROVIDER yapilandirmasindan gelir — yerel/test `fake`, uretim `iyzico` (§5.1).

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Iyzipay from 'iyzipay';
import type { AppEnv } from '../../config/env.schema';
import { FakePaymentAdapter } from './fake-payment.adapter';
import { IyzicoPaymentAdapter } from './iyzico-payment.adapter';
import type { PaymentPort } from './payment.port';
import { PAYMENT_PORT } from './payment.port';

/**
 * ANAYASA BOSLUGU (devlog'da raporlandi): CLAUDE.md §5.1 sandbox/production ayrimi icin
 * bir env anahtari tanimlamiyor ve dev kendi anahtarini ICAT ETMEZ. Bu yuzden uretim
 * adresi sabittir; sandbox kosumu icin sozlesmeye bir yapilandirma anahtari eklenmelidir.
 */
const IYZICO_API_URI = 'https://api.iyzipay.com';

function createPaymentAdapter(config: ConfigService<AppEnv, true>): PaymentPort {
  if (config.get('PAYMENT_PROVIDER', { infer: true }) !== 'iyzico') {
    return new FakePaymentAdapter();
  }

  // Sirlarin varligi env semasinda kosullu olarak dogrulanir (§5): burada dolu olduklari
  // garantidir, uygulama aksi halde ACILMAZ.
  const client = new Iyzipay({
    apiKey: config.get('IYZICO_API_KEY', { infer: true }),
    secretKey: config.get('IYZICO_SECRET_KEY', { infer: true }),
    uri: IYZICO_API_URI,
  });
  return new IyzicoPaymentAdapter(
    { webhookSecret: config.get('IYZICO_WEBHOOK_SECRET', { infer: true }) },
    client,
  );
}

@Module({
  providers: [
    {
      provide: PAYMENT_PORT,
      inject: [ConfigService],
      useFactory: createPaymentAdapter,
    },
  ],
  exports: [PAYMENT_PORT],
})
export class PaymentModule {}
