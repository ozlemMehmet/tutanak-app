// Abonelik odeme akisinin is mantigi (CLAUDE.md §3.2). Durum gecisleri §3.12, odeme
// satirinin yasam dongusu ve idempotans §3.13'te BAGLAYICI olarak tanimlidir; burada
// yalnizca uygulanir, yeniden yorumlanmaz.

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConflictError } from '../../common/errors/app-error';
import type { BillingConfig } from '../../config/config.tokens';
import { BILLING_CONFIG } from '../../config/config.tokens';
import type { PaymentNotification, PaymentPort } from '../../infra/payment/payment.port';
import { PAYMENT_PORT } from '../../infra/payment/payment.port';
import { BillingRepository } from './billing.repository';
import type { CheckoutDto } from './dto/billing.dto';
import { toCheckoutDto } from './mappers/billing.mapper';

const MS_PER_DAY = 86_400_000;

/**
 * `payment_transactions.failure_reason` DB CHECK'i geregi `failed` satirda neden ZORUNLUDUR;
 * saglayici neden bildirmediyse bu sabit metin yazilir, `null` birakilmaz (CLAUDE.md §3.12).
 */
const DEFAULT_FAILURE_REASON = 'Sağlayıcı ödemenin reddedilme nedenini bildirmedi.';

interface CheckoutActor {
  userId: string;
  email: string;
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly billingRepository: BillingRepository,
    @Inject(PAYMENT_PORT) private readonly payment: PaymentPort,
    @Inject(BILLING_CONFIG) private readonly config: BillingConfig,
  ) {}

  async startCheckout(actor: CheckoutActor): Promise<CheckoutDto> {
    const subscription = await this.billingRepository.getOrCreateSubscription({
      userId: actor.userId,
      currency: this.config.currency,
      provider: this.config.provider,
    });

    if (subscription.status === 'active') {
      throw new ConflictError('SUBSCRIPTION_ALREADY_ACTIVE', 'Aboneliğiniz zaten aktif.');
    }

    // Saglayici cagrisi basarisizsa (502) odeme satiri HIC yazilmaz ve abonelik
    // `pending`e tasinmaz (CLAUDE.md §3.13) — bu yuzden cagri yazmadan ONCE yapilir.
    const session = await this.payment.createCheckout({
      userId: actor.userId,
      email: actor.email,
      amount: this.config.priceAmount,
      currency: this.config.currency,
      callbackUrl: this.config.checkoutCallbackUrl,
    });

    await this.billingRepository.startPayment({
      subscriptionId: subscription.id,
      providerReference: session.transactionReference,
      amount: this.config.priceAmount,
      currency: this.config.currency,
    });

    return toCheckoutDto(session, {
      amount: this.config.priceAmount,
      currency: this.config.currency,
    });
  }

  /**
   * Bildirim idempotandir: ayni referans ikinci kez geldiginde (veya referans hic
   * taninmadiginda) hicbir alan degismez ve endpoint yine 200 doner (CLAUDE.md §3.13).
   */
  async handleNotification(notification: PaymentNotification): Promise<void> {
    const isSucceeded = notification.status === 'succeeded';
    const { applied } = await this.billingRepository.applyNotification({
      providerReference: notification.providerReference,
      paymentStatus: notification.status,
      failureReason: isSucceeded ? null : (notification.failureReason ?? DEFAULT_FAILURE_REASON),
      subscription: isSucceeded
        ? { status: 'active', currentPeriodEnd: this.periodEndFromNow(), skipWhenActive: false }
        : { status: 'inactive', currentPeriodEnd: null, skipWhenActive: true },
    });

    if (!applied) {
      // Mukerrer veya taninmayan bildirim: beklenen ama dikkat cekici (CLAUDE.md §4.4).
      this.logger.warn('Bildirim islenmedi: referans taninmiyor veya daha once islenmis.');
      return;
    }

    this.logger.log(
      isSucceeded ? 'Abonelik aktiflesti.' : 'Odeme reddedildi, abonelik aktife gecmedi.',
    );
  }

  /** Donem sonu SUNUCUDA hesaplanir; gun sayisi yapilandirmadan gelir (CLAUDE.md §5.1). */
  private periodEndFromNow(): Date {
    return new Date(Date.now() + this.config.periodDays * MS_PER_DAY);
  }
}
