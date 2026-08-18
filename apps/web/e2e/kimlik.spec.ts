/**
 * Uygulama kimligi (H-006 kriter 5): H-005 ile duzeltilen Turkce karakterlerin REGRESYONUNU
 * kilitler. Kontrol edilen sey yalnizca metnin varligi degil, dilin ZOR harflerinin
 * (`ğ`, `ı`) bozulmadan tarayiciya ulasmasidir — kodlama hatasi bu harflerde ortaya cikar
 * (bilgi tabani dersi: testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi.md).
 * Suite iki viewport projesinde de kosar.
 */
import { expect, test } from '@playwright/test';

const UYGULAMA_ADI = 'Emlak Teslim Tutanağı';
const KISA_AD = 'Tutanak';

/** WinAnsi/Latin-1'de bulunmayan, kodlama kirilmasinda ilk bozulan harfler. */
const ZOR_HARFLER = ['ğ', 'ı'];

/** Yanlis kodlamanin tipik izleri (`Ã¼` gibi mojibake ve degistirme karakteri). */
const BOZUK_KODLAMA_IZI = /[ÃÂ]|�/;

test('document.title uygulama adini Turkce karakterlerle tasir', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveTitle(UYGULAMA_ADI);
  const baslik = await page.title();
  for (const harf of ZOR_HARFLER) {
    expect(baslik).toContain(harf);
  }
  expect(baslik).not.toMatch(BOZUK_KODLAMA_IZI);
});

test('manifest.webmanifest name alani Turkce karakterlerle sunulur', async ({ page }) => {
  const yanit = await page.request.get('/manifest.webmanifest');
  expect(yanit.status()).toBe(200);

  const manifest = (await yanit.json()) as { name: string; short_name: string };

  expect(manifest.name).toBe(UYGULAMA_ADI);
  expect(manifest.short_name).toBe(KISA_AD);
  for (const harf of ZOR_HARFLER) {
    expect(manifest.name).toContain(harf);
  }
  expect(manifest.name).not.toMatch(BOZUK_KODLAMA_IZI);
});
