// Odeme saglayicisi sinir arayuzu (CLAUDE.md §7 Adapter + Port, §3.3).
// modules/billing yalnizca bu arayuzu ve KANONIK bildirim seklini gorur; saglayiciya
// ozgu alan adlari adapter'in disina CIKMAZ (architecture.md §8.5).

export interface CheckoutRequest {
  userId: string;
  email: string;
  /** Ondalikli METIN (SUBSCRIPTION_PRICE_AMOUNT); float'a cevrilmez (CLAUDE.md §5.1). */
  amount: string;
  currency: string;
  /** Odeme sonrasi kullanicinin dondurulecegi adres (yapilandirmadan gelir). */
  callbackUrl: string;
}

export interface CheckoutSession {
  /** payment_transactions.provider_reference sutununa BIREBIR yazilan deger. */
  transactionReference: string;
  checkoutUrl: string;
}

export type PaymentNotificationStatus = 'succeeded' | 'failed';

/** api-contract.yaml → PaymentWebhookRequest (kanonik/normalize edilmis sekil). */
export interface PaymentNotification {
  providerReference: string;
  status: PaymentNotificationStatus;
  failureReason: string | null;
}

export interface PaymentPort {
  createCheckout(request: CheckoutRequest): Promise<CheckoutSession>;
  /**
   * Imzayi HAM govde uzerinde dogrular ve saglayici govdesini kanonik sekle cevirir
   * (architecture.md §8.5). Imza gecersizse UnauthenticatedError('INVALID_WEBHOOK_SIGNATURE'),
   * zorunlu alanlar eksik/gecersizse ValidationError firlatir; sema disi alanlar
   * sessizce ayiklanir ve 400 URETMEZ (CLAUDE.md §3.7 istisna 2).
   */
  verifyAndParseNotification(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): PaymentNotification;
}

/** Nest DI token'i: arayuzler calisma zamaninda token olamaz. */
export const PAYMENT_PORT = 'PaymentPort';
