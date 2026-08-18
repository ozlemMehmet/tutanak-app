# tutanak-app — Emlak Teslim Tutanagi Platformu

Mobil oncelikli PWA (React + Vite) ve NestJS API'den olusan npm workspaces monorepo'su.
Mimari kurallar ve baglayici gelistirme anayasasi: `factory/04-architecture/CLAUDE.md`.

```
apps/api    NestJS backend (auth, users, templates, reports, photos, pdf, sharing,
            approvals, billing modulleri)
apps/web    React + Vite PWA (giris/kayit, tutanak listesi ve olusturma, tutanak
            detayi, abonelik ekranlari + oturumsuz paylasim gorunumu)
scripts/    yardimci dogrulama script'leri
tools/      repo iskeletini dogrulayan testler
```

## Gereksinimler

- Node.js 22+ ve npm 10+
- Docker (yalnizca `docker compose` ile calistirmak icin)

## Yerelde Calistirma

### Secenek 1 — Docker (tek komut)

```bash
cp .env.example .env
docker compose up
```

Ayaga kalkan servisler: `web` (http://localhost:5173), `api` (http://localhost:3000),
`db` (Postgres 16), `minio` (S3 uyumlu obje depolama).
Hicbir dis hesap/anahtar gerekmez; odeme saglayicisi yerelde `PAYMENT_PROVIDER=fake` ile calisir.

### Yerelde e-posta

Yerelde e-posta GONDERILMEZ ve yakalanmaz — `docker compose` bir SMTP yakalayici konteyner
calistirmaz.
E-posta siniri Resend'in HTTPS API istemcisidir (SMTP degil), bu yuzden yerel bir SMTP
yakalayicisi hicbir zaman e-posta almaz. `RESEND_API_KEY` bos birakildiginda
`POST /reports/{id}/share-link/email` ucu `202` doner ve gonderim durumu yanitta
`status: "failed"` olarak raporlanir: bu bir hata degil, BEKLENEN yerel davranistir
(uygulama anahtarsiz da acilir).

Paylasim linki e-postadan bagimsiz uretilir: `POST /reports/{id}/share-link` ile alinan
link ve `wa.me` metni her durumda gecerlidir; yerelde paylasimi bu yolla test edin.
Gercek gonderimi denemek icin `.env` dosyasina gecerli bir `RESEND_API_KEY` yazin.

### Secenek 2 — Docker'siz

```bash
cp .env.example .env
npm install
npm run dev --workspace @tutanak/web    # http://localhost:5173
npm run start:dev --workspace @tutanak/api   # http://localhost:3000/health
```

API'nin sagligini dogrulamak icin:

```bash
curl http://localhost:3000/health   # {"status":"ok"}
```

## Veritabani (Prisma)

Sema: `apps/api/prisma/schema.prisma` (mimarinin `data-model.sql` dosyasiyla birebir uyumlu).
Migration'lar: `apps/api/prisma/migrations/`. Komutlar `DATABASE_URL` ortam degiskenini kullanir.

```bash
npm run prisma:generate --workspace @tutanak/api   # Prisma istemcisini uret (npm install sonrasi otomatik)
npm run migrate:deploy --workspace @tutanak/api    # migration'lari uygula
npm run seed --workspace @tutanak/api              # 3 sabit sablonu yaz (idempotent)
npm run migrate:down --workspace @tutanak/api      # geri alma: tum tablo/tip/fonksiyonlari kaldirir
```

`docker compose up` ile ayaga kalkan `api` servisi acilista migration + seed adimlarini kendisi kosar.

## Testleri Calistirma

```bash
npm run test        # tum workspace'lerin birim testleri (kapsam esikleri dahil)
npm run test:e2e    # HTTP seviyesi entegrasyon testleri (supertest + gercek Postgres)
```

`test:e2e` calisan bir Postgres ister (`DATABASE_URL`); migration testi kendi izole
veritabanini olusturup sonunda dusurur, gelistirme veritabanina dokunmaz.

Uygulama acilista ortam degiskenlerini dogrular (eksik sir/ayar varsa ACILMAZ), ama e2e
icin `.env` YUKLEMEK GEREKMEZ: her e2e spec'i uygulamayi ayaga kaldirmadan once kendi
ortam degiskenlerini `beforeAll` icinde kendisi kurar. Disaridan verilmesi gereken tek
deger `DATABASE_URL`'dir — CI de yalnizca bunu tanimlar (`.github/workflows/ci.yml`):

```bash
DATABASE_URL='postgresql://tutanak:tutanak@localhost:5432/tutanak' npm run test:e2e
```

Bu kosum CI paritesindedir: kabuktan sizan degerlere guvenmedigi icin komsu suite'ten
gelen bir degiskenin hatayi maskelemesi mumkun degildir.

Tek bir workspace'i kosmak icin:

```bash
npm run test --workspace @tutanak/api
npm run test --workspace @tutanak/web
```

### Tarayici seviyesinde yerlesim testleri (Playwright)

Birim/jsdom testleri yerlesim GORMEZ (`getBoundingClientRect()` jsdom'da her zaman 0 doner,
CSS cascade uygulanmaz, viewport kavrami yoktur). "Icerik masaustunde kenardan kenara
yayiliyor" sinifi bu yuzden ayri bir suite ile, gercek tarayicida ve iki viewport'ta
(`1280x900` masaustu, `390x844` mobil) olculur: `apps/web/e2e/`.

Suite CALISAN bir yigin ister (web `http://localhost:5173`, API `http://localhost:3000/api/v1`)
ve yigini kendisi baslatmaz:

```bash
cp .env.example .env
docker compose up -d          # db + minio + api + web ayaga kalkar
npx playwright install chromium   # tarayici bir kez indirilir
npm run test:browser          # iki viewport (masaustu + mobil)
```

Tek bir viewport'u kosmak icin:

```bash
npm run test:browser --workspace @tutanak/web -- --project=masaustu
```

Suite oturumu ekran uzerinden gercek `POST /auth/register` + `POST /auth/login` akisiyla kurar
(sabit kullanici yoktur) ve olcumu bu oturumla yapar. Farkli bir adrese karsi kosmak icin
`E2E_BASE_URL` verilir:

```bash
E2E_BASE_URL=http://localhost:8080 npm run test:browser
```

Suite CI'a **bagli degildir**: calisan yigin gerektirdigi icin ayri bir job ister
(bkz. `factory/05-dev/H-006-devlog.md`).

## Kalite ve Build Komutlari

```bash
npm run lint          # ESLint (uyari sayisi 0 ile gecer)
npm run format:check  # Prettier bicim kontrolu
npm run typecheck     # tsc --noEmit (tum workspace'ler)
npm run build         # apps/api (tsc) + apps/web (vite build)
npm run verify:pwa    # build ciktisinda manifest + service worker dogrulamasi
```

## PWA

- Manifest: `apps/web/public/manifest.webmanifest` (`display: standalone`, 192/512 px ikonlar,
  maskable ikon dahil) ve `index.html` icinde `<link rel="manifest">` ile baglanir.
- Service worker: `vite-plugin-pwa` (Workbox, `generateSW`) tarafindan `dist/sw.js` olarak uretilir;
  kayit `apps/web/src/pwa/register-service-worker.ts` icinde acikca yapilir.
- Kayit yalnizca **build ciktisinda** (`npm run build && npm run preview --workspace @tutanak/web`)
  veya production'da aktiftir; dev sunucusunda service worker devre disidir.
  Tarayicida dogrulama: DevTools > Application > Service Workers -> `sw.js` "activated and is running".

## Surekli Entegrasyon (CI)

CI her `push` ve `pull_request` olayinda su adimlari calistirir:
`prisma:generate` -> `format:check` -> `lint` -> `typecheck` -> `prisma:validate` ->
sema-migration sapma kontrolu -> `migrate:deploy` -> `seed` -> `test` -> `test:e2e` ->
`build` -> `verify:pwa` -> `npm audit`. Migration adimlari is icinde ayaga kalkan
`postgres:16-alpine` servisine karsi kosar.
Workflow tanimi: `.github/workflows/ci.yml`.
