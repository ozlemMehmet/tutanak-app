// Sunucu durumu TanStack Query ile yonetilir (CLAUDE.md §3.9); bilesenler veri cekmeyi
// bu hook'lara devreder.
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import type { ShareDelivery, ShareLink } from './sharing.api';
import { createShareLink, sendShareEmail } from './sharing.api';

/** Panel acildiginda cagrilir; endpoint idempotent oldugu icin tekrar cagrilmasi guvenlidir. */
export function useCreateShareLink(
  client: ApiClient,
  reportId: string,
): UseMutationResult<ShareLink, unknown, void> {
  return useMutation({ mutationFn: () => createShareLink(client, reportId) });
}

/**
 * E-posta gonderiminden ONCE her zaman (idempotent) link uretimi cagrilir — design.md
 * ReportDetailPage is kurali: e-posta endpoint'i link URETMEZ (CLAUDE.md §3.10) ve
 * 404 SHARE_LINK_NOT_FOUND kullaniciya hicbir zaman yansimamalidir.
 */
export function useSendShareEmail(
  client: ApiClient,
  reportId: string,
): UseMutationResult<ShareDelivery, unknown, string> {
  return useMutation({
    mutationFn: async (recipientEmail: string) => {
      await createShareLink(client, reportId);
      return sendShareEmail(client, reportId, recipientEmail);
    },
  });
}
