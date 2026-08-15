// Saglayicidan donus davranisi (design.md SubscriptionPage "donus davranisi"): kullanici
// manuel yenileme YAPMAK ZORUNDA KALMAZ. Iki tetikleyici vardir:
//   1. donus adresindeki `?checkout=return` sorgu parametresi (ayni sekmede geri gelis),
//   2. sekmenin yeniden gorunur olmasi (`visibilitychange`) — saglayici sayfasi baska bir
//      uygulamada/sekmede acilip geri donuldugunde parametre gelmeyebilir.
import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

export const CHECKOUT_RETURN_PARAM = 'checkout';
export const CHECKOUT_RETURN_VALUE = 'return';

export function useSubscriptionAutoRefresh(refresh: () => void): void {
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
}
