# Devlog — T-009

> Uretici: dev-agent | Branch: ticket/T-009 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: Gecerli paylasim linkine kimliksiz GET -> 200 + baslik, sablon adi, not, fotograflar, her fotografin damgasi | `sharing/public-report.controller.ts` (`@Public()` GET `/public/reports/:shareToken`), `sharing/public-report.service.ts`, `SharingRepository.findReportViewByToken()`, `mappers/public-report.mapper.ts`, `dto/public-report.dto.ts` | e2e `public-report.e2e-spec.ts`: "kimlik dogrulamasi OLMADAN 200 + baslik, sablon adi, not ve tarih damgasi doner" (+ sablon adi, fotograf damgasi/URL, siralama, fotografsiz, token izolasyonu); birim: `public-report.mapper.spec.ts`, `public-report.service.spec.ts`, `sharing.repository.spec.ts`; web: `PublicReportPage.spec.tsx` |
| K2: Gecersiz/var olmayan token -> 404 | `PublicReportService.viewByShareToken()` guard clause -> `NotFoundError('SHARE_LINK_NOT_FOUND')` | e2e: var olmayan token, bicimsiz kisa token, ozel karakterli token -> 404 + zarf; hata yaniti icerik sizdirmaz; birim: servis spec (404 + fotograf yoluna girilmez + mesaj token sizdirmaz); web: 404 -> tam sayfa hata |
| K3: Yanit yazma islemi/endpoint sunmaz (salt-okunur) | Modulde yalnizca `@Get()` handler; yanit govdesi mapper'da beyaz liste ile kurulur | e2e: POST/PUT/PATCH/DELETE -> 404 (route yok), yanit anahtar kumesi = sozlesme, `ownerId`/`reportId`/`storageKey`/token sizmaz, iki GET sonrasi DB degismez; birim: controller spec (yalnizca GET metadata'si), mapper spec; web: sayfada buton/form/girdi yok |
| K4: Goruntuleme oturum/kayit adimi gerektirmeden bastan sona tamamlanir | `@Public()` (global JwtAuthGuard atlanir); web `/t/:token` rotasi + `PublicReportPage` + `usePublicReport` | e2e: kimliksiz istek 200, oturum cerezi yok, kullanici sayisi artmaz, gecersiz Authorization ile bile 200; web: istek `Authorization` basligi tasimaz, `/t/:token` rotasi sayfayi acar |

## Alinan Kararlar ve Gerekceler
- **Ayri `PublicReportController` + `PublicReportService`** (sharing modulu icinde). CLAUDE.md §1 sharing altinda "public controller" diyor; oturumsuz okuma ile link uretme farkli yetkilendirme modeline sahip oldugu icin ayri servis tutuldu. Boylece "salt-okunur sinif" iddiasi yapisal olarak test edilebiliyor (sinifta GET disinda handler yok).
- **Yetkilendirme = gecerli token.** Bu akista `assertOwnership` (§3.8) uygulanmadi: kiracinin hesabi yok. Guard clause olarak "token cozulemiyorsa kayit yoktur -> 404" kullanildi; `PublicReportRecord` bilerek `ownerId` tasimiyor (sizinti yuzeyini kokten kaldirir).
- **Gecersiz token = 404, 400 degil.** Sozlesme bu endpoint icin yalnizca 200/404/429 tanimliyor; bu yuzden token yol parametresi DTO dogrulamasindan gecirilmedi (kisa/bicimsiz token da 404). Ayrica "token gecersiz" ile "tutanak yok" istemciye ayni gorunur (numaralandirma saldirisina bilgi vermez).
- **Fotograflar `PhotosService.listOwnedPhotos` ile okundu** (SharingModule -> PhotosModule), `ReportsModule -> PhotosModule` ile ayni yon; on-imzali URL uretimi ve `(sort_order, captured_at)` sirasi (§3.14) tek noktada kaliyor. Kopya sorgu/imzalama yazilmadi.
- **`disclaimer` alani sabit metin olarak donuluyor.** Sozlesmede `PublicReportView.disclaimer` ZORUNLU alan; metin ortama/kullaniciya gore degismedigi icin yapilandirma (§5.1) degil, mapper'da sabit. Metnin onay akisindaki kullanimi (H-11/T-010) bu ticket'ta ele alinmadi; sayfa metni yalnizca gosteriyor.
- **`approval`/`isApproved` alanlari okunuyor** (yazma yok). Sozlesme sematik olarak bu alanlari tanimliyor ve `isApproved` zorunlu; onay yokken `approval` govdeye HIC konulmuyor (§3.5). Onay OLUSTURMA T-010'da.
- **Web: `PhotoGrid` prop tipi yapisal asgari sekle (`id`, `capturedAt`, `url`) daraltildi.** design.md PublicReportPage bilesenleri arasinda `PhotoGrid (readonly)` diyor; ikinci bir izgara kopyalamak yerine tip genisletildi — mevcut davranis (bos durum metni dahil) degismedi. Fotografsiz durumun metni sayfada karsilaniyor (sartnamedeki "Bu tutanakta henuz fotograf bulunmuyor").
- **Yeniden deneme politikasi saf fonksiyona ayrildi** (`shouldRetryPublicReport`): 404/429 tekrar denenmez (kiraci hatayi hemen gorur), 5xx/ag hatasi sinirli tekrar. Saf fonksiyon oldugu icin deterministik test edildi, bilesen testi zamanlamaya bagli kalmadi.
- **Verimlilik:** istek basina iki sorgu (tutanak+sablon+onay tek `findUnique`; fotograflar tek `findMany`). Dongu icinde DB/HTTP cagrisi yok; on-imzali URL uretimi yerel imzalama ve eleman sayisi `PHOTO_MAX_PER_REPORT` ile sinirli. Sayfalama gerekmiyor (tek tutanak).

## Varsayimlar
- Paylasim linki suresiz gecerlidir: DDL'de `share_links` icin son kullanma alani yok, PRD'de de sure siniri tanimli degil. Web'deki hata metni yine de "gecersiz veya suresi dolmus" diyor (design.md sartnamesindeki metin birebir).
- Kiracinin tarayicisinda oturum token'i bulunmaz; bulunsa bile `@Public()` route JWT dogrulamasi yapmadigi icin sonuc degismez (e2e ile dogrulandi).

## Anayasa (CLAUDE.md) Bosluklari
- **Yok** (yeni desen/env anahtari/hata kodu icat edilmedi). Not: §1'deki agacta sharing altinda "public controller" yazili; servis dosyasinin adi (`public-report.service.ts`) §2 isimlendirme kuralina gore turetildi.

## Bilinen Sinirlamalar
- Onay akisi (uyari metninin onay oncesi zorunlulugu, `ApprovalForm`, `SuccessBanner`) T-010 kapsaminda; bu ekranda yalnizca uyari metni gosteriliyor, onay etkilesimi yok.
- `isApproved: true` durumu su an yalnizca dogrudan DB'ye yazilan onay kaydiyla olusabiliyor (onay endpoint'i T-010'da); e2e bu durumu `test/factories/approval.factory.ts` ile kuruyor.
- Uretimde `/t/<token>` gibi SPA derin baglantilarinin calismasi ters vekil sunucunun index.html fallback ayarina baglidir; yerelde Vite dev sunucusu bunu kendisi yapar.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- Repoda SPA history fallback yapilandirmasi (Caddy/nginx) henuz yok; dagitim ticket'inin konusu — dokunulmadi, yalnizca not.
- `ReportDetailPage` hala sabit `canAddPhoto` degeri kullaniyor (T-006 yorumunda notlu); tutanak detay cagrisi eklenince duzelecek — dokunulmadi.

## Test Kosum Ciktisi (ozet)
```
# Birim (kok + api + web):  npm run test
Test Suites: 5 passed, 5 total     Tests: 25 passed   (kok/tools)
Test Suites: 51 passed, 51 total   Tests: 330 passed  (apps/api)
Test Suites: 16 passed, 16 total   Tests: 84 passed   (apps/web)

# E2E (CI paritesi: yalnizca DATABASE_URL tanimli):  npm run test:e2e
Test Suites: 12 passed, 12 total
Tests:       178 passed, 178 total
  -> test/public-report.e2e-spec.ts: 18 passed (T-009)

# Kalite kapilari
npm run lint         -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck    -> temiz (api + web)
npm run format:check -> All matched files use Prettier code style!
npm run build        -> api + web basarili
```
