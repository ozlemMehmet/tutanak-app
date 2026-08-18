/**
 * Kurulum projesinin urettigi kosum artefaktlari (H-006 kriter 6/7).
 *
 * Oturum bir kez kurulur ve iki viewport projesi ayni durumu kullanir: `/auth/register` ve
 * `/auth/login` uclarinin siki hiz siniri (`AUTH_RATE_LIMIT_MAX_REQUESTS`, pencere basina 5)
 * her testte yeniden kayit/giris yapmayi KARARSIZ hale getirirdi — art arda iki kosumda
 * ikinci kosum 429 alirdi. Durum dosyasi elle uydurulmus bir token DEGILDIR: icerigi gercek
 * UI akisindan (kayit + giris) dogar.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SUPPORT_DIZINI = dirname(fileURLToPath(import.meta.url));
/** Kosum ciktisi; surum kontrolune girmez (.gitignore). */
const DURUM_DIZINI = join(SUPPORT_DIZINI, '..', '.durum');

/** Playwright `storageState` dosyasi (kurulum projesi yazar, digerleri okur). */
export const OTURUM_DOSYASI = join(DURUM_DIZINI, 'oturum.json');

const TUTANAK_DOSYASI = join(DURUM_DIZINI, 'tutanak.json');

export interface TutanakBilgisi {
  /** Detay ekraninin yolu, ornegin `/reports/<uuid>`. */
  yol: string;
  baslik: string;
}

export function tutanakBilgisiYaz(bilgi: TutanakBilgisi): void {
  mkdirSync(DURUM_DIZINI, { recursive: true });
  writeFileSync(TUTANAK_DOSYASI, JSON.stringify(bilgi), 'utf8');
}

export function tutanakBilgisiOku(): TutanakBilgisi {
  return JSON.parse(readFileSync(TUTANAK_DOSYASI, 'utf8')) as TutanakBilgisi;
}
