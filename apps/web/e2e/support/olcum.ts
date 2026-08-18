/**
 * Yerlesim olcumleri (H-006 kriter 3/4). Olcum GOZLE degil `getBoundingClientRect()` ile
 * yapilir; jsdom bu degerleri her zaman 0 dondurdugu icin bu sinif ancak gercek tarayicida
 * dogrulanabilir (ticket kapsami).
 */
import { expect, type Locator, type Page } from '@playwright/test';

export interface KutuOlcumu {
  sol: number;
  sag: number;
  genislik: number;
}

/** Olculecek ogenin ekranda oldugundan emin olup kutusunu dondurur. */
export async function kutuOlc(locator: Locator): Promise<KutuOlcumu> {
  await expect(locator).toBeVisible();
  return locator.evaluate((element) => {
    const kutu = element.getBoundingClientRect();
    return { sol: kutu.left, sag: kutu.right, genislik: kutu.width };
  });
}

/**
 * Yerlesim viewport'unun genisligi. `window.innerWidth` degil `clientWidth` okunur: dikey
 * kaydirma cubugu innerWidth'e dahildir ve ortalanma farkini sahte sekilde buyuturdu.
 */
export function yerlesimGenisligi(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.clientWidth);
}

/** Belgenin kaydirilabilir genisligi — viewport'tan buyukse yatay tasma vardir. */
export function belgeKaydirmaGenisligi(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}
