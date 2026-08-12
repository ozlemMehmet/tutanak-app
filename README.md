# tutanak-app — Emlak Teslim Tutanagi Platformu

Mobil oncelikli PWA (React + Vite) ve NestJS API'den olusan npm workspaces monorepo'su.
Mimari kurallar ve baglayici gelistirme anayasasi: `factory/04-architecture/CLAUDE.md`.

```
apps/api    NestJS backend (GET /health hazir, is modulleri sonraki ticketlarda)
apps/web    React + Vite PWA (manifest + service worker)
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

## Testleri Calistirma

```bash
npm run test        # tum workspace'lerin birim testleri (kapsam esikleri dahil)
npm run test:e2e    # HTTP seviyesi entegrasyon testleri (supertest)
```

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
`format:check` -> `lint` -> `typecheck` -> `test` -> `test:e2e` -> `build` -> `verify:pwa` -> `npm audit`.
Workflow tanimi: `.github/workflows/ci.yml`.
