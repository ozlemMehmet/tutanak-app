// Paylasim API cagrilari (T-008). Ag cagrilari YALNIZCA client uzerinden yapilir
// (CLAUDE.md §3.9); tipler sozlesmeden URETILIR (§3.6), elle kopya tutulmaz.
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

export type ShareLink = components['schemas']['ShareLink'];
export type ShareDelivery = components['schemas']['ShareDelivery'];

const shareLinkPath = (reportId: string): string => `/reports/${reportId}/share-link`;

/**
 * Paylasim linkini uretir. Endpoint idempotenttir: ayni tutanak icin ikinci cagri
 * AYNI token'i doner (T-008 kriter 3) — bu yuzden panel her acildiginda guvenle cagrilir.
 */
export function createShareLink(client: ApiClient, reportId: string): Promise<ShareLink> {
  return client.request<ShareLink>(shareLinkPath(reportId), { method: 'POST' });
}

/** Linki e-posta ile gonderir; sonuc (sent/failed) YANIT govdesinde belirtilir (kriter 4). */
export function sendShareEmail(
  client: ApiClient,
  reportId: string,
  recipientEmail: string,
): Promise<ShareDelivery> {
  return client.request<ShareDelivery>(`${shareLinkPath(reportId)}/email`, {
    method: 'POST',
    body: JSON.stringify({ recipientEmail }),
  });
}
