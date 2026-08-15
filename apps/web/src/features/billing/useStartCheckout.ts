// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); sayfa cagriyi bu hook'a
// devreder.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import { currentUserQueryKey } from '../auth/useCurrentUser';
import type { CheckoutResponse } from './billing.api';
import { startCheckout } from './billing.api';
import { redirectToCheckout } from './checkout-redirect';

/** Istemci hata KODU ile dallanir, mesaj metnine gore DEGIL (CLAUDE.md §4.3). */
export const PAYMENT_PROVIDER_ERROR = 'PAYMENT_PROVIDER_ERROR';
export const SUBSCRIPTION_ALREADY_ACTIVE = 'SUBSCRIPTION_ALREADY_ACTIVE';

export function isApiErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

/**
 * Odemeyi baslatir ve basarili yanitta kullaniciyi saglayicinin sayfasina TAM SAYFA
 * yonlendirir. `409 SUBSCRIPTION_ALREADY_ACTIVE` bir yaris/eskimis-ekran isaretidir:
 * abonelik durumu yeniden cekilir ki ekran gercek durumu gostersin (design.md
 * SubscriptionPage error durumu — "savunma katmani").
 */
export function useStartCheckout(
  client: ApiClient,
  redirect: (url: string) => void = redirectToCheckout,
): UseMutationResult<CheckoutResponse, unknown, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startCheckout(client),
    onSuccess: (checkout) => {
      redirect(checkout.checkoutUrl);
    },
    onError: (error) => {
      if (isApiErrorWithCode(error, SUBSCRIPTION_ALREADY_ACTIVE)) {
        void queryClient.invalidateQueries({ queryKey: currentUserQueryKey });
      }
    },
  });
}
