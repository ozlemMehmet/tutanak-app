// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); sayfa veri cekmeyi bu
// hook'a devreder.
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import type { Template } from './reports.api';
import { fetchTemplates } from './reports.api';

/**
 * Ekranin kendi "Tekrar Dene" butonu vardir (design.md §3 hata durumu), bu yuzden otomatik
 * deneme sayisi bilincli olarak digerlerinden (AppShell/paylasim ekrani: 2) dusuktur: tek
 * deneme anlik bir kesintiyi yutar, kalici hatada kullanici hata durumunu ~1 saniyede gorur
 * ve yeniden denemeyi kendisi tetikler. Varsayilan politika (3 deneme, ustel bekleme) hata
 * durumunu ~7 saniye geciktirip kullaniciyi iskelet kartlarda birakiyordu.
 */
const MAX_RETRY_COUNT = 1;

export const templatesQueryKey: readonly string[] = ['templates'];

/** Istemci hatalari (4xx) tekrar denemekle duzelmez; yalnizca sunucu/ag hatalari denenir. */
export function shouldRetryTemplates(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRY_COUNT;
}

export function useTemplates(client: ApiClient): UseQueryResult<Template[]> {
  return useQuery({
    queryKey: templatesQueryKey,
    queryFn: () => fetchTemplates(client),
    retry: shouldRetryTemplates,
  });
}
