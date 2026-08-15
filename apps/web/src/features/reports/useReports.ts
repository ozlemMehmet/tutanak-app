// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); liste ekrani veri cekmeyi
// bu hook'a devreder.
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import type { ReportListQuery, ReportListResponse } from './reports.api';
import { fetchReports } from './reports.api';

/**
 * Ekranin kendi "Tekrar Dene" butonu vardir (design.md §3 hata durumu): tek otomatik deneme
 * anlik kesintiyi yutar, kalici hatada kullanici hata durumunu beklemeden gorur. Politika
 * `useTemplates` ile aynidir; ortak bir yardimciya cikarmak baska bir ticket'in dosyasini
 * refactor etmek olurdu (kapsam disi — devlog).
 */
const MAX_RETRY_COUNT = 1;

/** Arama terimi ve sayfa anahtarin parcasidir: ikisi de degisince yeni istek yapilir. */
export const reportListQueryKey = (query: ReportListQuery): readonly unknown[] => [
  'reports',
  query.q,
  query.page,
];

/** Istemci hatalari (4xx) tekrar denemekle duzelmez; yalnizca sunucu/ag hatalari denenir. */
export function shouldRetryReportList(failureCount: number, error: Error): boolean {
  if (error instanceof ApiError && error.status < 500) {
    return false;
  }
  return failureCount < MAX_RETRY_COUNT;
}

export function useReports(
  client: ApiClient,
  query: ReportListQuery,
): UseQueryResult<ReportListResponse> {
  return useQuery({
    queryKey: reportListQueryKey(query),
    queryFn: () => fetchReports(client, query),
    retry: shouldRetryReportList,
  });
}
