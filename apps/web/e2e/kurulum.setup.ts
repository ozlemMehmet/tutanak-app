/**
 * Kurulum projesi (H-006 kriter 6): oturumu GERCEK akisla kurar — `POST /auth/register`
 * ve `POST /auth/login` ekran uzerinden cagrilir, ardindan olcum ekranlarindan biri olan
 * tutanak detayi icin bir taslak olusturulur. Cikti (`storageState` + tutanak yolu) iki
 * viewport projesi tarafindan paylasilir; boylece hiz siniri kosumlar arasi kararliligi
 * bozmaz (bkz. support/durum.ts).
 */
import { expect, test as kurulum } from '@playwright/test';
import { TUTANAK_BASLIGI, benzersizEposta, girisYap, kayitOl, taslakOlustur } from './support/akis';
import { OTURUM_DOSYASI, tutanakBilgisiYaz } from './support/durum';

kurulum('gercek kayit ve giris akisi oturumu kurar', async ({ page, context }) => {
  const eposta = benzersizEposta();

  await kayitOl(page, eposta);
  await girisYap(page, eposta);

  const tutanakYolu = await taslakOlustur(page);
  expect(tutanakYolu).toMatch(/^\/reports\/[0-9a-fA-F-]{36}$/);

  await context.storageState({ path: OTURUM_DOSYASI });
  tutanakBilgisiYaz({ yol: tutanakYolu, baslik: TUTANAK_BASLIGI });
});
