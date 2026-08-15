// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); AppShell veri cekmeyi
// bu hook'a devreder.
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import type { MeResponse } from './auth.api';
import { fetchCurrentUser } from './auth.api';

const MAX_RETRY_COUNT = 2;

export const currentUserQueryKey: readonly string[] = ['current-user'];

/**
 * 401 (oturum bitti) ve 429 (hiz siniri) tekrar denemekle duzelmez; 401'de zaten oturum
 * temizlenip `/login`'e gidilir, tekrar denemek yonlendirmeyi geciktirir.
 */
export function shouldRetryCurrentUser(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRY_COUNT;
}

export function useCurrentUser(client: ApiClient): UseQueryResult<MeResponse> {
  return useQuery({
    queryKey: currentUserQueryKey,
    queryFn: () => fetchCurrentUser(client),
    retry: shouldRetryCurrentUser,
  });
}
