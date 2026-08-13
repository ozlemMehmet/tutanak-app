// Sunucu damgasinin (ISO 8601) kullaniciya gosterilen bicimi. Bicimleme SUNUCU degerini
// degistirmez; yalnizca okunur hale getirir (CLAUDE.md §3.7: damga sunucuda uretilir).

const STAMP_FORMAT = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatStamp(isoStamp: string): string {
  const value = new Date(isoStamp);
  if (Number.isNaN(value.getTime())) {
    // Cozumlenemeyen damga gizlenmez: ham deger gosterilir (kanit degeri kaybolmasin).
    return isoStamp;
  }
  return STAMP_FORMAT.format(value);
}
