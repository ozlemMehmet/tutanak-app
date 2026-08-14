import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tipler (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type PublicReportView = components['schemas']['PublicReportView'];
export type PublicPhoto = components['schemas']['PublicPhoto'];

/**
 * Paylasim linkindeki token ile tutanagin salt-okunur gorunumunu ceker (T-009).
 * Endpoint kimlik dogrulamasi ISTEMEZ; istemci de bu cagri icin token/oturum kurmaz.
 * Bu modulde YALNIZCA okuma cagrisi vardir: gorunume ait hicbir yazma islemi yoktur.
 */
export function fetchPublicReport(
  client: ApiClient,
  shareToken: string,
): Promise<PublicReportView> {
  return client.request<PublicReportView>(`/public/reports/${encodeURIComponent(shareToken)}`);
}
