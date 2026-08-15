// PDF indirme (T-020 kriter 2): sunucudan gelen `application/pdf` govdesi kullaniciya
// dosya olarak sunulur. Indirme bir sunucu MUTASYONU degildir ama tek seferlik, kullanici
// tetikli bir eylemdir; onbelleklenmemesi icin `useQuery` yerine `useMutation` kullanilir.
import { useMutation } from '@tanstack/react-query';
import type { UseMutationResult } from '@tanstack/react-query';
import type { ApiClient } from '../../api/client';
import { saveBlobAsFile } from '../../lib/download-file';
import { downloadReportPdf } from './reports.api';

/** Sunucu `Content-Disposition` gondermezse kullanilan ad (sozlesmedeki bicimle ayni). */
const fallbackFileName = (reportId: string): string => `tutanak-${reportId}.pdf`;

export function useDownloadReportPdf(
  client: ApiClient,
  reportId: string,
): UseMutationResult<void, unknown, void> {
  return useMutation({
    mutationFn: async () => {
      const file = await downloadReportPdf(client, reportId);
      saveBlobAsFile(file.blob, file.fileName ?? fallbackFileName(reportId));
    },
  });
}
