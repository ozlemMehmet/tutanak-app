// Onay API cagrisi (T-010). Ag cagrilari YALNIZCA client uzerinden yapilir (CLAUDE.md
// §3.9); tipler sozlesmeden URETILIR (§3.6), elle kopya tutulmaz.
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

export type Approval = components['schemas']['Approval'];

/**
 * Kiracinin tek tikla onayi. Istek kimlik dogrulamasi ISTEMEZ (paylasim token'i tek
 * anahtardir) ve govdede YALNIZCA `approverEmail` tasir: onay damgasi sunucuda uretilir
 * (CLAUDE.md §3.7). Ayni link icin ikinci cagri 409 ile reddedilir.
 */
export function approveReport(
  client: ApiClient,
  shareToken: string,
  approverEmail: string,
): Promise<Approval> {
  return client.request<Approval>(`/public/reports/${encodeURIComponent(shareToken)}/approval`, {
    method: 'POST',
    body: JSON.stringify({ approverEmail }),
  });
}
