// PDF'e islenen tarih-saat damgalarinin bicimi (T-007). Saf fonksiyon — DI gerekmez.

/**
 * Damgalarin yazildigi saat dilimi. Urun tek pazara (Turkiye) ozeldir ve PDF basili bir
 * belgedir: damganin hangi saat diliminde oldugu okuyucuya gorunmedigi icin sunucunun
 * (container'in) yerel saatine BIRAKILAMAZ — ayni tutanak farkli sunucularda farkli saat
 * gosterirdi. Yapilandirma degeri degildir: CLAUDE.md §5.1 tablosunda karsiligi yoktur ve
 * dev kendi env adini icat etmez (devlog: "anayasa boslugu").
 */
export const REPORT_STAMP_TIME_ZONE = 'Europe/Istanbul';

/** Belgedeki tum damgalar ayni yerellik ile yazilir (ornek: 14.08.2026 13:45:12). */
const STAMP_LOCALE = 'tr-TR';

/** Veritabaninin urettigi damgayi (CLAUDE.md §3.7) okunabilir yerel tarih-saate cevirir. */
export function formatReportStamp(value: Date, timeZone: string = REPORT_STAMP_TIME_ZONE): string {
  return new Intl.DateTimeFormat(STAMP_LOCALE, {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone,
  }).format(value);
}
