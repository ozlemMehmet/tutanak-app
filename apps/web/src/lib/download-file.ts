// Sunucudan gelen ikili govdenin kullaniciya DOSYA olarak sunulmasi (T-020 kriter 2).
// Tarayici sandbox'inda indirme, gecici bir object URL uzerinden tetiklenir; URL islem
// bitince serbest birakilir (design.md ReportDetailPage mobil notu: Blob + object URL).

export function saveBlobAsFile(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  // Bazi tarayicilar yalnizca belgeye bagli ogelerin tiklamasini indirme sayar.
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
}
