// Tutanak akisinin sozlesme yuzeyi: hazir sablonlar (T-004), taslak olusturma (T-005),
// tutanak detayi ve PDF ciktisi (T-020).
// Ag cagrisi YALNIZCA `api/client.ts` uzerinden yapilir (CLAUDE.md §3.9).
import type { ApiClient, FileResponse } from '../../api/client';
import type { components } from '../../api/schema';

/** Sozlesmeden URETILEN tipler (CLAUDE.md §3.6); elle yazilmis kopya tutulmaz. */
export type Template = components['schemas']['Template'];
export type Report = components['schemas']['Report'];
export type ReportDetail = components['schemas']['ReportDetail'];
export type ReportStatus = components['schemas']['ReportStatus'];
export type CreateReportRequest = components['schemas']['CreateReportRequest'];

/** Sozlesme tam olarak 3 kayit garanti eder; sira sunucudan geldigi gibi korunur. */
export function fetchTemplates(client: ApiClient): Promise<Template[]> {
  return client.request<Template[]>('/templates');
}

/**
 * Tutanak detayi (baslik, sablon adi, not, durum ve varsa onay). `approval` alani onay
 * yokken yanitta HIC BULUNMAZ (CLAUDE.md §3.5): istemci onayi `status` uzerinden anlar.
 */
export function fetchReport(client: ApiClient, reportId: string): Promise<ReportDetail> {
  return client.request<ReportDetail>(`/reports/${reportId}`);
}

/** Tutanagin PDF ciktisi: yanit `application/pdf` oldugu icin ikili govde okunur. */
export function downloadReportPdf(client: ApiClient, reportId: string): Promise<FileResponse> {
  return client.requestFile(`/reports/${reportId}/pdf`);
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
