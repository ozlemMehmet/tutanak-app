# Devlog — T-027

> Uretici: dev-agent | Branch: ticket/T-027 | Tarih: 2026-08-17

Konu: imaj derlemesinde bagimlilik lifecycle script'lerinin (`preinstall`/`install`/
`postinstall`/`prepare`) `--ignore-scripts` ile kapatilmasi ve kapatmanin ZORUNLU
telafilerinin acikca, denetlenebilir bicimde yapilmasi (SonarCloud, PR #27).

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. `apps/web/Dockerfile` kurulumu `--ignore-scripts` ile yapar; web uretim imaji derlenir, `GET /` 200 + CSP/HSTS/nosniff/Referrer-Policy korunur | `apps/web/Dockerfile` → `RUN npm ci --ignore-scripts` (+ artik dayanagi kalmayan `COPY apps/api/prisma/` kaldirildi) | `tools/dependency-install-scripts.spec.ts` ("her `npm ci` --ignore-scripts tasir", "karari yorumla gerekcelendirir") + mevcut `tools/smoke-stack-wiring.spec.ts` baslik testleri DEGISTIRILMEDEN + CANLI: uretim imajinda `GET /` 200 ve dort baslik (asagida "Canli Dogrulama" §A) |
| 2. `apps/api/Dockerfile` kurulumu `--ignore-scripts` ile yapar; `bcrypt` + `sharp` acikca yeniden derlenir/kurulur, adim gerekcesiyle yorumlanir | `apps/api/Dockerfile` deps asamasi → `npm ci --ignore-scripts && npm rebuild bcrypt sharp && node -e "require('bcrypt'); require('sharp')" && npm run prisma:generate --workspace @tutanak/api`, uzun gerekce yorumu | `tools/dependency-install-scripts.spec.ts` ("native modul bcrypt/sharp acikca yeniden derlenir", "yeniden derleme kurulumdan SONRA gelir", "yuklenebildigi derleme sirasinda dogrulanir", "prisma generate acikca cagrilir") |
| 3. Uretim imajinda `GET /health` 200 `{"status":"ok"}` (native moduller gercekten yukleniyor) | (ayni degisiklik; `prisma generate` adimi olmadan uygulama HIC acilmazdi) | CANLI: duman testi yigini `api` healthy + `GET /health` → `{"status":"ok"}` (§A) |
| 4. Native modullerin FIILEN calistigi kanitlanir: (a) kayit/giris (`bcrypt`), (b) fotograf yukleme 201 + depolanan gorselin uzun kenari ≤ 1600 px (`sharp`, T-026) | (ayni degisiklik) | CANLI: register 201 / login 200 / yanlis sifre 401; upload 201 ve MinIO'dan CEKILEN BAYTLAR `sharp.metadata` ile 1200x1600 (§B). Kod tarafi regresyonu ayrica mevcut `photos.e2e-spec.ts` + `tools/photo-pipeline-config.spec.ts` ile korunuyor (degistirilmedi) |
| 5. `docker compose -f docker-compose.e2e.yml up --build` yigini bastan sona calisir; T-026 perf duzeltmesi ve T-024 basliklari bozulmaz | Dockerfile degisiklikleri + `docker-compose.e2e.yml`'ye yalnizca YORUM eklendi (davranis degismedi) | CANLI: yigin `--build` ile ayaga kalkti, tum servisler healthy, `UV_THREADPOOL_SIZE=8` imajda duruyor, PDF ucu 200 (§A/§B) |
| 6. `npm run test`, `npm run test:e2e`, `lint`, `typecheck` temiz | — | "Test Kosum Ciktisi" |

## Alinan Kararlar ve Gerekceler

- **`sharp` icin ticket'in teknik notundaki ALTERNATIF secildi ve ustune yeniden derleme
  de birakildi.** Olcum: `package-lock.json`'da `hasInstallScript` tasiyan paketler yalnizca
  `bcrypt`, `prisma`, `@prisma/client`, `@prisma/engines`, `esbuild`, `fsevents` ve
  `apps/api`'dir — **`sharp@0.35.3`'un kurulum script'i YOKTUR**, ikilileri
  `@img/sharp-*` optionalDependencies paketleriyle gelir (CLAUDE.md §6.1 `sharp` satiri
  0.33 diyor; urunde 0.35.3 yasiyor, ikisi de optionalDependencies kusagindadir). Bu yuzden
  `--ignore-scripts` `sharp`'i bozmaz — probe ile kanitlandi (`npm ci --ignore-scripts`
  sonrasi `require('sharp')` → vips 8.18.3). Yine de kriter 2'nin lafzi geregi `sharp`
  `npm rebuild` listesinde ACIKCA duruyor: bugun etkisiz (saniyeler surer) ama surum bir gun
  script'li bir kuruluma donerse adim kendiliginden geri gelir.
- **`bcrypt@6` icin `npm rebuild` GEREKLI kabul edildi.** `bcrypt` `hasInstallScript: true`
  tasir (`node-gyp-build`). Paket ici `prebuilds/` dizini `linux-x64` ve `linux-arm64`
  iceriyor ve alpine/musl uzerinde de yukleniyor (probe: `--ignore-scripts` sonrasi bile
  `hashSync` calisti), ama bu bir GARANTI degil: eslesen ikili bulunmayan bir platformda
  `node-gyp-build` kaynaktan derlemeye duser. Rebuild adimi o durumda derlemeyi GURULTULU
  bicimde durdurur — sessizce acilmayan bir uretim container'i uretmek yerine.
- **Asil kalkan `npm rebuild` degil, `node -e "require('bcrypt'); require('sharp')"`.**
  `npm rebuild` hicbir sey yapmadan da "rebuilt dependencies successfully" der; yukleme
  denemesi ise ikilinin FIILEN calistigini derleme aninda kanitlar. Bu, bilgi tabanindaki
  `devops/dockerignore-native-binary-ezilmesi.md` dersinin ("container 'Up' gorunuyordu ama
  uygulama cokmustu") derleme zamanina tasinmis halidir.
- **`prisma generate` ACIKCA cagriliyor** (`npm run prisma:generate --workspace @tutanak/api`).
  Bu, ticket metninde adi gecmeyen ama `--ignore-scripts`'in kirdigi UCUNCU script'ti:
  `apps/api`'nin `postinstall`'i. Probe ile dogrulandi — generate olmadan imaj sorunsuz
  derleniyor, container acilirken `Cannot find module '.prisma/client/default'` ile oluyor.
  Yani bu adim olmadan kriter 3 hic saglanamazdi. `@prisma/engines`'in kendi postinstall'i
  icin ek bir adim GEREKMEDI (motorlar paketle birlikte geliyor; migrate + seed + boot canli
  yigin uzerinde calisti).
- **Kok `prepare: husky || true` bilincli olarak GERI GETIRILMEDI:** git kancasi uretim
  imajinda gereksizdir (ticket kapsam metniyle ayni karar). Yerel gelistirici akisi (host
  `npm ci`) etkilenmez — kancalar orada calismaya devam eder.
- **`apps/web/Dockerfile`'daki `COPY apps/api/prisma/` kaldirildi.** Tek gerekcesi, workspace
  kurulumunda otomatik kosan `prisma generate` postinstall'iydi; o script bu imajda artik
  calismiyor. Yerinde birakmak, dosyada yanlis bir gerekce yorumu birakmak olurdu. Statik SPA
  derlemesi Prisma Client'a dokunmuyor — web uretim imaji bu haliyle derlendi ve `GET /` 200
  dondu. `esbuild` de (kurulum script'i olmasina ragmen) `@esbuild/*` optionalDependencies
  ile calistigi icin telafi istemedi; kanit: Vite derlemesi `--ignore-scripts` altinda gecti.
- **`docker-compose.e2e.yml`'ye yalnizca yorum eklendi** (ticket "Kapsam DISI" maddesinin
  acik izniyle): `POSTGRES_PASSWORD: tutanak` degeri `down -v` ile silinen gecici duman testi
  fixture'idir; uretim yolu `factory/10-release/runbook.md` §1 compose'unda
  `POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}` yazar (dogrulandi: runbook satir 129/147).
- **Testler `tools/*.spec.ts` desenine yazildi** (`docker-build-context`, `smoke-stack-wiring`,
  `photo-pipeline-config` ile ayni desen): kural Dockerfile'da yasar, birim/e2e testi onu
  goremez. Yardimci fonksiyon (`runInstructions`) ters-bolu ile devam eden `RUN` zincirini tek
  komuta indirger ve YORUM satirlarini eler — yorumdaki bir `--ignore-scripts` kanit sayilmaz;
  bu davranis fixture'li bir testle kilitlendi (T-026'nin "yalnizca son FROM'un ENV'i sayilir"
  testiyle ayni yaklasim).
- **Verimlilik:** degisiklik derleme zamani kurulum adimidir; sicak yol yok. Katman
  onbellegi bir kez gecersizlesir (ticket teknik notunda beklenen), `npm rebuild` +
  `require` + `generate` toplami ~3 sn.

## Varsayimlar

- Uretim hedefi mimarisinin (`linux/amd64` VPS) `bcrypt` prebuild'i mevcuttur: paketteki
  `prebuilds/linux-x64` dizini bunu gosteriyor. Canli dogrulama bu makinede `linux/arm64`
  uzerinde yapildi; farkli mimaride ikili eslesmezse rebuild adimi derlemeyi durdurur
  (sessiz kalmaz).
- Duman testi yiginini `.env` olmadan calistirmak icin `.env.example` kopyasi repo DISINDA
  (`/tmp/t027.env`) tutuldu ve compose'a repo disi bir override ile verildi (T-026'daki
  yontemin aynisi). Repo agacina hicbir gecici dosya yazilmadi.

## Anayasa (CLAUDE.md) Bosluklari

- CLAUDE.md imaj derleme/tedarik zinciri sertlestirmesi hakkinda kural icermiyor (§9 yalnizca
  `npm audit` kapisini tanimlar). Karar ticket + SonarCloud bulgusuna gore verildi; aday kural:
  **"uretim imajlarinda bagimlilik kurulumu `--ignore-scripts` ile yapilir; gereken her script
  acikca ve yorumlu bir adimla geri getirilir."**
- Kucuk sapma notu (degistirilmedi, yalnizca kayit): CLAUDE.md §6.1 `sharp` surumunu `0.33`
  yaziyor, `apps/api/package.json` `^0.35.3` tasiyor. Anayasa dosyalari dev tarafindan
  degistirilmez (§11) ve surum degisikligi bu ticket'in kapsami disidir.

## Bilinen Sinirlamalar

- `tools/dependency-install-scripts.spec.ts` bir METIN sozlesmesidir: Dockerfile'in
  `--ignore-scripts` tasidigini kanitlar, kurulumun gercekten script'siz kostugunu degil.
  Gercek kanit `docker build`'in kendisidir (kurulum script'i olmadan `require` adimi gecmezse
  derleme kirilir) ve asagidaki canli dogrulamadir.
- Duman testi yigini hala elle kosuluyor (CI'da otomatik degil); `.github/` dev-agent'a kapali
  oldugu icin bu ticket'ta ele alinamaz.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- `apps/api/Dockerfile` `runtime` asamasi `node_modules`'i devDependencies ile birlikte
  tasiyor (`prisma` CLI acilista gerekiyor); zaten `factory/10-release/devops-report.md`'de
  kayitli bilinen sinirlama. Tedarik zinciri yuzeyini kucultmek icin ayri bir ticket adayidir.
- Imajlar hala `root` ile calisiyor (guvenlik denetimi S-06, LOW) — ticket'in kapsam disi
  listesinde zaten ayrik.
- CLAUDE.md §6.1 ile `apps/api/package.json` arasindaki `sharp` surum sapmasi (yukarida).

## Canli Dogrulama (uretim imajlari, `docker-compose.e2e.yml`)

Kurulum: `docker compose -p t027smoke -f docker-compose.e2e.yml -f /tmp/t027-override.yml
build && ... up -d` (override yalnizca `.env` yerine `/tmp/t027.env` env dosyasini baglar),
`HTTP_PORT=8127`. Sonunda `down -v` ile temizlendi.

**§A — yigin + basliklar + health**

```
NAME                  STATUS
t027smoke-api-1       Up (healthy)      # migrate + seed + Nest boot => Prisma Client uretilmis
t027smoke-db-1        Up (healthy)
t027smoke-web-1       Up (healthy)      0.0.0.0:8127->80/tcp

GET /            -> HTTP/1.1 200 OK
  Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
    base-uri 'self'; frame-ancestors 'none'; form-action 'self';
    img-src 'self' data: blob: http://localhost:9000; connect-src 'self' http://localhost:9000
  Strict-Transport-Security: max-age=31536000; includeSubDomains
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer

GET /health      -> HTTP:200 {"status":"ok"}
docker exec t027smoke-api-1 printenv UV_THREADPOOL_SIZE   -> 8            (T-026 korundu)
docker exec t027smoke-api-1 node -e "require('bcrypt'); require('sharp')" -> vips 8.18.3
```

**§B — native modullerin FIILEN calistigi (kriter 4)**

```
POST /api/v1/auth/register           -> HTTP:201     (bcrypt hash)
POST /api/v1/auth/login              -> HTTP:200     (bcrypt compare, token 236 karakter)
POST /api/v1/auth/login (yanlis sifre)-> HTTP:401    (compare gercekten calisiyor)
POST /api/v1/reports                 -> HTTP:201
POST /api/v1/reports/{id}/photos     -> HTTP:201  (girdi 2400x3200 JPEG)
   yanit: widthPx=1200 heightPx=1600 sizeBytes=11518
   DEPOLANAN BAYTLAR (MinIO'dan `mc cat` ile cekilip host'ta `sharp.metadata`):
   jpeg 1200x1600  -> uzun kenar = 1600  (T-026 davranisi korundu)
GET  /api/v1/reports/{id}/pdf        -> HTTP:200 application/pdf, 13713 bayt (%PDF- basligi)
```

Ek olarak yerel gelistirme hedefi de dogrulandi (deps asamasi paylasildigi icin):
`docker build --target dev` → `bcrypt + sharp + Prisma Client` yuklenebiliyor.

## Test Kosum Ciktisi (ozet)

CI paritesi: yalnizca `DATABASE_URL=postgresql://tutanak:tutanak@localhost:5432/tutanak`
(kapsayici Postgres 16), `prisma:generate` + `migrate:deploy` + `seed` sonrasi tam paket.

```
npm run format:check  -> All matched files use Prettier code style!   (exit 0)
npm run lint          -> 0 hata / 0 uyari (--max-warnings=0)          (exit 0)
npm run typecheck     -> exit 0

npm run test          -> exit 0
  kok (tools):   Test Suites: 10 passed, 10 total | Tests:  68 passed
  apps/api:      Test Suites: 56 passed, 56 total | Tests: 377 passed
  apps/web:      Test Suites: 53 passed, 53 total | Tests: 390 passed

npm run test:e2e      -> exit 0
  apps/api:      Test Suites: 13 passed, 13 total | Tests: 200 passed

Kirmizi-yesil disiplini: tools/dependency-install-scripts.spec.ts once yazildi ve
Dockerfile degisiklikleri ONCESI kosuldu -> 9 failed / 3 passed (12), degisiklik
sonrasi -> 12 passed.
```
