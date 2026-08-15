// Tutanak basina fotograf ust siniri (T-020 kriter 5): sinira ULASILDIGINDA ekleme girisi
// 409 PHOTO_LIMIT_REACHED beklenmeden proaktif olarak kapatilir (design.md → ReportDetailPage).
//
// Deger sunucuda `PHOTO_MAX_PER_REPORT` yapilandirmasindan gelir ve api-contract.yaml'da
// 30 olarak BEYAN EDILMISTIR; istemciye gonderildigi bir alan/uc nokta sozlesmede yoktur.
// Sunucu yine son sozu soyler: sinir asilirsa 409 zarfi kullaniciya toast olarak gosterilir.
export const PHOTO_MAX_PER_REPORT = 30;

export function isPhotoLimitReachedByCount(photoCount: number): boolean {
  return photoCount >= PHOTO_MAX_PER_REPORT;
}
