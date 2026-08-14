// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); sayfa veri cekmeyi
// bu hook'a devreder.
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import type { PublicReportView } from './public-report.api';
import { fetchPublicReport } from './public-report.api';

const MAX_RETRY_COUNT = 2;

export const publicReportQueryKey = (shareToken: string): readonly string[] => [
  'public-report',
  shareToken,
];

/**
 * Gecersiz token (404) ve hiz siniri (429) tekrar denemekle duzelmez: kiraci hata
 * ekranini beklemeden gorur. Yalnizca sunucu/ag hatalari yeniden denenir.
 */
export function shouldRetryPublicReport(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRY_COUNT;
}

export function usePublicReport(
  client: ApiClient,
  shareToken: string,
): UseQueryResult<PublicReportView> {
  return useQuery({
    queryKey: publicReportQueryKey(shareToken),
    queryFn: () => fetchPublicReport(client, shareToken),
    retry: shouldRetryPublicReport,
  });
}
