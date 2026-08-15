// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); sayfa veri cekmeyi
// bu hook'a devreder.
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import type { ReportDetail } from './reports.api';
import { fetchReport } from './reports.api';

export const reportQueryKey = (reportId: string): readonly string[] => ['report', reportId];

export function useReport(client: ApiClient, reportId: string): UseQueryResult<ReportDetail> {
  return useQuery({
    queryKey: reportQueryKey(reportId),
    queryFn: () => fetchReport(client, reportId),
  });
}
