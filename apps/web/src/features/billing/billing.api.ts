import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tipler (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type Subscription = components['schemas']['Subscription'];
export type CheckoutResponse = components['schemas']['CheckoutResponse'];

/**
 * Odeme oturumunu baslatir (T-012 sozlesmesi). Tutar ve para birimi SUNUCUDAN gelir
 * (`SUBSCRIPTION_PRICE_AMOUNT` / `SUBSCRIPTION_CURRENCY`) — istemci tarafinda tutar
 * uretilmez, gonderilmez ve float'a parse EDILMEZ (CLAUDE.md §5.1).
 */
export function startCheckout(client: ApiClient): Promise<CheckoutResponse> {
  return client.request<CheckoutResponse>('/billing/checkout', { method: 'POST' });
}
