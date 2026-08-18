/**
 * Mobil yerlesimi (H-006 kriter 4): 390x844'te hicbir ekran yatayda tasmaz. Masaustu
 * kapsayicisi (H-004) mobili daraltmamalidir; bu dosya o yonun regresyonunu da kilitler.
 */
import { expect, test } from '@playwright/test';
import { EKRAN_ADLARI, ekraniAc } from './support/ekranlar';
import { belgeKaydirmaGenisligi } from './support/olcum';
import { MOBIL_VIEWPORT } from './support/viewport';

for (const ekranAdi of EKRAN_ADLARI) {
  test(`${ekranAdi} ekraninda yatay tasma yoktur`, async ({ page }) => {
    expect(page.viewportSize()).toEqual(MOBIL_VIEWPORT);
    await ekraniAc(page, ekranAdi);

    expect(await belgeKaydirmaGenisligi(page)).toBeLessThanOrEqual(MOBIL_VIEWPORT.width);
  });
}
