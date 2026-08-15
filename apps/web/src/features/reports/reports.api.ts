// Tutanak akisinin sozlesme yuzeyi: hazir sablonlar (T-004) ve taslak olusturma (T-005).
// Ag cagrisi YALNIZCA `api/client.ts` uzerinden yapilir (CLAUDE.md §3.9).
import type { ApiClient } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tipler (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type Template = components['schemas']['Template'];
export type Report = components['schemas']['Report'];
export type CreateReportRequest = components['schemas']['CreateReportRequest'];

/** Sozlesme tam olarak 3 kayit garanti eder; sira sunucudan geldigi gibi korunur. */
export function fetchTemplates(client: ApiClient): Promise<Template[]> {
  return client.request<Template[]>('/templates');
}

/**
 * Taslak olusturur. Govdeye yalnizca sozlesmedeki uc alan konur: durum ve zaman damgalari
 * sunucuda uretilir (CLAUDE.md §3.7) ve govde katiligi geregi (§3.7) fazladan alan 400 verir.
 */
export function createReport(client: ApiClient, input: CreateReportRequest): Promise<Report> {
  return client.request<Report>('/reports', {
    method: 'POST',
    body: JSON.stringify({ templateId: input.templateId, title: input.title, note: input.note }),
  });
}
