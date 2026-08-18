/**
 * Gercek kullanici akisi (H-006 kriter 6): kayit, giris ve taslak olusturma YALNIZCA ekran
 * uzerinden yapilir; sabit kullanici yoktur ve localStorage elle kurcalanmaz. Her adim
 * ilgili HTTP yanitini `waitForResponse` ile bekler — sabit `sleep` yasaktir (kriter 7).
 */
import { randomUUID } from 'node:crypto';
import { expect, type Page, type Response } from '@playwright/test';

/** Sunucu dogrulamasini gecen (>= 8 karakter) test sifresi; sir degildir, uretimde kullanilmaz. */
const SIFRE = 'Guclu-Sifre-2026';

/**
 * Fixture metinleri Turkce'nin ZOR harflerini (s g i) tasir: ASCII'ye katlanmis test verisi
 * dilin kirildigi yeri gorunmez yapar (bilgi tabani dersi:
 * testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi.md).
 */
export const TUTANAK_BASLIGI = 'Şişli Çağlayan 3+1 çıkış teslimi';
export const TUTANAK_NOTU = 'Mutfak dolabı çizik, ışık düğmesi bozuk, boyası eskimiş.';

export function benzersizEposta(): string {
  return `h006-${randomUUID()}@ornek.test`;
}

/** Verilen API ucuna yapilan POST yanitini bekler (yol on eki `/api/v1`). */
function apiYanitiniBekle(page: Page, yol: string): Promise<Response> {
  return page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1${yol}`) && response.request().method() === 'POST',
  );
}

/** `POST /auth/register` — kayit formu uzerinden. */
export async function kayitOl(page: Page, eposta: string): Promise<void> {
  await page.goto('/register');
  await page.locator('#register-email').fill(eposta);
  await page.locator('#register-password').fill(SIFRE);
  await page.locator('#register-password-confirm').fill(SIFRE);

  const yanit = apiYanitiniBekle(page, '/auth/register');
  await page.getByRole('button', { name: 'Hesap Oluştur' }).click();
  expect((await yanit).status()).toBe(201);

  // Kayit token DONDURMEZ: uygulama giris ekranina tasir (T-018).
  await page.waitForURL(/\/login/);
}

/** `POST /auth/login` — giris formu uzerinden; basarida tutanak listesine gecilir. */
export async function girisYap(page: Page, eposta: string): Promise<void> {
  await page.goto('/login');
  await page.locator('#login-email').fill(eposta);
  await page.locator('#login-password').fill(SIFRE);

  const yanit = apiYanitiniBekle(page, '/auth/login');
  await page.getByRole('button', { name: 'Giriş Yap' }).click();
  expect((await yanit).status()).toBe(200);

  await page.waitForURL(/\/reports$/);
}

/** Sablon secimi + baslik/not ile taslak olusturur; detay ekraninin yolunu dondurur. */
export async function taslakOlustur(page: Page): Promise<string> {
  await page.goto('/reports/new');
  // Locator auto-wait: sablon listesi gelene kadar beklenir, sabit bekleme yoktur.
  await page.getByRole('radio').first().check();
  await page.locator('#report-title').fill(TUTANAK_BASLIGI);
  await page.locator('#report-note').fill(TUTANAK_NOTU);

  const yanit = apiYanitiniBekle(page, '/reports');
  await page.getByRole('button', { name: 'Taslak Oluştur' }).click();
  expect((await yanit).status()).toBe(201);

  await page.waitForURL(/\/reports\/[0-9a-fA-F-]{36}$/);
  return new URL(page.url()).pathname;
}
