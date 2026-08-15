// Taslak olusturma yazma islemi (CLAUDE.md §3.9). Yonlendirme ve liste yenileme sayfanin
// isidir: rota bilgisi mutation'a sizmaz (useLogin ile ayni yaklasim).
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import type { CreateReportRequest, Report } from './reports.api';
import { createReport } from './reports.api';

export function useCreateReport(
  client: ApiClient,
): UseMutationResult<Report, unknown, CreateReportRequest> {
  return useMutation({
    mutationFn: (input: CreateReportRequest) => createReport(client, input),
  });
}
