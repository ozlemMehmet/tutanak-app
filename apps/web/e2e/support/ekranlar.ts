/**
 * Suite'in gezdigi uc ekran (H-006 kriter 6): tutanak listesi, yeni tutanak, tutanak detayi.
 * Her ekran icin "hazir" tanimi da burada yasar — olcum, iskelet/yukleniyor durumunda degil
 * verinin geldigi durumda yapilir. Bekleme locator auto-wait ile olur, sabit sure ile degil.
 *
 * Ekranlar AD ile parametrelenir, nesne ile degil: adres/baslik bilgisi kurulum projesinin
 * urettigi dosyadan gelir ve o dosya, Playwright test dosyalarini TOPLARKEN henuz yoktur —
 * cozumleme bu yuzden test govdesinde (kosum aninda) yapilir.
 */
import { expect, type Page } from '@playwright/test';
import { tutanakBilgisiOku } from './durum';

export const EKRAN_ADLARI = ['tutanak listesi', 'yeni tutanak', 'tutanak detayi'] as const;

export type EkranAdi = (typeof EKRAN_ADLARI)[number];

export interface Ekran {
  ad: EkranAdi;
  yol: string;
  hazirOl: (page: Page) => Promise<void>;
}

export function ekranCoz(ad: EkranAdi): Ekran {
  const tutanak = tutanakBilgisiOku();

  switch (ad) {
    case 'tutanak listesi':
      return {
        ad,
        yol: '/reports',
        // Baslik degil KAYIT beklenir: iskelet durumunda olcum yapilmamalidir.
        hazirOl: async (page) => {
          await expect(page.getByText(tutanak.baslik).first()).toBeVisible();
        },
      };
    case 'yeni tutanak':
      return {
        ad,
        yol: '/reports/new',
        hazirOl: async (page) => {
          await expect(page.getByRole('radio').first()).toBeVisible();
        },
      };
    case 'tutanak detayi':
      return {
        ad,
        yol: tutanak.yol,
        hazirOl: async (page) => {
          await expect(page.getByRole('heading', { name: tutanak.baslik })).toBeVisible();
        },
      };
  }
}

/** Ekrani acar ve olcume hazir olana kadar bekler. */
export async function ekraniAc(page: Page, ad: EkranAdi): Promise<void> {
  const ekran = ekranCoz(ad);
  await page.goto(ekran.yol);
  await ekran.hazirOl(page);
}
