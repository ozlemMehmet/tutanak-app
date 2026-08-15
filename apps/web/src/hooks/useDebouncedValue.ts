// Yazma durduktan sonra degeri yayinlayan genel gecikme hook'u. Arama kutusunun her tus
// vurusunda istek yapmasini engeller (T-021 kriter 2).
import { useEffect, useState } from 'react';

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    // Deger yeniden degisirse bekleyen yayin iptal edilir: yalnizca SON deger yayinlanir
    // ve bilesen kaldirildiginda zamanlayici arkada kalmaz.
    return () => {
      clearTimeout(timer);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
