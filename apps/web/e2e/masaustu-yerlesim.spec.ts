/**
 * Masaustu yerlesimi (H-006 kriter 3) — B-004'un sinifini kilitler: "icerik 1280px'te
 * kenardan kenara yayiliyor". Olcum `getBoundingClientRect()` iledir; jsdom'da bu degerler
 * her zaman 0 oldugu icin bu dosya yalnizca gercek tarayicida anlamlidir.
 */
import { expect, test } from '@playwright/test';
import { EKRAN_ADLARI, ekraniAc } from './support/ekranlar';
import { kutuOlc, yerlesimGenisligi } from './support/olcum';
import { MASAUSTU_VIEWPORT } from './support/viewport';

/** Sol/sag bosluk farkinin kabul edilen ust siniri — ticket kriteri 3. */
const MERKEZLEME_TOLERANSI_PX = 2;

/** Ana icerik kapsayicisi: her ekranin kok `main` ogesi (`.page`, H-004). */
const ANA_KAPSAYICI = 'main.page';

/** Detay ekranindaki birincil eylemler; "Fotoğraf Ekle" bir `label` tetikleyicidir. */
const BIRINCIL_BUTONLAR = ['Fotoğraf Ekle', 'PDF İndir'];

for (const ekranAdi of EKRAN_ADLARI) {
  test(`${ekranAdi} ekraninda ana kapsayici viewport'tan dardir ve ortalanmistir`, async ({
    page,
  }) => {
    expect(page.viewportSize()).toEqual(MASAUSTU_VIEWPORT);
    await ekraniAc(page, ekranAdi);

    const viewportGenisligi = await yerlesimGenisligi(page);
    const kapsayici = await kutuOlc(page.locator(ANA_KAPSAYICI));

    expect(kapsayici.genislik).toBeLessThan(viewportGenisligi);
    const solBosluk = kapsayici.sol;
    const sagBosluk = viewportGenisligi - kapsayici.sag;
    expect(Math.abs(solBosluk - sagBosluk)).toBeLessThanOrEqual(MERKEZLEME_TOLERANSI_PX);
  });
}

for (const buton of BIRINCIL_BUTONLAR) {
  test(`tutanak detayinda "${buton}" butonu viewport genisligini almaz`, async ({ page }) => {
    await ekraniAc(page, 'tutanak detayi');

    const viewportGenisligi = await yerlesimGenisligi(page);
    const kapsayici = await kutuOlc(page.locator(ANA_KAPSAYICI));
    const kutu = await kutuOlc(page.getByText(buton, { exact: true }));

    expect(kutu.genislik).toBeGreaterThan(0);
    expect(kutu.genislik).toBeLessThan(viewportGenisligi);
    // Kapsayiciyi da asamaz: aksi halde "dar kapsayici + tasan buton" sessizce gecerdi.
    expect(kutu.genislik).toBeLessThanOrEqual(kapsayici.genislik);
  });
}
