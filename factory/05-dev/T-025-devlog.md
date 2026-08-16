# Devlog — T-025

> Uretici: dev-agent | Branch: ticket/T-025 | Tarih: 2026-08-16

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| Kod tabaninda `$2[aby]$` ile baslayan bcrypt hash LITERAL'i kalmaz (test fixture'lari haric) | `auth.service.ts`: literal kaldirilir, `DUMMY_PASSWORD_HASH` acilista uretilir | YENI `tools/bcrypt-hash-literal.spec.ts`: `apps/api/src` + `apps/web/src` altindaki tum uretim (`*.spec.ts` disi) `.ts/.tsx` dosyalari taranir, eslesen dosya listesi bos olmali; ayrica "tarama bos degil" yanlis-yesil korumasi |
| Dummy hash modul yuklenirken bir kez uretilir; cost gercek dogrulamayla AYNI (10) | `bcrypt.hashSync(randomBytes(32).toString('hex'), BCRYPT_COST)` — mevcut `BCRYPT_COST` sabiti yeniden kullanilir | YENI `auth.service.spec.ts` › `DUMMY_PASSWORD_HASH uretimi (T-025)`: `jest.isolateModulesAsync` ile iki bagimsiz modul yuklemesi FARKLI hash verir (literal olamaz) + `bcrypt.getRounds(...) === 10` |
| Kullanici bulunamayinca `bcrypt.compare` kosulsuz calisir; T-015 davranisi ve mevcut testler DEGISTIRILMEDEN gecer | `login()` govdesine DOKUNULMADI (`user?.passwordHash ?? DUMMY_PASSWORD_HASH` aynen duruyor) | Mevcut `AuthService.login sabit-zamanli dogrulama (T-015)` bloklarinin 4 testi degistirilmeden yesil (dosyaya yalnizca YENI describe eklendi) |
| Var olmayan e-posta ile yanlis parola arasindaki sure farki T-015 toleransinda kalir | Ayni kod yolu, ayni cost -> bcrypt maliyeti iki dalda esit | T-015 zamanlama davranisini olcen bir test YOKTU (asagida "Varsayimlar"); korunan sey T-015'in davranis testleri: compare her iki dalda 1 kez ve dogru hash'e karsi cagrilir |
| Acilisa eklenen maliyet tek bir bcrypt hash'idir (~50-100 ms) ve gerekcesiyle kod yorumunda belirtilir | `DUMMY_PASSWORD_HASH` ustundeki JSDoc: `hashSync` neden acilista guvenli, istek yolunda neden yok, maliyet ne kadar | Olculdu: bu makinede 54 ms (`bcrypt.hashSync(randomBytes(32).toString('hex'), 10)`); yorumdaki aralikla tutarli |
| `npm run test`, `lint`, `typecheck`, `test:e2e` temiz | — | Kosum ciktisi asagida (ayrica `format:check`) |

## Alinan Kararlar ve Gerekceler
- **Export adi ve tipi degistirilmedi** (`DUMMY_PASSWORD_HASH: string`): kriter "mevcut testler DEGISTIRILMEDEN gecer" diyor; ad/tip degisikligi `auth.service.spec.ts`'i degistirmeyi zorunlu kilardi. Modul seviyesi `const` oldugu icin tuketici kod (`login()`) hic degismedi.
- **Girdi olarak `randomBytes(32).toString('hex')`** (ticket'in onerdigi bicim). Girdi hicbir degiskene alinmaz, hicbir yere yazilmaz — uretimden sonra erisilemez. `DUMMY_PASSWORD_ENTROPY_BYTES` adlandirilmis sabit olarak duruyor (§2: SCREAMING_SNAKE_CASE, sihirli sayi yok).
- **`BCRYPT_COST` yeniden kullanildi**, ikinci bir cost sabiti tanimlanmadi: "cost gercek dogrulamayla ayni" kriteri boylece yapisal olarak garanti edilir (tek deger degisirse ikisi birden degisir).
- **Regresyon testi repo-hijyeni katmanina (`tools/`) kondu**, birim testine degil: kriter "kod tabaninin tamaminda" diyor, tek bir servis dosyasini kontrol etmek bulguyu geri sizabilir birakirdi. Emsal mevcut: `tools/docker-build-context.spec.ts`, `tools/rate-limit-config.spec.ts` ayni sekilde dosya okuyup repo kuralini dogruluyor (yeni desen ICAT EDILMEDI).
- **"Iki yukleme farkli hash verir" testi** literal'in geri gelmesini kesin olarak yakalar: sabit bir literal iki izole yuklemede de ayni degeri dondururdu. `jest.spyOn(bcrypt, ...)` T-015'te calismadigi icin (native modul) mevcut `jest.mock('bcrypt')` sarmalayicisi korundu; yeni test `jest.isolateModulesAsync` kullanir ve yalnizca kendi izole yuklemesini okur, mevcut testlerin mock referanslarini bozmaz.
- **Kirmizi once dogrulandi:** her iki yeni test de literal duruyorken kosuldu ve FAIL etti (tools taramasi `auth.service.ts`'i suclu listeledi; birim testi iki yuklemede ayni literal'i gordu). Yesil ancak kod degisikliginden sonra alindi.

## Varsayimlar
- Kriter 4'un atifta bulundugu "mevcut zamanlama testi" **yoktur**: T-015 sure olcen bir test eklememis, bcrypt cagrisinin her iki dalda da kosulsuz yapildigini davranissal olarak dogrulamisti (T-015 devlog'u da bunu boyle anlatiyor). Dolayisiyla "tolerans" olarak korunan sey bu davranis testleridir; ticket kapsami disinda yeni bir sure-olcum testi (dogasi geregi flaky) EKLENMEDI.
- Dummy hash'in her acilista degismesi ticket'ta acikca kabul edilebilir sayildi; kalicilik gerektiren hicbir tuketici yok (yalnizca `login()` icinde compare girdisi).

## Anayasa (CLAUDE.md) Bosluklari
- yok

## Bilinen Sinirlamalar
- `tools/bcrypt-hash-literal.spec.ts` yalnizca `apps/api/src` ve `apps/web/src` agaclarini tarar (uretim kaynagi olan yerler). Dokumantasyon, compose dosyalari veya scriptler taranmaz; SonarCloud bulgusu da bu agaclardan geliyordu.
- Tarama `*.spec.ts` dosyalarini haric tutar — mevcut test fixture'lari (`'$2b$10$hash'` vb.) kriterde acikca haric birakilmisti.
- Acilis maliyeti olcumu tek makinede yapildi (54 ms); daha yavas CPU'da 100 ms'i asabilir, ancak buyuklugu tek bir bcrypt hash'idir ve istek yolunu etkilemez.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `apps/api/test/factories/user.factory.ts` ve birkac `*.spec.ts` gecersiz-bicimli sahte hash'ler tasiyor (`'$2b$10$hash'`). Kriter geregi kapsam disi; ancak SonarCloud test dosyalarini da taramaya baslarsa ayni bulgu turu geri gelebilir — o durumda tek ticket'ta fixture'lari `bcrypt.hashSync` ile uretmek dusunulebilir.

## Test Kosum Ciktisi (ozet)
```
Birim (workspace koku, npm run test):
  kok (tools):  Test Suites:  8 passed | Tests:  50 passed  (2'si T-025 yeni: literal taramasi)
  apps/api:     Test Suites: 56 passed | Tests: 371 passed  (auth.service.spec 15/15, 3'u T-025 yeni)
  apps/web:     Test Suites: 53 passed | Tests: 390 passed
  Coverage esikleri (global %70 / modules %80) asildi, kirmizi yok.

E2E (gercek Postgres 16, izole konteyner, prisma migrate deploy):
  Test Suites: 13 passed | Tests: 198 passed

Lint:        eslint . --max-warnings=0  -> temiz (0 uyari, bastirma yok)
Typecheck:   tsc --noEmit (kok + api + web) -> temiz
Format:      prettier --check . -> temiz

Kriter 1 dogrulamasi (ticket'taki komut):
  grep -rE '\$2[aby]\$' apps/api/src
  -> yalnizca *.spec.ts fixture satirlari; auth.service.ts artik listede YOK.

Kirmizi-once kaniti (kod degisikliginden ONCE):
  tools/bcrypt-hash-literal.spec.ts  -> FAIL: ["apps/api/src/modules/auth/auth.service.ts"]
  auth.service.spec.ts (T-025)       -> FAIL: iki yukleme ayni literal'i dondu
```
