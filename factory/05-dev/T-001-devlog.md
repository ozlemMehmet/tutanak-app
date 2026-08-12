# Devlog — T-001

> Uretici: dev-agent | Branch: ticket/T-001 | Tarih: 2026-08-12

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayan kod | Karsilayan test | Durum |
|---|---|---|---|
| K1: Kok dizinde build komutu hatasiz tamamlanir | Kok `package.json` (npm workspaces), `apps/api` (`tsc -p tsconfig.build.json`), `apps/web` (`vite build`) | `npm run build` kosumu + `scripts/verify-pwa-build.mjs` (build ciktisi dogrulamasi); uretilen `apps/api/dist/main.js` calistirilip `/health` ile duman testi yapildi | OK |
| K2: CI her push/PR'da otomatik calisir, lint + test icerir | `.github/workflows/ci.yml` (hazir tanim: `factory/05-dev/T-001-ci-workflow.yml`) | `tools/ci-workflow.spec.ts` (yazildi, kirmizi gorulduktan sonra kaldirildi — asagiya bakiniz) | **BLOKE** |
| K3: Gecerli PWA manifest (name, icons, start_url, display: standalone) | `apps/web/public/manifest.webmanifest`, `apps/web/index.html` | `apps/web/src/pwa/manifest.spec.ts` (6 test: JSON gecerliligi, name/short_name, start_url, display, 192/512 ikon + dosya varligi, maskable ikon, index.html link etiketi) | OK |
| K4: Uygulama service worker kaydeder | `apps/web/src/pwa/register-service-worker.ts`, `apps/web/src/main.tsx`, `vite.config.ts` (vite-plugin-pwa generateSW -> `dist/sw.js`) | `register-service-worker.spec.ts` (3 test: kayit mutlu yolu + scope, desteklenmeyen tarayici, kayit hatasi) + `scripts/verify-pwa-build.mjs` (dist'te `sw.js`, precache manifesti ve paket icinde kayit kodu) | OK |
| K5: README yerelde calistirma + test adimlarini icerir | `README.md` | `tools/readme.spec.ts` (3 test: yerel calistirma, test komutlari, build/lint komutlari) | OK |

Ek olarak mimarinin T-001 satirinda istenen bilesenler: `apps/api` iskeleti + `GET /health`
(`/api/v1` oneki disinda, kimliksiz), `docker-compose.yml` (api, db, minio, mailpit, web),
ESLint/Prettier/tsconfig, `.env.example`.

## K2 — Bloke Nedeni (sahte cozum uretilmedi)
- `.github/**` altina yazma girisimi calisma ortami politikasi tarafindan reddedildi:
  `Factory policy blocked write path for dev-agent: .../.github/workflows/ci.yml`.
  Ayni blok `.github/` altindaki herhangi bir dosya icin de gecerli (probe ile dogrulandi).
- Kriteri "yorumlayip" baska bir yere workflow koymak ya da testi bu yeni yola bakacak sekilde
  zayiflatmak **yapilmadi** (mutlak kural 7). Once `tools/ci-workflow.spec.ts` yazildi, kirmizi
  goruldu; kurulum imkansiz oldugu icin repoda bilerek kirmizi kalan test birakmamak adina
  spec kaldirildi ve kriter bloke olarak raporlandi.
- Kurulmaya hazir workflow tanimi birebir `factory/05-dev/T-001-ci-workflow.yml` dosyasindadir;
  `.github/workflows/ci.yml` olarak kopyalanmasi yeterlidir (adimlar: `format:check` -> `lint` ->
  `typecheck` -> `test` -> `test:e2e` -> `build` -> `verify:pwa` -> `npm audit --audit-level=high`).
  Tum bu komutlar yerelde calistirildi ve yesil (asagidaki cikti ozeti).
- **Oneri:** ya `.github/**` yazma izni dev-agent'a acilsin ya da workflow kurulumu
  devops-agent/control-plane tarafindan yapilsin; aksi halde T-001 kriter 2 kapanamaz.

## Alinan Kararlar ve Gerekceleri
- **Manifest elle, SW uretilmis:** `vite-plugin-pwa` `manifest: false` ile kullanildi; manifest
  CLAUDE.md §1 agacinda `apps/web/public/manifest.webmanifest` olarak tanimli oldugu icin statik
  dosya olarak tutuldu (boylece dogrudan test edilebilir). Service worker ise Workbox tarafindan
  uretiliyor (architecture.md: el yazimi SW yerine uretilmis precache manifesti).
- **`injectRegister: null` + acik kayit fonksiyonu:** eklentinin otomatik enjekte ettigi kayit kodu
  birim testine kapali; kayit `register-service-worker.ts` icinde saf fonksiyon olarak yazildi ve
  uc yolu da (destekli/desteksiz/hata) test edildi.
- **`createApiApp()` export'u:** e2e testi ile `bootstrap` yapilandirmasinin (global onek, helmet)
  sapmamasi icin uygulama kurulumu tek yerde; `main.ts` yalnizca `require.main === module` iken
  dinlemeye baslar. Ayri bir "app-setup" katmani acilmadi (§7.1 katman yasagi).
- **Port env'den okunmadi:** CLAUDE.md §5.1 tablosunda `PORT` anahtari yok; kendi env adimi icat
  etmek yerine `API_PORT = 3000` sabiti kullanildi (§5.1 son cumle).
- **Test kosucusu jest:** `.mjs` jest yapilandirmasi secildi; TypeScript jest config'i `ts-node`
  bagimliligi isteyecekti ve `ts-node` §6.1 listesinde yok — yeni bagimlilik eklemek yerine
  yapilandirma dosyalari `.mjs` yapildi. Web tarafinda da vitest yerine jest kullanildi (§6.1).
- **Web'de UI kutuphanesi/test kutuphanesi eklenmedi:** `@testing-library`, `react-router`,
  `react-query` T-001 kapsaminda degil; `main.tsx` yalnizca iskelet bir kabuk render eder ve
  §8.7 geregi kapsam disidir (kapsam olcumu `src/**/*.ts` uzerinden, esik %80).
- **Nest modul siniflari icin `no-extraneous-class` kapatildi** (yalnizca `*.module.ts` icin,
  gerekce yorumla birlikte) — Nest'in dekorator kalibi govdesiz sinif gerektiriyor.

## Varsayimlar
- CI ortami Node 22 kullanir (kok `engines: node >= 22`; workflow `setup-node@v4` ile 22).
- `npm run test:e2e` su an DB gerektirmiyor (yalnizca `/health`); T-002'den itibaren gercek
  Postgres gerektiren e2e testleri eklenince CI'a servis/migrate adimi eklenmesi gerekecek.
- Yerel `docker compose up` senaryosu `docker compose config` ile sozdizimsel olarak dogrulandi;
  imajlarin fiilen indirilip ayaga kalkmasi bu ortamda kosulmadi (daemon/imaj indirme kapsam disi).

## Anayasa (CLAUDE.md) Bosluklari
- **CI dosya sahipligi:** Anayasa `.github/workflows/ci.yml`'i §1 agacinda repo koku olarak
  tanimliyor ama hangi ajanin yazacagini soylemiyor; calisma ortami dev-agent'a bu yolu kapatiyor.
  Bu celiski yukarida K2 altinda raporlandi.
- **`test:e2e` kapsami:** §8.2 e2e'yi "gercek Postgres" ile tanimliyor; T-001'de veri katmani
  olmadigi icin e2e yalnizca HTTP seviyesinde kosuyor. T-002'de gercek DB'li kuruluma gecilecek.
- **Kapsam esigi baslangici:** §8.7 `apps/api/src/modules/**` icin %80 esik istiyor; su an tek
  modul (`health`) var ve %100 kapsaniyor, esik jest yapilandirmasina bagli birakildi.

## Bilinen Sinirlamalar
- **CI workflow kurulu degil** (K2 — yukariya bakiniz). Bu haliyle her push/PR'da otomatik kosum yok.
- **husky pre-commit hook'u kurulamadi:** `.husky/pre-commit` yazma izni ortam tarafindan reddedildi
  (`Permission to use Write has been denied`). `lint-staged` yapilandirmasi ve `prepare: husky`
  script'i kok `package.json` icinde hazir; hook dosyasinin eklenmesi gerekiyor. §9'un "yerel"
  satiri bu nedenle yarim.
- Service worker yalnizca production build'de aktif (`devOptions` kapali) — dev sunucusunda
  kayit beklenmiyor; tarayicida dogrulama adimi README'de tarif edildi.
- Uygulama kabugu bilincli olarak bostur (tek baslik); router/sayfalar T-003+ ticketlarinda.

## Verimlilik Oz-Kontrolu
- Sicak yol yok: `/health` sabit nesne dondurur; SW kayit fonksiyonu tek cagri. Dongu, DB/HTTP
  cagrisi iceren dongu ya da sayfalamasiz sorgu bulunmuyor. `verify-pwa-build.mjs` yalnizca build
  ciktisindaki birkac dosyayi okur (O(dosya sayisi)).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- Repoda `.DS_Store` dosyalari izleniyordu; `.gitignore` zaten bunlari kapsiyor, mevcut takipli
  dosyalara dokunulmadi.
- `factory/04-architecture/api-contract.yaml` -> `npm run gen:api-types` script'i eklendi ama
  uretilen `apps/web/src/api/schema.d.ts` bu ticketta uretilmedi (T-003 ihtiyaci).

## Test Kosum Ciktisi (ozet)
```
$ npm run format:check   -> All matched files use Prettier code style!
$ npm run lint           -> 0 error, 0 warning (--max-warnings=0)
$ npm run typecheck      -> kok + apps/api + apps/web: hatasiz

$ npm run test
  tools/readme.spec.ts           3 passed
  @tutanak/api  health.controller.spec.ts        1 passed  (kapsam: %100 lines)
  @tutanak/web  manifest.spec.ts (7) +
                register-service-worker.spec.ts (3)  10 passed (kapsam: %100 lines)
  Toplam: 14 test, 14 passed

$ npm run test:e2e
  apps/api/test/health.e2e-spec.ts  2 passed
    ✓ kimlik dogrulama olmadan 200 ve { status: ok } doner
    ✓ /api/v1 onekinin altinda yayinlanmaz (404 doner)

$ npm run build          -> apps/api tsc OK; apps/web vite build OK (sw.js + workbox uretildi)
$ npm run verify:pwa     -> PWA build dogrulamasi gecti: manifest + service worker + kayit kodu mevcut
$ npm audit --audit-level=high -> found 0 vulnerabilities
$ docker compose config -q     -> gecerli
$ node apps/api/dist/main.js   -> GET /health {"status":"ok"}, GET /api/v1/health 404, helmet basliklari mevcut
```
