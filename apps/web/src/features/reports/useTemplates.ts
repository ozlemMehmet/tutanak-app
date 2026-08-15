// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); sayfa veri cekmeyi bu
// hook'a devreder.
import { useQuery } from '@tanstack/react-query';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import type { Template } from './reports.api';
import { fetchTemplates } from './reports.api';

export const templatesQueryKey: readonly string[] = ['templates'];

export function useTemplates(client: ApiClient): UseQueryResult<Template[]> {
  return useQuery({
    queryKey: templatesQueryKey,
    queryFn: () => fetchTemplates(client),
  });
}
