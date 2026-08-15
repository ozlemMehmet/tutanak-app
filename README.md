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
`db` (Postgres 16), `minio` (S3 uyumlu obje depolama), `mailpit` (http://localhost:8025).
Hicbir dis hesap/anahtar gerekmez; odeme saglayicisi yerelde `PAYMENT_PROVIDER=fake` ile calisir.

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
