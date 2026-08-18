# Devlog — H-006

> Uretici: dev-agent | Branch: ticket/H-006 | Tarih: 2026-08-18

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayan kod | Karsilayan test |
|---|---|---|
| 1. `@playwright/test` dev bagimliligi + `apps/web` altinda suite + `test:browser` script'i | kok `package.json` (devDependency + `test:browser`), `apps/web/package.json` (`test:browser`), `apps/web/playwright.config.ts`, `apps/web/e2e/**` | `tools/browser-suite.spec.ts` — bagimlilik, iki script, config/suite varligi, jest-playwright dosya ayrimi |
| 2. Iki viewport (`1280x900`, `390x844`) | `apps/web/e2e/support/viewport.ts` (tek dogruluk kaynagi) + config'te `masaustu`/`mobil` projeleri | `tools/browser-suite.spec.ts` (degerler + proje adlari); her olcum testi `page.viewportSize()`'i dogrular |
| 3. Masaustunde kapsayici viewport'tan dar + ortali (fark ≤ 2px); detay butonlari viewport genisligini almaz | Yeni urun kodu YOK — H-004 yerlesimini kilitler | `apps/web/e2e/masaustu-yerlesim.spec.ts` (3 ekran + `Fotoğraf Ekle` / `PDF İndir`, `getBoundingClientRect()` ile) |
| 4. Mobilde yatay tasma yok (`scrollWidth <= 390`) | Yeni urun kodu YOK | `apps/web/e2e/mobil-yerlesim.spec.ts` (3 ekran) |
| 5. `document.title` + manifest `name` Turkce karakterleri tasir (H-005 regresyon kilidi) | Yeni urun kodu YOK | `apps/web/e2e/kimlik.spec.ts` (iki projede de kosar; `ğ`/`ı` + mojibake kontrolu) |
| 6. Uc ekran gezilir; giris gercek `POST /auth/register` + `/auth/login` ile kurulur | `apps/web/e2e/kurulum.setup.ts` + `support/akis.ts` (UI uzerinden kayit/giris/taslak) | Kurulum projesi: iki ucun yaniti `waitForResponse` ile 201/200 olarak dogrulanir; `support/ekranlar.ts` uc ekrani iki spec'e besler |
| 7. Kararlilik; sabit bekleme yasak | `playwright.config.ts` (`retries: 0`, `workers: 1`), locator auto-wait + `waitForURL`/`waitForResponse` | `tools/browser-suite.spec.ts` (yorumlari atarak `waitForTimeout(`/`setTimeout(`/`sleep(` cagrisi arar, `retries: 0`); suite art arda **3 kez** kosuldu, ayni sonuc |
| 8. Kosum belgesi (calisan yigin gereksinimi dahil) | `README.md` → "Tarayici seviyesinde yerlesim testleri (Playwright)" | `tools/browser-suite.spec.ts` (komut, yigin gereksinimi, `npx playwright install`) |

## Alinan Kararlar ve Gerekceleri
- **Suite `apps/web/e2e/` altinda** (CLAUDE.md §1 agacinda bu klasor zaten "Playwright senaryolari" olarak tanimli); bagimlilik ve tek-komut script'i kokte (§6.1 `@playwright/test`'i ortak "Test/arac" satirinda listeliyor).
- **Yigini suite baslatmaz** (`webServer` tanimlanmadi): calisan yigin API + DB + MinIO zinciri ister, bu compose'un isidir. Adres `E2E_BASE_URL` ile degistirilebilir; varsayilan `http://localhost:5173`. Zorunlu yeni env anahtari YOK — mevcut e2e suitlerinin env sozlesmesi degismedi.
- **Oturum bir kez kurulur** (`kurulum` projesi → `storageState`), iki viewport projesi paylasir. Gerekce: `AUTH_RATE_LIMIT_MAX_REQUESTS=5` (60 sn pencere, IP+ucu basina); her testte kayit/giris yapmak art arda kosumda 429 uretir ve kriter 7'yi (kararlilik) dogrudan cignerdi. Durum dosyasi elle uydurulmus token DEGILDIR: icerigi gercek UI akisindan dogar — kriter 6'nin yasakladigi sey sabit kullanici/elle localStorage kurcalamasidir.
- **Ekranlar AD ile parametrelendi**, nesne ile degil: detay ekraninin adresi kurulum projesinin urettigi dosyadan gelir ve o dosya Playwright test TOPLAMA aninda henuz yoktur; cozumleme test govdesinde yapilir.
- **Yalnizca chromium**: hedeflenen kusur sinifi (yerlesim/viewport) motor farki degil; ikinci-ucuncu tarayici kosum suresini ve bakim yukunu artirirdi. Gorsel anlik goruntu karsilastirmasi ticket geregi yapilmadi.
- **Olcum referansi `document.documentElement.clientWidth`** (`window.innerWidth` degil): dikey kaydirma cubugu innerWidth'e dahildir ve ortalanma farkini sahte sekilde buyuturdu.
- **Fixture metinleri Turkce'nin zor harflerini tasir** (`Şişli Çağlayan 3+1 çıkış teslimi`) — bilgi tabani dersi `testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi.md`.
- **Kirmizi dogrulandi (red-green):** olcumlerin B-004 sinifini gercekten yakaladigi, gecici bir probe ile kanitlandi — `main.page { max-width: none; margin-inline: 0 }` enjekte edilince masaustu olcumu `1280 < 1280` ile KIRILDI; genis oge enjekte edilince mobil olcumu `800 <= 390` ile KIRILDI. Probe dosyalari commit edilmedi. `tools/browser-suite.spec.ts` de once kirmizi (12/15 fail) kosuldu, sonra yesile alindi.

## Varsayimlar
- Kabul kriteri 3'teki "ana icerik kapsayicisi" = her ekranin kok `main.page` ogesi (H-004'un kapsayici kurali orada yasiyor; deger ticket'tan degil koddan alindi).
- "Birincil butonlar" olcumu `Fotoğraf Ekle` (bir `label` tetikleyici) ve `PDF İndir` (fotografsiz taslakta `disabled` ama DOM'da ve olculebilir) ogeleridir.

## Anayasa (CLAUDE.md) Bosluklari / Celiskileri
- **§6.1 pin "1.4x" ile §9 audit kapisi ayni anda saglanamiyor.** `@playwright/test@~1.49.1` kuruldugunda `npm audit --audit-level=high` KIRMIZI oluyor: GHSA-7mvr-c777-76hp (playwright tarayiciyi SSL sertifikasini dogrulamadan indiriyor, HIGH), duzeltme 1.62.1 ve semver-major degil. `~1.62.1` secildi; audit temiz (yalnizca onceden var olan 4 moderate kaldi). Gerekce anayasanin kendi emsalidir: §6.1'deki bcrypt 5.x → ^6.0.0 karari, "kendi getirdigi bagimliligin surumunu secmek ticket'in kapsamidir" ve "§9 esigine istisna kapiyi ilk gercek testinde alcaltir" diyor. §6.1'in "1.4x" satiri bu advisory'den ONCEDIR ve guncellenmesi architect isidir (dokunulmadi).
- **§8.3'teki 4 Playwright senaryosu (kritik akis) hala yoktur.** H-006 kapsami yerlesim sinifidir; bu suite onlarin yerine gecmez. Kapsam disi oldugu icin yazilmadi, boslugu burada raporluyorum.
- §10'daki komut listesi `test:browser`'i icermiyor (yeni script); README guncellendi, anayasa metnine dokunulmadi.

## Bilinen Sinirlamalar
- Suite calisan yigin olmadan kosmaz; yigin kapaliyken tum testler baglanti hatasiyla duser (bilincli: sessiz atlama yerine gurultulu hata).
- Kapsayici olcumu `main.page` seciciye baglidir; bir ekran kok kapsayicisini degistirirse locator guncellenmelidir (kirilma sessiz degil, kirmizi olur).
- Tek tarayici (chromium) + tek makine; farkli isletim sistemlerinde birkac px'lik kaydirma cubugu farki olabilir, bu yuzden esitlik degil tolerans (≤ 2px) ve `<` karsilastirmasi kullanildi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `.photo-capture__trigger` ve detaydaki `PDF İndir` masaustunde kapsayici genisligine (≈768px) gerilir; H-004 yalnizca uc butonu (`.subscription__pay`, `.auth-form__submit`, `.report-create__submit`) daralttigi icin detay ekranindaki bu iki eylem hala tam kapsayici genisligindedir. Kriter 3'u (viewport genisligini almaz) KARSILIYOR, ama tasarim tutarliligi acisindan backlog notu olabilir.

## CI'a Baglama Raporu (kapsam disi — devops/orkestrator icin)
`.github/` dev-agent'a kapali oldugu icin yalnizca raporlaniyor. Onerilen kurulum: mevcut
`ci.yml` icinde **ayri bir job** (`browser-e2e`), unit job'una `needs` ile bagli degil ki
hizli kapilar gecikmesin.

- **Ayaga kalkacak servisler:** `docker compose -f docker-compose.e2e.yml up --build -d`
  (db + minio + minio-init + api + web). Bu dosya uretim imajlarini kullanir ve dis hesap
  istemez; `cp .env.example .env` adimi onceden gerekir.
- **Hazir olma kosulu:** `curl -f --retry 30 --retry-all-errors --retry-delay 2 http://localhost:${HTTP_PORT:-8080}/health`
  (sabit `sleep` degil). API'nin kendi HEALTHCHECK'i de `docker compose ps` ile izlenebilir.
- **Tarayici:** `npx playwright install --with-deps chromium` (ubuntu runner'da `--with-deps` sart).
- **Komut:** `E2E_BASE_URL=http://localhost:${HTTP_PORT:-8080} npm run test:browser`
  (varsayilan `5173` yalnizca dev compose icindir; e2e yigininda web Caddy uzerinden 8080'dedir).
- **Sure/timeout:** imaj derlemesi ~5-8 dk, suite kendisi < 1 dk → `timeout-minutes: 20` yeterli.
- **Basarisizlik ciktisi:** `apps/web/test-results/` (trace `retain-on-failure`) artifact olarak
  yuklenmeli; ardindan `docker compose -f docker-compose.e2e.yml logs --no-color` ve
  `down -v` (her kosumda temiz volume).
- **Not:** kimlik uclarinin hiz siniri (5 istek/60 sn) suite'in tasarimi geregi kosum basina
  1 kayit + 1 giris tuketir; ayni runner'da art arda kosumlar bu yuzden guvenlidir.

## Test Kosum Ciktisi (ozet)
```
$ npx playwright test           (apps/web, calisan yigin: docker compose)
Running 13 tests using 1 worker
  ✓ [kurulum]  gercek kayit ve giris akisi oturumu kurar
  ✓ [masaustu] document.title / manifest.webmanifest Turkce karakter (2)
  ✓ [masaustu] 3 ekranda ana kapsayici viewport'tan dar + ortali (3)
  ✓ [masaustu] "Fotoğraf Ekle" ve "PDF İndir" viewport genisligini almaz (2)
  ✓ [mobil]    document.title / manifest.webmanifest Turkce karakter (2)
  ✓ [mobil]    3 ekranda yatay tasma yok (3)
  13 passed (3.8s)     # art arda 3 kosum: 13 passed / 13 passed / 13 passed

$ npm run test        -> kok 12 suite / 90 test, api 56 suite / 386 test, web 57 suite / 448 test — hepsi PASS
$ npm run lint        -> 0 uyari
$ npm run typecheck   -> temiz (kok + api + web)
$ npm run format:check-> temiz
$ npm audit --audit-level=high -> yalnizca 4 moderate (temel durumla ayni), HIGH yok
```
