// SubscriptionPage (`/subscription`) — design.md §2.4 akisi + §3 SubscriptionPage
// sartnamesi. Sayfa veri cekmeyi hook'lara devreder (CLAUDE.md §3.9); kendisi yalnizca
// durum bazli duzeni kurar: durum karti + aksiyon alani.
import { useCallback } from 'react';
import type { ApiClient } from '../api/client';
import { ApiError } from '../api/client';
import { useCurrentUser } from '../features/auth/useCurrentUser';
import { redirectToCheckout } from '../features/billing/checkout-redirect';
import { SubscriptionStatusCard } from '../features/billing/SubscriptionStatusCard';
import {
  isApiErrorWithCode,
  PAYMENT_PROVIDER_ERROR,
  SUBSCRIPTION_ALREADY_ACTIVE,
  useStartCheckout,
} from '../features/billing/useStartCheckout';
import { useSubscriptionAutoRefresh } from '../features/billing/useSubscriptionAutoRefresh';

interface SubscriptionPageProps {
  client: ApiClient;
  /** Tam sayfa yonlendirme; testte sahte fonksiyon verilebilsin diye disaridan alinir. */
  redirect?: (url: string) => void;
}

const GENERIC_ERROR_MESSAGE = 'Beklenmeyen bir hata olustu, lutfen tekrar deneyin.';

const PENDING_WAITING_MESSAGE = 'Odeme sonucu bekleniyor, abonelik henuz aktif degil';

/**
 * H-003: yoklama butcesi tukendiginde ekran sessiz bir uyari metninde donup kalmaz;
 * kullaniciya ODEME ALINDIYSA ne olacagini ve ALINMADIYSA ne yapmasi gerektigini soyler.
 */
const PENDING_TIMEOUT_MESSAGE =
  'Odeme sonucu hala alinamadi. Odemeniz alindiysa abonelik kisa sure icinde aktiflesir; ' +
  '"Durumu yenile" ile kontrol edebilir veya daha sonra bu sayfaya donebilirsiniz. Odemeniz ' +
  'alinmadiysa odeme adimini bastan baslatmaniz gerekir.';

function errorMessageOf(error: unknown): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message === '' ? GENERIC_ERROR_MESSAGE : error.message;
  }
  return GENERIC_ERROR_MESSAGE;
}

export function SubscriptionPage({
  client,
  redirect = redirectToCheckout,
}: SubscriptionPageProps): React.JSX.Element {
  const currentUser = useCurrentUser(client);
  const checkout = useStartCheckout(client, redirect);

  const { refetch } = currentUser;
  const refreshSubscription = useCallback((): void => {
    void refetch();
  }, [refetch]);
  const subscription = currentUser.data?.subscription;
  const isAwaitingPayment = subscription?.status === 'pending';
  const { isPollExhausted } = useSubscriptionAutoRefresh(refreshSubscription, isAwaitingPayment);

  return (
    <main className="page">
      <h1>Abonelik</h1>

      {/* loading: durum karti iskeleti (design.md SubscriptionPage durumlari). */}
      {currentUser.isPending && <p className="skeleton-text">Abonelik durumu yukleniyor...</p>}

      {/* `GET /me` basarisiz: ekranin tek isi durum gostermek oldugu icin sessiz kalamaz.
          Kod tabanindaki sorgu-hatasi deseni (PhotoSection) birebir uygulanir: danger
          banner + "Tekrar Dene". */}
      {currentUser.isError && (
        <div className="banner banner--danger" role="alert">
          <p>Abonelik durumu yuklenemedi</p>
          <button
            type="button"
            className="button button--ghost"
            onClick={() => {
              void currentUser.refetch();
            }}
          >
            Tekrar Dene
          </button>
        </div>
      )}

      {subscription !== undefined && (
        <>
          <SubscriptionStatusCard subscription={subscription} />

          {/* Odeme saglayicisina ulasilamadi: gercekten BLOKE eden hata -> `danger`. */}
          {isApiErrorWithCode(checkout.error, PAYMENT_PROVIDER_ERROR) && (
            <p className="banner banner--danger" role="alert">
              Odeme saglayicisina ulasilamadi, tekrar deneyin
            </p>
          )}

          {/* Akisi durdurmayan bilgi durumu -> `warning` (design.md §4.1 renk anlami). */}
          {isApiErrorWithCode(checkout.error, SUBSCRIPTION_ALREADY_ACTIVE) && (
            <p className="banner banner--warning" role="status">
              Aboneliginiz zaten aktif.
            </p>
          )}

          {checkout.isError &&
            !isApiErrorWithCode(checkout.error, PAYMENT_PROVIDER_ERROR) &&
            !isApiErrorWithCode(checkout.error, SUBSCRIPTION_ALREADY_ACTIVE) && (
              <p className="banner banner--danger" role="alert">
                {errorMessageOf(checkout.error)}
              </p>
            )}

          {subscription.status === 'inactive' && (
            <button
              type="button"
              className="button button--primary subscription__pay"
              disabled={checkout.isPending}
              onClick={() => {
                checkout.mutate();
              }}
            >
              Odeme Yap
            </button>
          )}

          {/* H-003: `pending` cikmaz sokak degildir — durum yoklanir, kullanici her an
              elle yenileyebilir ve yoklama tukenince sonraki adim acikca soylenir. */}
          {subscription.status === 'pending' && (
            <div className="banner banner--warning" role="status">
              {isPollExhausted ? (
                <p data-testid="abonelik-bekleme-zaman-asimi">{PENDING_TIMEOUT_MESSAGE}</p>
              ) : (
                <p>{PENDING_WAITING_MESSAGE}</p>
              )}
              <button type="button" className="button button--ghost" onClick={refreshSubscription}>
                Durumu yenile
              </button>
            </div>
          )}

          {subscription.status === 'active' && (
            <p className="banner banner--success" role="status">
              Aboneliginiz aktif
            </p>
          )}
        </>
      )}
    </main>
  );
}
