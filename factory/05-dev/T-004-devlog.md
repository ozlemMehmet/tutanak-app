# Devlog — T-004

> Uretici: dev-agent | Branch: ticket/T-004 | Tarih: 2026-08-13

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: Giris yapmis kullanicinin sablon listesi istegi 200 + TAM OLARAK 3 sablon (ad + aciklama) doner | `modules/templates/templates.controller.ts` `GET /templates` -> `templates.service.ts#listTemplates` -> `templates.repository.ts#findAll` (`sortOrder` sirali) -> `mappers/template.mapper.ts#toTemplateDto` | e2e `test/templates.e2e-spec.ts`: "giris yapmis kullanici tam olarak uc sablonu ad ve aciklamasiyla alir" (seed edilmis gercek DB, adlar birebir) + birim `templates.service.spec.ts`, `template.mapper.spec.ts` |
| K2: Kimliksiz (token'siz) istek 401 doner | Kod eklenmez: global `JwtAuthGuard` (app.module `APP_GUARD`) varsayilan olarak kapalidir; `@Public()` **konulmaz** | e2e: "tokensiz sablon listesi istegi 401 UNAUTHENTICATED doner" + "tokensiz sablon detayi istegi 401 doner" |
| K3: Var olmayan sablon ID'si ile secim istegi 404 doner | `templates.service.ts#getTemplate` -> kayit yoksa `NotFoundError('TEMPLATE_NOT_FOUND')`; `common/errors/app-error.ts` icine `NotFoundError` sinifi eklenir (hiyerarside tanimli ama henuz yazilmamis) | e2e: "var olmayan sablon kimligi 404 TEMPLATE_NOT_FOUND doner" + "uuid bicimine uymayan kimlik de 404 doner" + birim `templates.service.spec.ts` |
| K4: Gecerli sablon ID'si secildiginde secim dogrulanabilir sekilde doner (ID + ad) | `GET /templates/{templateId}` ayni servis/mapper zinciri; yanit sozlesmedeki `Template` semasi (id, code, name, description) | e2e: "gecerli sablon kimligi 200 ile ayni id ve adi doner" (listeden alinan id ile) + birim `templates.controller.spec.ts` |

## Alinan Kararlar ve Gerekceler
- **Katmanlar aynen users modulunun desenini izler** (CLAUDE.md §3.1-§3.5, §7): `Controller -> Service -> Repository -> Prisma` + saf `mapper`. Sablonlar salt okunur oldugu icin depoda yalnizca `findAll`/`findById` var; ekstra soyutlama (facade/use-case) eklenmedi (§7.1).
- **`NotFoundError` sinifi eklendi** (`common/errors/app-error.ts`): hiyerarsi §4.2'de tanimliydi ama sinif henuz yazilmamisti (T-001..T-003 404 uretmiyordu). Kod kumesi `NOT_FOUND | TEMPLATE_NOT_FOUND | SHARE_LINK_NOT_FOUND` ile sinirli tutuldu; sozlesme disi kod uretilemez. §4.2.3 geregi `details` tasimaz.
- **Uuid bicimine uymayan `templateId` -> 404** (400 degil): sozlesmede `/templates/{templateId}` icin tanimli olumsuz yanitlar yalnizca 401 ve 404'tur, 400 tanimli DEGILDIR. Bu yuzden `ParseUUIDPipe` (400 uretirdi) kullanilmadi; Prisma'nin `P2023` (uuid sutununa uygun olmayan deger) hatasi depoda yakalanip `null`'a cevriliyor — "gecersiz kimlik" ile "var olmayan kimlik" istemci acisindan ayni sonuca varir. Hem birim (sahte P2023) hem e2e (`sablon-42` yolu) testiyle dogrulandi.
- **Siralama sunucuda**: `findMany({ orderBy: { sortOrder: 'asc' } })` — `templates_sort_order_idx` mevcut, liste her istekte PRD sirasiyla doner (deterministik yanit, e2e ad karsilastirmasi sira duyarli).
- **`TemplateDto.code` tipi `string`**: sozlesmede enum, ama DB sutunu `text` ve deger kumesini seed belirliyor. Birlesim tipine daraltmak `as` cast'i gerektirirdi (runtime garantisi olmayan sahte tip guvenligi); bunun yerine alanin kaynagi yorumla belgelendi.
- **Verimlilik**: iki endpoint de tek sorgu kosar (N+1 yok, dongu icinde DB cagrisi yok). Sabit 3 satirlik referans tablosunda sayfalama ve onbellek bilincli olarak eklenmedi — MVP'de satir sayisi kullanici tarafindan buyutulemez (PRD kapsam disi madde 4).
- **Commit mesaji** CLAUDE.md §2'deki Conventional Commits + ticket kimligi bicimindedir (`feat(templates): T-004 ...`).

## Varsayimlar
- Sablon verisi T-002 seed'i ile gelir; e2e testi bu yuzden izole veritabaninda `migrate:deploy` + `seed` npm script'lerini kosar ve ad/aciklama metinlerini seed satirlariyla karsilastirir (metin kopyalamak yerine veritabanindan dogrular; adlar PRD kriteri oldugu icin ayrica birebir sabit listeyle de kontrol edilir).
- "Secim dogrulanabilir sekilde donulur" kriteri, sozlesmedeki `GET /templates/{templateId}` -> `Template` yaniti ile karsilanir; secimi sunucuda saklayan bir durum (session/secim tablosu) YOK — tutanak olusturma T-005 kapsaminda `templateId` ile gelir.

## Anayasa (CLAUDE.md) Bosluklari
- Yok. (Sozlesme bosluguna yakin tek nokta gecersiz bicimli yol parametresinin yanit kodudur; sozlesme 400 tanimlamadigi icin 404 secildi ve yukarida gerekcelendirildi — yeni hata kodu/endpoint uydurulmadi.)

## Bilinen Sinirlamalar
- Sablon icerigi (alan sablonlari) MVP'de yok; endpoint yalnizca ad/aciklama/kod doner (PRD kapsam disi madde 4-5).
- Web tarafi sablon secim ekrani bu ticket'in kapsaminda degil (ticket teknik notu: yalnizca listeleme/secim dogrulama endpoint'i).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `common/errors/app-error.ts` icinde `ForbiddenError`, `UnprocessableError`, `ExternalServiceError` siniflari hala yok (§4.2 hiyerarsisi eksik). Bu ticket yalnizca ihtiyaci olan `NotFoundError`'i ekledi; kalanlar ilgili ticketlarda (T-005+/T-006+/T-012) eklenmeli.
- `apps/api/test/jest-e2e.config.mjs` coverage esigi tanimlamiyor (yalnizca birim kosumunda esik var) — mevcut CI kapisi acisindan sorun degil, not olarak birakildi.

## Test Kosum Ciktisi (ozet)
```
# once KIRMIZI (uygulama yazilmadan, 4 yeni birim spec):
Test Suites: 4 failed, 4 total   (Cannot find module './templates.service' ...)

# sonra YESIL:
npm run lint          -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck     -> kok + api + web, cikis 0
npm run format:check  -> All matched files use Prettier code style!
npm test              -> kok 22/22, api 60/60 (16 suite), web 10/10
                         modules/templates satir kapsami %100 (esik %80)
npm run test:e2e      -> 4 suite / 39 test (yeni templates.e2e-spec.ts: 9/9)
npm audit --audit-level=high -> found 0 vulnerabilities (cikis 0)
```
