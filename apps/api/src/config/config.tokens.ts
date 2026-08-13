// Yapilandirma degerlerinin DI token'lari. Bu dosya YAN ETKISIZDIR (modul dekoratoru
// icermez), boylece servisler token'i env dogrulamasini tetiklemeden import edebilir.

/** GET /me varsayilan abonelik yanitinin para birimi (CLAUDE.md §3.11, §5.1). */
export const SUBSCRIPTION_CURRENCY = 'SUBSCRIPTION_CURRENCY';

/** Abonelik/odeme akisinin yapilandirmasi (CLAUDE.md §5.1) — T-012. */
export const BILLING_CONFIG = 'BillingConfig';

export interface BillingConfig {
  /** SUBSCRIPTION_PRICE_AMOUNT — ondalikli METIN; float'a cevrilmez. */
  priceAmount: string;
  /** SUBSCRIPTION_CURRENCY. */
  currency: string;
  /** SUBSCRIPTION_PERIOD_DAYS — current_period_end bu degerden hesaplanir. */
  periodDays: number;
  /** PAYMENT_PROVIDER — subscriptions.provider sutununa yazilan deger. */
  provider: string;
  /** Saglayicinin odeme sonrasi kullaniciyi dondurecegi adres (PUBLIC_APP_URL tabanli). */
  checkoutCallbackUrl: string;
}
