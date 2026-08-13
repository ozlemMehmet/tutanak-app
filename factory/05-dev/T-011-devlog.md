# Devlog — T-011

> Uretici: dev-agent | Branch: ticket/T-011 | Tarih: 2026-08-13

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: Giris yapmis kullanicinin liste istegi 200 doner ve YALNIZCA kendi tutanaklarini icerir | `reports.controller.ts` `GET /reports` -> `reports.service.ts#listReports` (owner kimligi YALNIZCA `@CurrentUser()`'dan) -> `reports.repository.ts#findManyByOwner` (`where.ownerId`) -> `mappers/report.mapper.ts#toReportListDto` | e2e `test/reports-list.e2e-spec.ts`: "kendi tutanaklarini 200 ile doner" + "baska kullanicinin tutanaklari listede yer almaz" (iki yon: her iki kullanici da kendi listesini gorur); birim `reports.service.spec.ts` (ownerId depoya gecirilir), `reports.repository.spec.ts` (`where.ownerId`), `reports.controller.spec.ts` |
| K2: `q` arama parametresi verilince yanit yalnizca terimi iceren tutanaklarla filtrelenir | `dto/list-reports-query.dto.ts` (`q`, sozlesme: minLength 1 / maxLength 100) -> `reports.repository.ts#findManyByOwner` `OR: [title contains, note contains]` + `mode: 'insensitive'` (ILIKE, `pg_trgm` GIN index — architecture.md §4 "Arama") | e2e: "baslikta gecen terimle arama yalnizca eslesenleri doner", "notta gecen terimle arama yalnizca eslesenleri doner", "arama buyuk/kucuk harften bagimsizdir", "arama baska kullanicinin eslesen kaydini getirmez", "joker karakter (%) harfi harfine aranir"; birim `reports.repository.spec.ts` (where OR yapisi + LIKE joker kacisi) |
| K3: Eslesme yoksa 200 + bos liste (hata donmez) | Ayni sorgu yolu; bos sonuc hata degildir (servis `NotFoundError` firlatmaz) | e2e: "eslesme olmayan terimde 200 ve bos liste doner (`total` = 0)"; birim `reports.service.spec.ts` ("depo bos donerse bos liste doner, hata firlatmaz") |
| K4: Sonuclar varsayilan olarak `created_at` azalan (en yeni once) siralanir | `reports.repository.ts` `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` (`reports_owner_created_at_idx`) | e2e: "liste en yeniden eskiye siralanir" (3 kayit, sira birebir) + "arama sonuclari da en yeniden eskiye siralanir"; birim `reports.repository.spec.ts` (orderBy birebir) |
| K5: Kimliksiz (token'siz) istek 401 doner | Global `JwtAuthGuard`; bu rotaya `@Public()` KONULMAZ | e2e: "tokensiz istekte 401 UNAUTHENTICATED doner" |
| Sozlesme (api-contract.yaml `ReportListResponse`): `items/page/pageSize/total` + sayfalama | `dto/report.dto.ts#ReportListDto`, `dto/list-reports-query.dto.ts` (`page` >= 1, `pageSize` 1..50), `reports.service.ts` (`skip`/`take` hesabi) | e2e: "sayfalama ile ikinci sayfa dogru kayitlari ve toplam sayiyi doner", "gecersiz page/pageSize 400 VALIDATION_ERROR doner", "pageSize ust sinirini asan istek 400 doner"; birim `report.mapper.spec.ts`, `reports.service.spec.ts` (varsayilan page=1/pageSize=20, skip hesabi) |

## Alinan Kararlar ve Gerekceler
- **Katman zinciri T-005 ile ayni** (`Controller -> Service -> Repository -> Prisma` + saf mapper, CLAUDE.md §3.1-§3.5). Yeni desen/soyutlama eklenmedi (§7.1); listeleme mevcut `ReportsRepository` icine yeni bir metod olarak girdi.
- **Arama = Prisma `contains` + `mode: 'insensitive'` (ILIKE)**, ham SQL degil: architecture.md §4 "Arama" basamak 0/1 karari (`ILIKE` + `pg_trgm` GIN index) Prisma'nin dogal ifadesiyle karsilaniyor; §3.4 ham SQL'i yalnizca "ORM'in dogal olarak ifade edemedigi" yerler icin serbest birakiyor — burada oyle bir zorunluluk yok. Index (`reports_title_trgm_idx`, `reports_note_trgm_idx`) T-002'de zaten var, migration'a dokunulmadi.
- **LIKE joker karakterleri kacirilir**: Prisma `contains` degeri `%<terim>%` olarak parametreye koyar ama terimin icindeki `%`, `_`, `\` karakterlerini kacirmaz; kullanici "50%" ararsa terim joker gibi davranip yanlis kayitlari getirirdi. Depo katmaninda (LIKE sozdizimi veri katmani konusudur) `\` ile kacis uygulanir (Postgres'te LIKE varsayilan kacis karakteri `\`). SQL enjeksiyonu riski zaten yok (deger parametrelidir); duzeltilen sey arama dogrulugudur.
- **Bos `q` filtre uygulamaz, 400 uretmez**: sozlesmedeki `q` aciklamasi "bos birakilirsa filtre uygulanmaz" diyor; DTO'da `@Transform` ile kirpilir ve bos metin `undefined`'a cevrilir (`@IsOptional` devreye girer). Yalnizca bosluktan olusan terim de ayni yola duser.
- **Siralamada ikincil `id DESC` anahtari**: sozlesme `created_at DESC` diyor; ayni mikrosaniyede olusan iki kaydin sayfalar arasinda tekrarlanmasini/kaybolmasini onlemek icin ikincil deterministik anahtar eklendi. Bu sozlesmeyi daraltir (birincil siralama degismez), genisletmez; maliyeti sayfa basina 20 satirlik siralamadir.
- **`items` + `total` tek `$transaction` icinde**: iki sorgu arasinda yazilan bir kayit `total` ile sayfanin celismesine yol acardi; Prisma `$transaction([findMany, count])` tek gidis-donusluk tutarli goruntu verir.
- **Verimlilik**: sorgu sayfalidir (`skip`/`take`, `pageSize` <= 50 sozlesme siniri), dongu icinde DB cagrisi yok, `photoCount` DB tarafinda `_count` ile gelir (N+1 yok). Sicak yol: `reports_owner_created_at_idx` (liste) ve `pg_trgm` GIN (arama).
- **Web tarafi kapsam disi**: ticket'in kabul kriterlerinin tamami HTTP/API seviyesindedir (200/401/filtre/siralama); onceki ticketlarda (T-003/T-004/T-005) da ekran isi ayni gerekceyle yapilmadi ve `apps/web` altinda henuz router/sayfa/`api/client.ts` altyapisi yok. `design-tokens.json` bu ticket'ta tuketilmedi (UI dosyasina dokunulmadi).

## Varsayimlar
- "Arama parametresi" = sozlesmedeki `q` (baslik veya not icinde gecen terim); ayri bir alan adi uydurulmadi.
- Liste ogesi = sozlesmedeki `Report` semasi (T-005'teki `toReportDto` ile ayni alanlar); liste yanitinda fotograf dizisi yoktur (`ReportDetail` yalnizca tekil GET icindir).

## Anayasa (CLAUDE.md) Bosluklari
- Yok.

## Bilinen Sinirlamalar
- Arama buyuk/kucuk harf duyarsizligini Postgres `ILIKE` ile yapar; Turkce'ye ozgu `I/i` - `İ/ı` esleme kurallari veritabani locale'ine baglidir (ozel bir collation/normalizasyon eklenmedi — kapsam disi, architecture.md §4 arama karari basamak 0/1).
- Liste yaniti sozlesme geregi `Report` alanlarini tasir; fotograf kucuk resmi/onizleme alani yoktur (T-006 kapsami).
- Global `ValidationPipe` `forbidNonWhitelisted` ayari sorgu parametrelerine de uygulanir: sozlesmede tanimsiz bir query parametresi (`?foo=1`) 400 VALIDATION_ERROR uretir. Bu, §3.7'deki katilik kuralinin dogal sonucudur (istisna listesi genisletilmedi).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `common/errors/app-error.ts` icinde `UnprocessableError` ve `ExternalServiceError` siniflari hala yok (§4.2 hiyerarsisi eksik) — T-005 devlog'unda da notlanmis; bu ticket'in ihtiyaci olmadigi icin dokunulmadi.
- `apps/api/test/jest-e2e.config.mjs` coverage esigi tanimlamiyor (T-004/T-005 devlog'larinda da notlanmis) — dokunulmadi.
- `apps/web` altinda hala router/sayfa/`api/client.ts` altyapisi yok; architecture.md §10 esleme tablosunda T-003/T-004/T-005/T-011 icin anilan ekranlarin hicbiri henuz yazilmadi. Hicbir ticket'in kabul kriteri ekran istemedigi icin bu is bugune kadar hep ertelendi — backlog'da karsiligi olmayan bir bosluk olarak raporlaniyor (kod yazilmadi).

## Test Kosum Ciktisi (ozet)
```
# 1) ONCE KIRMIZI (dort spec dosyasina T-011 testleri eklendi, uygulama henuz yok):
Test Suites: 4 failed, 16 passed, 20 total
Tests:       60 passed, 60 total   (TS2339: Property 'listReports'/'findManyByOwner'/'list' does not exist ...)

# 1b) Joker kacisinin gercekten test edildiginin dogrulanmasi (kacis gecici olarak kaldirildi):
✕ joker karakter (%) harfi harfine aranir, tum kayitlari getirmez
✕ alt cizgi (_) joker degil, harfi harfine aranir      -> kacis geri alindi, ikisi de yesil

# 2) YESIL — birim (npm test, kok + apps/api + apps/web):
Test Suites: 4 passed / 20 passed / 2 passed
Tests:       22 + 93 + 10 = 125 passed
modules/reports -> controller / service / repository / mappers: satir kapsami %100 (esik: %80)

# 3) Entegrasyon/e2e (gercek Postgres, izole veritabani + migrate:deploy + seed):
PASS test/reports-list.e2e-spec.ts   (25 test: K1..K5 + sayfalama + 400/401 yollari)
Test Suites: 6 passed, 6 total
Tests:       83 passed, 83 total     (T-002..T-005 e2e regresyonu dahil)

# 4) Statik analiz kapilari:
npm run lint         -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck    -> temiz (kok + api + web)
npm run format:check -> All matched files use Prettier code style!
npm audit --audit-level=high -> found 0 vulnerabilities
npx prisma validate  -> gecerli (sema/migration degismedi)
```

## Iade turu 1 (code-reviewer CHANGES_REQUESTED)

**Bulgu (BLOKLEYICI 1):** `test/reports-list.e2e-spec.ts` beforeAll'i `SUBSCRIPTION_PRICE_AMOUNT` ve `PUBLIC_APP_URL` atamiyordu; bu iki anahtarin `config/env.schema.ts` icinde varsayilani yok. CI yalnizca `DATABASE_URL` verdigi icin `createApiApp()` env dogrulamasinda patlayip `process.exit(1)` cagiriyor, suite hic kosmuyordu (jest worker cokmesi ayni kosumdaki baska suite'leri de dusurebiliyordu).

**Sistematik hata ayiklama:**
1. *Izole:* Yalnizca `DATABASE_URL` export edilmis halde `npm run test:e2e -w @tutanak/api -- --testPathPattern reports-list` -> KIRMIZI, "process.exit called with 1", yigin izi `src/main.ts:20 NestFactory.create` -> ConfigModule dogrulamasi. Bulgu uygulama kodunda degil, test kurulumunda.
2. *Hipotez (tek):* Suite'in beforeAll'i varsayilani olmayan iki zorunlu anahtari (`SUBSCRIPTION_PRICE_AMOUNT`, `PUBLIC_APP_URL`) atamadigi icin env semasi acilista reddediyor; kardes e2e dosyalarinda bu iki satir var, bu dosyada yok.
3. *Test:* En kucuk degisiklik — kardes dosyalardaki (reports/templates/auth e2e) kalibin birebir kopyasi, `SUBSCRIPTION_CURRENCY`den sonra ve dinamik `import('../src/main')`dan ONCE eklendi. Uretim kodu (`src/modules/reports/**`), CI workflow'u, package.json ve migration'lar degistirilmedi.
4. *Dogrulama:* Ayni komut yesile dondu (25/25); ardindan tam suite ile birlikte de dogrulandi.

**Ikincil not (ayni turda giderildi):** `AUTH_RATE_LIMIT_MAX_REQUESTS` varsayilani 5 iken beforeAll 4 auth istegi yapiyordu (marj 1 istek). Kardes dosyalardaki kalibla `RATE_LIMIT_MAX_REQUESTS=1000` ve `AUTH_RATE_LIMIT_MAX_REQUESTS=1000` eklendi; boylece kuruluma kullanici/istek eklenirse suite 429 ile flaky olmaz. Regresyon korumasi: hata sinifi "env kurulumu eksik -> suite hic kosmuyor" oldugu icin ek bir test degil, kosum sartinin kendisi kanittir (asagidaki 1-2 numarali kosumlar: sadece `DATABASE_URL` ile once kirmizi, duzeltmeden sonra yesil).

**Degisen dosya:** yalnizca `apps/api/test/reports-list.e2e-spec.ts` (beforeAll env kurulumu, 6 satir).

### Iade turu 1 — kosum ciktisi
```
# 0) Yerel Postgres: docker compose -p tutanak-t011-e2e up -d db  (16-alpine, CI ile ayni imaj)

# 1) ONCE KIRMIZI (duzeltmeden once, ortamda SADECE DATABASE_URL):
DATABASE_URL=postgresql://tutanak:tutanak@localhost:5432/tutanak \
  npm run test:e2e -w @tutanak/api -- --testPathPattern reports-list
-> Test suite failed to run: process.exit called with "1"  (src/main.ts:20 -> ConfigModule)

# 2) SONRA YESIL — ayni komut, ayni ortam:
Test Suites: 1 passed, 1 total
Tests:       25 passed, 25 total

# 3) TAM e2e paketi (ortamda SADECE DATABASE_URL) — reviewer'in dogrulama sarti:
npm run test:e2e
Test Suites: 8 passed, 8 total
Tests:       106 passed, 106 total

# 4) Birim regresyonu:
npm test --workspace @tutanak/api -> Test Suites: 27 passed, Tests: 162 passed
npm test (kok, tum workspace'ler)  -> yesil

# 5) Statik analiz kapilari:
npm run lint      -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck -> temiz
npx prettier --check apps/api/test/reports-list.e2e-spec.ts -> Prettier uyumlu
```
