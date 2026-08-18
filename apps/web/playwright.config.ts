/**
 * Tarayici seviyesindeki yerlesim suite'i (H-006). jsdom'un yerlesim motoru YOKTUR
 * (`getBoundingClientRect()` 0 doner, CSS cascade uygulanmaz, viewport kavrami yoktur), bu
 * yuzden "icerik masaustunde kenardan kenara yayiliyor" sinifi ancak burada gorunur.
 *
 * Suite CALISAN bir yigin ister (`docker compose up -d`); yigin baslatmayi kendisi
 * USTLENMEZ (`webServer` tanimlanmaz) — API + DB + MinIO zinciri compose'un isidir ve
 * suite'in yerelde/CI'da ayni sekilde kosmasi buna baglidir. Adres `E2E_BASE_URL` ile
 * degistirilebilir; varsayilan yerel dev sunucusudur (README).
 */
import { defineConfig } from '@playwright/test';
import { OTURUM_DOSYASI } from './e2e/support/durum';
import { MASAUSTU_VIEWPORT, MOBIL_VIEWPORT } from './e2e/support/viewport';

const VARSAYILAN_ADRES = 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  // Kararlilik (kriter 7): yeniden deneme YOK — flaky test tekrarla gizlenmez (CLAUDE.md §8.8).
  retries: 0,
  // Tek worker: senaryolar ayni kullaniciyi ve ayni tutanagi paylasir; ayrica kimlik uclarinin
  // siki hiz siniri (pencere basina 5 istek) paralel kosumda kosuma bagli 429 uretirdi.
  workers: 1,
  fullyParallel: false,
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? VARSAYILAN_ADRES,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // Oturumu gercek kayit + giris akisiyla bir kez kurar (kriter 6).
      name: 'kurulum',
      testMatch: '**/kurulum.setup.ts',
      use: { viewport: MASAUSTU_VIEWPORT },
    },
    {
      name: 'masaustu',
      dependencies: ['kurulum'],
      testMatch: ['**/kimlik.spec.ts', '**/masaustu-yerlesim.spec.ts'],
      use: { viewport: MASAUSTU_VIEWPORT, storageState: OTURUM_DOSYASI },
    },
    {
      name: 'mobil',
      dependencies: ['kurulum'],
      testMatch: ['**/kimlik.spec.ts', '**/mobil-yerlesim.spec.ts'],
      use: {
        viewport: MOBIL_VIEWPORT,
        // Mobil tarayici emulasyonu: `<meta name="viewport">` gercek cihazdaki gibi uygulanir.
        isMobile: true,
        hasTouch: true,
        storageState: OTURUM_DOSYASI,
      },
    },
  ],
});
