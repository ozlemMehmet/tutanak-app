# Devlog — T-005

> Uretici: dev-agent | Branch: ticket/T-005 | Tarih: 2026-08-13

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: Giris yapmis kullanici sablon ID + baslik + not ile POST yapinca 201 + olusturulan tutanagin ID'si doner | `modules/reports/reports.controller.ts` `POST /reports` -> `reports.service.ts#createDraft` -> `reports.repository.ts#createDraft` -> `mappers/report.mapper.ts#toReportDto` (sozlesmedeki `Report` semasi) | e2e `test/reports.e2e-spec.ts`: "sablon, baslik ve not ile 201 ve olusturulan tutanagin kimligi doner" + birim `reports.service.spec.ts`, `report.mapper.spec.ts`, `reports.controller.spec.ts` |
| K2: Baslik bos gonderilince 400 + "baslik zorunludur" alan hatasi | `dto/create-report.dto.ts` (`@Transform` trim + `@MinLength(1)`, mesaj: `baslik zorunludur`); global `ValidationPipe` -> `details[]` (CLAUDE.md §4.2.3) | e2e: "baslik bos gonderildiginde 400 ve baslik alan hatasi doner" + "yalnizca bosluktan olusan baslik da 400 doner" + "baslik alani hic gonderilmediginde 400 doner" |
| K3: Gecersiz/var olmayan sablon ID'si 400/404 doner | `reports.repository.ts#createDraft` FK ihlalinde (`P2003`) `null` -> `reports.service.ts` `NotFoundError('TEMPLATE_NOT_FOUND')`; uuid bicimine uymayan deger DTO'da `@IsUUID` ile 400 | e2e: "var olmayan sablon kimliginde 404 TEMPLATE_NOT_FOUND doner" + "uuid bicimine uymayan sablon kimliginde 400 VALIDATION_ERROR doner" + birim `reports.service.spec.ts`, `reports.repository.spec.ts` |
| K4: Tutanak olusturana (owner) bagli kaydedilir ve durumu "taslak" (`draft`) baslar | Owner kimligi YALNIZCA token'dan (`@CurrentUser()`), govdeden okunmaz; `status` gonderilmez -> DDL `DEFAULT 'draft'` | e2e: "olusturulan satir token sahibinin kimligiyle ve draft durumunda kaydedilir" (yanit + veritabani satiri dogrulanir) + "istemci owner/status gondererek sahiplik veya durum belirleyemez" (400) |
| K5: Baska kullaniciya ait tutanagi getirme/duzenleme denemesi 403 doner | `reports.service.ts#assertOwnership` (CLAUDE.md §3.8 Guard Clause) -> `ForbiddenError`; `common/errors/app-error.ts` icine `ForbiddenError` sinifi eklenir (§4.2'de tanimli, henuz yazilmamis) | e2e: "baska kullaniciya ait tutanagi getirme denemesi 403 FORBIDDEN doner" + "sozlesmede duzenleme endpoint'i yoktur" testi + birim `reports.service.spec.ts` |

## Alinan Kararlar ve Gerekceler
- **Katman zinciri T-004 ile ayni**: `Controller -> Service -> Repository -> Prisma` + saf mapper (§3.1-§3.5, §7.1). Ara katman/soyutlama eklenmedi.
- **Sablon dogrulamasi ayri `SELECT` ile yapilmadi**: `create` cagrisi FK ihlaline (`P2003`) birakildi ve depoda `null`'a cevrildi. Gerekce: (1) tek sorgu — istek basina fazladan gidis-donus yok, (2) "once oku sonra yaz" yarisi yapisal olarak imkansiz (desen sozlugundeki "unique kisit + get-or-create" satirinin dayandigi ayni ilke: birincil garanti DB kisitidir).
- **`assertOwnership` bulunan kaydi doner**: `getReport` icin kaydi ikinci kez sorgulamak (N+1'e giden gereksiz gidis-donus) yerine guard clause bulduğu kaydi dondurur; hata siralamasi §3.8 ile birebir (kayit yok -> `NotFoundError`, baskasina ait -> `ForbiddenError`).
- **Gecersiz bicimli `reportId` -> 404** (400 degil): sozlesme `GET /reports/{reportId}` icin 400 tanimlamiyor (401/403/404). Depoda Prisma `P2023` yakalanip `null`'a cevrildi — T-004'te `/templates/{templateId}` icin alinan kararla ayni.
- **`POST /reports` govdesinde gecersiz bicimli `templateId` -> 400**: burada sozlesme `ValidationError` tanimliyor ve alan govde alanidir; `@IsUUID` ile alan bazli hata uretilir.
- **Owner ve status istemciden alinmaz**: `CreateReportRequest` semasi (additionalProperties: false) + `forbidNonWhitelisted` sayesinde `ownerId`/`status` gonderme denemesi 400 uretir; sahiplik token'dan, durum DDL varsayilanindan gelir (§3.7, §3.10).
- **`ForbiddenError` sinifi eklendi** (`common/errors/app-error.ts`): §4.2 hiyerarsisinde tanimliydi ama yazilmamisti (T-004 devlog'unda da not dusulmustu). Kod kumesi `FORBIDDEN` ile sinirli, §4.2.3 geregi `details` tasimaz.
- **`ReportDetail.photos` tipi `never[]`**: bu ticket'ta fotograf satiri olusturan kod yolu olmadigi icin dizi her zaman bostur. Sozlesmedeki `Photo` semasi (ve on-imzali URL uretimi) T-006'nin isidir; simdiden hic calismayan bir `PhotoDto` + mapper yazmak olu kod ve test edilemez kapsam bosluğu yaratirdi. Tip, T-006'da gercek eleman tipiyle degistirilecek sekilde yorumla isaretlendi.
- **Verimlilik**: iki endpoint de tek sorgu kosar; dongu icinde DB cagrisi, sayfalamasiz tam tablo cekisi yok. `photoCount` DB tarafinda `_count` ile hesaplanir (uygulama icinde sayim yok).

## Varsayimlar
- Sablon satirlari T-002 seed'i ile gelir; e2e testi izole veritabaninda `migrate:deploy` + `seed` kosar ve `templateId`'yi `GET /templates` uzerinden alir (sabit uuid kopyalanmaz).
- "taslak" durumu = sozlesme/DDL'deki `draft` degeri (`report_status` enum'u).

## Anayasa (CLAUDE.md) Bosluklari
- Yok. (Sozlesme boslugu icin "Bilinen Sinirlamalar" bolumune bakiniz: kabul kriterindeki "duzenleme" fiiline karsilik gelen bir endpoint `api-contract.yaml`'da tanimli degil; §3.6 geregi endpoint UYDURULMADI.)

## Bilinen Sinirlamalar
- **Sozlesme boslugu (K5 "duzenleme" yarisi):** `api-contract.yaml`'da tutanak guncelleyen (PATCH/PUT) bir endpoint YOKTUR; MVP'de tutanak olusturulduktan sonra metin alanlari degistirilemez. Bu yuzden "baska kullaniciya ait tutanagi duzenleme" denemesi 403 degil, "rota yok" (404) ile sonuclanir ve e2e testi bunu belgeler. Sahiplik kurali tek noktada (`assertOwnership`) durdugu icin ileride bir duzenleme endpoint'i eklendiginde 403 davranisi ayni yerden gelir. Endpoint eklemek §3.6 ve kapsam disciplini geregi bu ticket'ta yapilmadi.
- `ReportDetail.photos` bu ticket'ta her zaman bos dizidir: fotograf satiri olusturan kod yolu (ve on-imzali URL uretimi) T-006 kapsamindadir; bu ticket'ta hicbir `report_photos` satiri olusamaz. `photoCount` yine de DB'den gercek sayimla gelir (T-006 sonrasinda dogru calisir).
- `GET /reports` (listeleme/arama) T-011 kapsamindadir, eklenmedi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `common/errors/app-error.ts` icinde `UnprocessableError` ve `ExternalServiceError` siniflari hala yok (§4.2 hiyerarsisi eksik). Bu ticket yalnizca ihtiyaci olan `ForbiddenError`'i ekledi; kalanlari T-006/T-007/T-012 eklemeli.
- `apps/api/test/jest-e2e.config.mjs` coverage esigi tanimlamiyor (T-004 devlog'unda da notlanmis) — dokunulmadi.

## Test Kosum Ciktisi (ozet)
```
# 1) ONCE KIRMIZI (dort yeni birim spec, uygulama dosyalari henuz yok):
Test Suites: 4 failed, 16 passed, 20 total
Tests:       60 passed, 60 total     (Cannot find module './reports.service' ...)

# 2) Uygulama yazildiktan sonra YESIL — birim (npm test, kok + workspace'ler):
Test Suites: 20 passed, 20 total
Tests:       79 passed, 79 total
modules/reports -> reports.controller.ts / reports.repository.ts / reports.service.ts /
                   mappers/report.mapper.ts: satir kapsami %100 (esik: %80)

# 3) Entegrasyon/e2e (gercek Postgres, izole veritabani + migrate:deploy + seed):
PASS test/reports.e2e-spec.ts   (19 test: K1..K5 + 401/403/404/400 yollari)
Test Suites: 5 passed, 5 total
Tests:       58 passed, 58 total

# 4) Statik analiz kapilari:
npm run lint         -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck    -> temiz (kok + api + web)
npm run format:check -> All matched files use Prettier code style!
npm audit --audit-level=high -> found 0 vulnerabilities
```
