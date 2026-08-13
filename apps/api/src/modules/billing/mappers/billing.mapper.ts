// Dis (saglayici oturumu) -> ic (DTO) donusumu (CLAUDE.md §3.5, §7 Mapper): yanit govdesi
// YALNIZCA burada kurulur; controller ve servis elle alan kopyalamaz.

import type { CheckoutSession } from '../../../infra/payment/payment.port';
import type { CheckoutDto } from '../dto/billing.dto';

interface PriceView {
  /** SUBSCRIPTION_PRICE_AMOUNT — METIN olarak tasinir, float'a cevrilmez. */
  amount: string;
  currency: string;
}

export function toCheckoutDto(session: CheckoutSession, price: PriceView): CheckoutDto {
  return {
    transactionReference: session.transactionReference,
    checkoutUrl: session.checkoutUrl,
    amount: price.amount,
    currency: price.currency,
  };
}
