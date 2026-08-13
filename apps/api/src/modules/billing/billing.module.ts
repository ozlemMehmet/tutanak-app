import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { BillingConfig } from '../../config/config.tokens';
import { BILLING_CONFIG } from '../../config/config.tokens';
import type { AppEnv } from '../../config/env.schema';
import { PaymentModule } from '../../infra/payment/payment.module';
import { PrismaModule } from '../../infra/prisma/prisma.module';
import { BillingController } from './billing.controller';
import { BillingRepository } from './billing.repository';
import { BillingService } from './billing.service';

/**
 * Odeme sonrasi donus adresi (ticket T-012 sozlesme boslugu + design.md SubscriptionPage):
 * origin YAPILANDIRMADAN (`PUBLIC_APP_URL`) gelir, koda yalnizca UI rota konvansiyonu
 * gomulur — sandbox ve uretim farkli origin kullanir.
 */
const CHECKOUT_RETURN_PATH = '/subscription?checkout=return';

function toBillingConfig(config: ConfigService<AppEnv, true>): BillingConfig {
  return {
    priceAmount: config.get('SUBSCRIPTION_PRICE_AMOUNT', { infer: true }),
    currency: config.get('SUBSCRIPTION_CURRENCY', { infer: true }),
    periodDays: config.get('SUBSCRIPTION_PERIOD_DAYS', { infer: true }),
    provider: config.get('PAYMENT_PROVIDER', { infer: true }),
    checkoutCallbackUrl: new URL(
      CHECKOUT_RETURN_PATH,
      config.get('PUBLIC_APP_URL', { infer: true }),
    ).toString(),
  };
}

@Module({
  imports: [PrismaModule, PaymentModule],
  controllers: [BillingController],
  providers: [
    BillingService,
    BillingRepository,
    { provide: BILLING_CONFIG, inject: [ConfigService], useFactory: toBillingConfig },
  ],
})
export class BillingModule {}
