import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tip (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type Photo = components['schemas']['Photo'];

const photosPath = (reportId: string): string => `/reports/${reportId}/photos`;

/**
 * Fotografi tutanaga ekler. Govdeye YALNIZCA `file` konur: hicbir tarih/sira alani
 * gonderilmez, damga (`capturedAt`) ve sira sunucuda uretilir (CLAUDE.md §3.7, §3.14).
 */
export function uploadPhoto(client: ApiClient, reportId: string, file: File): Promise<Photo> {
  const body = new FormData();
  body.append('file', file);
  return client.request<Photo>(photosPath(reportId), { method: 'POST', body });
}

/** Tutanagin fotograflarini sunucunun verdigi sirada (sort_order, captured_at) doner. */
export function fetchPhotos(client: ApiClient, reportId: string): Promise<Photo[]> {
  return client.request<Photo[]>(photosPath(reportId));
}
