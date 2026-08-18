/**
 * H-006 kriter 2: suite'in kostugu iki viewport. Degerler TEK yerde tanimlanir; hem
 * `playwright.config.ts` projeleri hem de olcum testlerinin beklentileri buradan okur —
 * boylece "config 1280, test 1200 varsayiyor" tarzi sessiz sapma imkansizdir.
 */
export interface Viewport {
  width: number;
  height: number;
}

/** Masaustu referans viewport'u (H-006 kriter 2). */
export const MASAUSTU_VIEWPORT: Viewport = { width: 1280, height: 900 };

/** Mobil referans viewport'u (H-006 kriter 2). */
export const MOBIL_VIEWPORT: Viewport = { width: 390, height: 844 };
