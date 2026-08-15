// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); sayfa yazma islemini
// bu hook'a devreder.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import { ApiError } from '../../api/client';
import type { ApiClient } from '../../api/client';
import { publicReportQueryKey } from '../sharing/usePublicReport';
import type { Approval } from './approvals.api';
import { approveReport } from './approvals.api';

/**
 * 409 REPORT_ALREADY_APPROVED kullaniciya HATA olarak gosterilmez: iki cihaz/cift tiklama
 * yarisinda sonuc zaten istenen durumdur (tutanak onaylanmis) — design.md PublicReportPage.
 * Istemci mesaj metnine gore degil, hata KODUNA gore dallanir (CLAUDE.md §4.3).
 */
export function isAlreadyApprovedError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'REPORT_ALREADY_APPROVED';
}

export function useApproveReport(
  client: ApiClient,
  shareToken: string,
): UseMutationResult<Approval, unknown, string> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (approverEmail: string) => approveReport(client, shareToken, approverEmail),
    // Onay basarili olduysa VEYA tutanak zaten onayliysa gorunum tazelenir: durum ve onay
    // bilgisi sunucudan okunur, istemcide yeniden kurgulanmaz.
    onSettled: (_approval, error: unknown) => {
      if (error === null || isAlreadyApprovedError(error)) {
        void queryClient.invalidateQueries({ queryKey: publicReportQueryKey(shareToken) });
      }
    },
  });
}
