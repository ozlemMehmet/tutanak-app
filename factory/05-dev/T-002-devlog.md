# Devlog — T-002

> Uretici: dev-agent | Branch: ticket/T-002 | Tarih: 2026-08-12

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayan kod | Karsilayan test | Durum |
|---|---|---|---|
| K1: Migration calistirildiginda kullanici, sablon, tutanak, fotograf, onay, abonelik tablolari olusur | `apps/api/prisma/schema.prisma` + `prisma/migrations/20260812000000_init/migration.sql` | `apps/api/test/migration.e2e-spec.ts` — temiz veritabaninda `migrate:deploy` sonrasi 9 tablo + 5 enum tipi | OK |
| K2: Seed sonrasi tam 3 sablon, adlar birebir | `migration.sql` (ON CONFLICT DO NOTHING) + `prisma/seed.ts` (upsert) | `migration.e2e-spec.ts` — sayim 3, adlar PRD ile birebir, seed 2 kez daha kosulunca yine 3 (idempotans) | OK |
| K3: Tutanak semasi zorunlu owner + sablon referansi ister | `reports.owner_id/template_id NOT NULL REFERENCES` (schema + migration) | `migration.e2e-spec.ts` — NULL owner/template -> 23502, hayali owner/template -> 23503, gecerli referanslarla insert basarili (`test/factories/*.factory.ts`) | OK |
| K4: Rollback tum tablolari kaldirir | `prisma/migrations/20260812000000_init/down.sql` + `npm run migrate:down` | `migration.e2e-spec.ts` — down sonrasi tablo/enum/fonksiyon listeleri bos; ardindan `migrate:deploy` yeniden hatasiz kosuyor | OK |
| K5: Migration CI'da otomatik ve hatasiz calisir | `.github/workflows/ci.yml` (postgres:16 servisi, `prisma:generate`, `prisma:validate`, sapma kontrolu, `migrate:deploy`, `seed`) | `tools/ci-migration.spec.ts` — workflow YAML olarak cozulerek servis/env/adim dogrulanir | OK |

## Alinan Kararlar ve Gerekceler
- **Migration SQL'i `prisma migrate diff` ciktisindan uretildi, DDL'e ozgu kisimlar eklendi.** Tablo/sutun/index/FK ifadeleri Prisma'nin uretimiyle birebir; Prisma'nin ifade edemedigi uzantilar (citext, pg_trgm), CHECK kisitlari ve trigger'lar `data-model.sql`'den alindi. Sapma riski CI'da `prisma migrate diff --exit-code` ile kapatildi (yerelde "No difference detected" dogrulandi).
- **Sablon kayitlari hem migration'da hem seed.ts'te.** `data-model.sql` "iki taraf da idempotenttir (ON CONFLICT (code) / upsert)" diyor; boylece K2, yalin `migrate deploy` sonrasinda da saglaniyor, seed.ts ise surekli calistirilan idempotent kaynak olarak kaliyor. Migration dosyasi tarihsel ve degismezdir, seed.ts ilerideki degisikliklerin yeri.
- **Rollback icin `down.sql` + `prisma db execute`.** Prisma Migrate down migration uretmiyor; kriter 4 bir geri alma komutu istiyor. `_prisma_migrations` tablosu da dusuruluyor ki geri alinan veritabaninda `migrate deploy` bastan kosabilsin (test bunu dogruluyor).
- **Seed calistirmasi icin yeni bagimlilik eklenmedi:** `node --experimental-strip-types` ile `.ts` dogrudan kosuluyor (§6.1 listesinde `ts-node`/`tsx` yok; T-001'de de ayni gerekceyle eklenmemisti).
- **Test kendi izole veritabanini yaratiyor** (`tutanak_t002_migration_test`), sonunda dusuruyor: "temiz veritabaninda migration" senaryosu (§8.2) gercekten temiz bir DB'de kosuyor ve gelistiricinin veritabani bozulmuyor. Ayri bir test-DB env anahtari **icat edilmedi** (§5.1 son cumle).
- **Test altyapisi ayrimi (bilgi tabani dersi `testing/test-fabrika-yerlesimi.md`):** `test/db.ts` yalnizca baglanti/SQL/SQLSTATE/script kosum yardimcilari; varlik ureten her sey `test/factories/<varlik>.factory.ts` altinda (dosya basina bir varlik).
- **Verimlilik oz-kontrolu:** seed dongusu sabit 3 elemanlidir (buyume yok), ic ice dongu/dongu icinde sorgu yok. Sema tarafinda her FK sutununda index var, listeleme/arama icin `reports_owner_created_at_idx` ve trigram GIN index'leri DDL'den birebir alindi.
- **CI'da golge veritabani `prisma db execute` ile aciliyor**, `psql` ile degil: kosucuda harici bir istemci varligina bel baglanmiyor (yerelde ayni komut dogrulandi).
- **Prisma istemci uretimi otomatiklestirildi:** `apps/api` `postinstall` -> `prisma generate` (yerelde `npm install` ile uretildigi dogrulandi) ve Dockerfile'da sema, `npm ci` oncesi kopyalaniyor; CI'da ayrica acik bir adim var.

## Varsayimlar
- CI kosucusundaki `postgres:16-alpine` servis kullanicisi superuser'dir (e2e testi kendi veritabanini `CREATE DATABASE` ile aciyor).
- `setup-node@v4` + `node-version: 22` guncel 22.x kurar; tip siyirma (`--experimental-strip-types`) mevcuttur (yerelde Node 22.23 ile dogrulandi).
- `updated_at` tazelemesi uygulama katmanina degil, DB trigger'ina birakildi (DDL boyle tanimliyor); Prisma semasinda bu yuzden `@updatedAt` kullanilmadi.

## Anayasa (CLAUDE.md) Bosluklari
- **§1 "migrations/ elle duzenlenmez":** Prisma Migrate CHECK kisiti, trigger ve uzanti uretemedigi icin `migration.sql` uretilen ciktiya bu bloklar eklenerek tamamlandi. Kural, "sema-migration tutarliligi CI'da dogrulanir" seklinde netlestirilmeli.
- **Test veritabani adresi icin env anahtari yok (§5.1):** e2e testleri `DATABASE_URL` uzerinden gecici bir veritabani turetiyor. Ayri bir `TEST_DATABASE_URL` anahtari uydurulmadi.
- **CI dosyasinin sahipligi hala tanimsiz** (T-001 devlog'unda da isaretlenmisti): T-002 kriter 5 geregi workflow dev-agent tarafindan genisletildi.

## Bilinen Sinirlamalar
- Geri alma script'i tek baslangic migration'i icindir; ileride eklenecek her migration kendi `down.sql`'ini getirmelidir (dosya basliginda not var). Zincirleme (adim adim) geri alma yok.
- `docker compose` ile api servisinin acilista migration+seed kosmasi yalnizca `docker compose config` ile sozdizimsel dogrulandi; imajlar bu ortamda fiilen ayaga kaldirilmadi.
- Veri katmani disinda hicbir sey eklenmedi: repository/servis/endpoint yok (T-003+). `PrismaService` (`infra/prisma/`) de bu ticket kapsaminda degil, ilk kullanan ticket ile gelecek.
- `report_photos.captured_at` / `approvals.approved_at` degistirilemezlik trigger'lari migration'da mevcut ama testleri T-006/T-010 kapsaminda (bu ticketin kriterlerinde yok).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `.env.example` icindeki `EMAIL_FROM=Tutanak <noreply@localhost>` degeri, §5.1'in tanimladigi "adres@alan" bicimine (nokta iceren alan adi) uymuyor olabilir; T-003+ zod env semasi yazilirken yerel varsayilan dogrulamadan gecmeyebilir.
- `docker-compose.yml` `api` servisi yalnizca `DATABASE_URL` alıyor; §5/§5.1'deki diger anahtarlar (JWT_SECRET vb.) config semasi eklendiginde servise tasinmali.

## Test Kosum Ciktisi (ozet)
```
$ npm run lint            -> 0 uyari/hata
$ npm run format:check    -> All matched files use Prettier code style!
$ npm run typecheck       -> kok + api + web temiz
$ npm run test            -> tools 15/15, api 1/1, web 10/10 (kapsam esikleri gecti)
$ npm run test:e2e        -> Test Suites: 2 passed, Tests: 14 passed
     PASS test/migration.e2e-spec.ts (10 test: tablolar, enum'lar, seed sayimi/adlari,
          seed idempotansi, 4 referans kisiti, gecerli referans, rollback, yeniden deploy)
     PASS test/health.e2e-spec.ts
$ npx prisma migrate diff --from-migrations ... --exit-code -> No difference detected.
```

Kirmizi-yesil dogrulamasi: `tools/ci-migration.spec.ts` once 5 test kirmizi kosuldu (workflow'da
migration adimlari yokken), adimlar eklendikten sonra yesile dondu. Rollback testi ayrica mutasyonla
sinandi: `down.sql`'den `DROP TABLE "users"` satiri gecici olarak kaldirildiginda test kirmizi oldu.
