// Saglayicidan donus davranisi (design.md SubscriptionPage "donus davranisi"): kullanici
// manuel yenileme YAPMAK ZORUNDA KALMAZ. Uc tetikleyici vardir:
//   1. donus adresindeki `?checkout=return` sorgu parametresi (ayni sekmede geri gelis),
//   2. sekmenin yeniden gorunur olmasi (`visibilitychange`) — saglayici sayfasi baska bir
//      uygulamada/sekmede acilip geri donuldugunde parametre gelmeyebilir,
//   3. H-003: abonelik `pending` iken artan aralikli, sinirli sureli YOKLAMA — (1) ve (2)
//      TEK SEFERLIK tetikleyicilerdir ve odeme saglayicisinin webhook'u asenkron oldugu
//      icin cogu zaman webhook ulasmadan ONCE ates alir; yoklama olmadan ekran bir daha
//      hic kontrol edilmez ve kullanici cikmaz sokakta kalir.
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export const CHECKOUT_RETURN_PARAM = 'checkout';
export const CHECKOUT_RETURN_VALUE = 'return';

/**
 * Ardisik yoklama araliklari (ms). Artan araliklidir: webhook tipik olarak ilk saniyelerde
 * geldigi icin basta siktir, gecikme uzadikca seyrekleserek sunucuyu bosuna mesgul etmez.
 * Toplam butce ~88 sn'dir; tukendiginde yoklama DURUR (sonsuz cagri yapilmaz) ve ekran
 * kullaniciya sonraki adimi soyler.
 */
export const SUBSCRIPTION_POLL_DELAYS_MS: readonly number[] = [
  3_000, 5_000, 8_000, 12_000, 15_000, 20_000, 25_000,
];

export interface SubscriptionAutoRefreshResult {
  /** Yoklama butcesi tukendi ve abonelik hala odeme sonucu bekliyor. */
  isPollExhausted: boolean;
}

/**
 * @param refresh Abonelik durumunu yeniden ceken fonksiyon (`GET /me`).
 * @param isAwaitingPayment Abonelik `pending` mi — yoklama yalnizca bu durumda calisir.
 */
export function useSubscriptionAutoRefresh(
  refresh: () => void,
  isAwaitingPayment: boolean,
): SubscriptionAutoRefreshResult {
  const [searchParams] = useSearchParams();
  const isCheckoutReturn = searchParams.get(CHECKOUT_RETURN_PARAM) === CHECKOUT_RETURN_VALUE;

  // Tazeleme fonksiyonunun kimligi her render'da degisebilir; ref ile tasinir ki olay
  // dinleyicisi bir kez baglansin ve donus tetikleyicisi her render'da tekrarlanmasin.
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (isCheckoutReturn) {
      refreshRef.current();
    }
  }, [isCheckoutReturn]);

  useEffect(() => {
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        refreshRef.current();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Sonraki yoklamanin hangi araligi kullanacagi. Her adimda tek bir zamanlayici yasar
  // (`setInterval` degil): aralik artan oldugu icin her adim yeniden planlanir ve durum
  // `pending` olmaktan cikinca temizleme fonksiyonu bekleyen adimi iptal eder.
  const [pollStep, setPollStep] = useState(0);

  useEffect(() => {
    if (!isAwaitingPayment) {
      setPollStep(0);
      return;
    }
    const delayMs = SUBSCRIPTION_POLL_DELAYS_MS[pollStep];
    if (delayMs === undefined) {
      return;
    }
    const timerId = window.setTimeout(() => {
      refreshRef.current();
      setPollStep((step) => step + 1);
    }, delayMs);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [isAwaitingPayment, pollStep]);

  return {
    isPollExhausted: isAwaitingPayment && pollStep >= SUBSCRIPTION_POLL_DELAYS_MS.length,
  };
}
