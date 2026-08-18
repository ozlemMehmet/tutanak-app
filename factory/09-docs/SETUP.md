# SETUP — Kurulum

Bu doküman `main` branch'teki gerçek koda karşı doğrulanmıştır (her komut çalıştırılıp
çıktısı kontrol edildi). İki kurulum yolu vardır: **Docker (önerilen)** ve **Docker'sız**.

## Gereksinimler

| Araç | Sürüm | Not |
|---|---|---|
| Node.js | ≥ 22 | `package.json` → `engines.node` |
| npm | 10+ | workspaces (`apps/*`) |
| Docker + Docker Compose | herhangi bir güncel sürüm | yalnızca `docker compose up` yolu için |
| PostgreSQL 16 | — | Docker'sız yolda kendiniz sağlamalısınız |

## Yol 1 — Docker (tek komut, dış hesap gerektirmez)

```bash
git clone <repo-url> tutanak-app
cd tutanak-app
cp .env.example .env
docker compose up
```

Bu tek komut şunları yapar:
1. `db` (Postgres 16), `minio` (S3-uyumlu obje depolama) container'larını ayağa kaldırır.
   **Yerel bir e-posta yakalayıcı (mailpit vb.) yoktur** — giden e-posta hiçbir yerde
   görüntülenmez, bkz. aşağıdaki "Ortam değişkenleri" ve FOUND-ISSUES.md.
2. `minio-init` fotoğraf kovasını (`tutanak-photos`) bir kere oluşturur.
3. `api` container'ı sırasıyla `prisma migrate deploy` → `seed` (3 şablonu yazar,
   idempotent) → `nest start --watch` çalıştırır.
4. `web` container'ı `npm ci` + `vite dev --host` çalıştırır.

Ayağa kalkan adresler:

| Servis | Adres |
|---|---|
| Web (PWA) | http://localhost:5173 |
| API | http://localhost:3000/api/v1 |
| API sağlık kontrolü | http://localhost:3000/health |
| MinIO konsolu | http://localhost:9001 (`minioadmin` / `minioadmin`) |
| Postgres | localhost:5432 (`tutanak` / `tutanak`) |

Doğrulama:

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

`PAYMENT_PROVIDER=fake` varsayılan olduğu için ödeme akışı da gerçek iyzico hesabı
gerektirmeden çalışır.

## Yol 2 — Docker'sız

Kendi Postgres 16 sunucunuz olmalı (veya yalnızca `db` servisini `docker compose up db -d`
ile ayağa kaldırabilirsiniz).

```bash
cp .env.example .env
npm install                                          # postinstall: prisma generate
npm run migrate:deploy --workspace @tutanak/api       # migration uygula
npm run seed --workspace @tutanak/api                 # 3 sabit şablonu yaz
npm run start:dev --workspace @tutanak/api             # http://localhost:3000
npm run dev --workspace @tutanak/web                   # http://localhost:5173 (ayrı terminal)
```

Fotoğraf yükleme için `R2_ENDPOINT`'in gerçekten erişilebilir bir S3-uyumlu uç olması
gerekir (yerelde `docker compose up minio minio-init -d` ile MinIO'yu ayrıca ayağa
kaldırabilirsiniz); aksi halde fotoğraf yükleme `502 STORAGE_UNAVAILABLE` ile başarısız
olur.

## Veritabanı (Prisma)

Şema: `apps/api/prisma/schema.prisma` (mimarideki `data-model.sql` ile birebir uyumlu).
Migration'lar: `apps/api/prisma/migrations/`.

```bash
npm run prisma:generate --workspace @tutanak/api   # istemciyi üret (npm install sonrası otomatik)
npm run migrate:deploy --workspace @tutanak/api    # migration'ları uygula
npm run seed --workspace @tutanak/api              # 3 sabit şablonu yaz (idempotent)
npm run migrate:down --workspace @tutanak/api      # geri alma (tüm tablo/tip/fonksiyonları kaldırır)
```

Doğrulanmış çıktı (`migrate:deploy`, boş DB'de):

```
1 migration found in prisma/migrations
Applying migration `20260812000000_init`
All migrations have been successfully applied.
```

`seed` çıktısı: `3 sablon seed edildi.`

## Ortam değişkenleri

`.env.example` deki tüm anahtarlar (kod bunlardan başkasını okumaz —
`apps/api/src/config/env.schema.ts` beyaz listedir; şemada olmayan bir anahtar eklemek
hiçbir etki yaratmaz).

### Sırlar

| Anahtar | Açıklama | Yerel varsayılan |
|---|---|---|
| `DATABASE_URL` | Postgres bağlantı adresi | `postgresql://tutanak:tutanak@localhost:5432/tutanak` |
| `JWT_SECRET` | JWT imzalama anahtarı (min. 16 karakter) | örnek değer verilir, **üretimde değiştirin** |
| `R2_ENDPOINT` | Obje depolama adresi (üretim: Cloudflare R2, yerel: MinIO) | `http://localhost:9000` |
| `R2_BUCKET` | Fotoğraf kovası adı | `tutanak-photos` |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | Obje depolama kimlik bilgisi | `minioadmin` / `minioadmin` |
| `RESEND_API_KEY` | İşlemsel e-posta sağlayıcı anahtarı | **boş bırakılabilir** — uygulama yine açılır, gönderim `202 + status: failed` döner |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` / `IYZICO_WEBHOOK_SECRET` | Ödeme sağlayıcı sırları | yalnızca `PAYMENT_PROVIDER=iyzico` iken zorunlu |

### Sır olmayan yapılandırma

| Anahtar | Açıklama | Varsayılan |
|---|---|---|
| `JWT_EXPIRES_IN` | Erişim tokeni ömrü | `7d` |
| `SUBSCRIPTION_PRICE_AMOUNT` | Abonelik tutarı (ondalıklı **string**, `\d+\.\d{2}` biçiminde) | `199.00` |
| `SUBSCRIPTION_CURRENCY` | Para birimi (3 karakter) | `TRY` |
| `SUBSCRIPTION_PERIOD_DAYS` | Abonelik dönem uzunluğu (gün) | `30` |
| `EMAIL_FROM` | Paylaşım e-postasının gönderen adresi (`ad@alan` veya `Ad <ad@alan>`) | `Tutanak <noreply@localhost>` |
| `PAYMENT_PROVIDER` | `iyzico` \| `fake` — **zorunludur, varsayılanı yoktur**; eksikse uygulama açılmaz. `NODE_ENV=production` iken `fake` **reddedilir** (üretim imajında sahte sağlayıcıyla ücretsiz abonelik açılmasını önlemek için) | `.env.example`'da `fake` yazılıdır (yerel/test için) |
| `PHOTO_MAX_BYTES` | Fotoğraf boyut üst sınırı (bayt) | `10485760` (10 MB) |
| `PHOTO_MAX_PER_REPORT` | Tutanak başına fotoğraf üst sınırı | `30` |
| `PRESIGNED_URL_TTL_SECONDS` | Fotoğraf ön-imzalı okuma URL ömrü (saniye) | `900` |
| `R2_PUBLIC_ENDPOINT` | Ön-imzalı URL'nin tarayıcıya dönen adresi; boşsa `R2_ENDPOINT` kullanılır | `http://localhost:9000` |
| `PUBLIC_APP_URL` | Paylaşım linkinin ve `wa.me` metninin tabanı | `http://localhost:5173` |
| `RATE_LIMIT_WINDOW_SECONDS` | Genel hız sınırı penceresi (saniye) | `60` |
| `RATE_LIMIT_MAX_REQUESTS` | Pencere başına genel istek üst sınırı | `300` |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | `/auth/register`, `/auth/login` için sıkılaştırılmış üst sınır | `5` |
| `VITE_API_PROXY_TARGET` | (yalnızca web geliştirme aracı) Vite dev sunucusunun `/api` isteklerini taşıdığı hedef | `http://localhost:3000` |

`PUBLIC_APP_URL` ile fotoğrafları telefondan (LAN üzerinden) test etmek isterseniz
`.env`'de `R2_PUBLIC_ENDPOINT`'i makinenizin LAN IP'sine çevirin (`http://192.168.1.x:9000`);
aksi halde telefon tarayıcısı `docker` ağındaki adları çözemez.

**Not — `NODE_ENV`:** `.env.example`'da anahtar olarak **yer almaz** (bilinçli). Üretim
imajı `NODE_ENV=production` taşır; `.env`'e yazılan bir değer bunu ezip
`PAYMENT_PROVIDER=fake` korumasını sessizce devre dışı bırakırdı. Yerel/test'te
tanımsız kalır ve varsayılan (`development`) kullanılır — bu, `PAYMENT_PROVIDER=fake`'in
yerelde neden serbestçe çalıştığını açıklar.

## Testleri çalıştırma

```bash
npm run test        # tüm workspace'lerin birim testleri (kapsam eşikleri dahil)
npm run test:e2e    # HTTP seviyesi entegrasyon testleri (supertest + gerçek Postgres)
```

Doğrulanmış sonuç (bu revizyon, `main` = `5f86403`, H-001..H-004 dahil): `npm run test` →
kök çalışma alanı 3 iş parçasını sırayla çalıştırır (kök `tools/` **11 suite/74 test**,
`@tutanak/api` **56 suite/386 test**, `@tutanak/web` **57 suite/448 test**) — toplam
**124 test suite, 908 test, hepsi geçti**. (Yalnızca son workspace'in özetine bakarsanız
57/448 görürsünüz; bu **toplam değil**, yalnızca `@tutanak/web`'e aittir.) Bu revizyonda
sayılar önceki T-028 revizyonuna göre (121 suite/853 test) şu ticket'larla büyüdü:
`tools/pdf-font-asset.spec.ts` (H-001, font varlığının hem `build` hem `start:dev`
yoluyla `dist`'e taşındığını kilitler), `apps/web/src/styles/app-layout.spec.ts`
(H-004, 26 test — masaüstü kapsayıcı/buton/panel CSS sözleşmesi), ve H-002/H-003'ün
mevcut spec dosyalarına eklediği yeni assertion'lar (Türkçe metin doğrulaması, yoklama
davranışı) — bunlar dosya sayısını değil, var olan dosyaların test sayısını artırdı.

`npm run test:e2e` → **13 test suite, 202 test, hepsi geçti** (`docker compose up db -d`
ile ayakta bir Postgres'e karşı, yalnızca `@tutanak/api`'de tanımlıdır; T-028'e göre +2
test — H-001'in PDF Türkçe metin e2e testi).

`test:e2e` gerçek bir Postgres ister (`DATABASE_URL`); migration testi kendi izole
veritabanını oluşturup sonunda düşürür, geliştirme veritabanına dokunmaz.

Uygulama açılışta ortam değişkenlerini doğrular (eksik sır/ayar varsa açılmaz), ama
**`.env` dosyasını kabuğa yüklemeniz gerekmez**: her e2e spec'i uygulamayı ayağa
kaldırmadan önce kendi zorunlu ortam değişkenlerini (`JWT_SECRET`,
`SUBSCRIPTION_PRICE_AMOUNT`, `PUBLIC_APP_URL`, `EMAIL_FROM`, `R2_*`, `PAYMENT_PROVIDER`
vb.) kendi `beforeAll`'ı içinde ayarlar. Dışarıdan verilmesi gereken tek değer
`DATABASE_URL`'dir (CI de yalnızca bunu tanımlar, `.github/workflows/ci.yml`):

```bash
DATABASE_URL='postgresql://tutanak:tutanak@localhost:5432/tutanak' npm run test:e2e
```

Doğrulandı: temiz bir kabukta (kabuğa `.env` yüklenmeden), yalnızca yukarıdaki
`DATABASE_URL` tanımlıyken `npm run test:e2e` sıfır hatayla geçer.

Tek bir workspace'i koşmak için:

```bash
npm run test --workspace @tutanak/api
npm run test --workspace @tutanak/web
```

## Kalite ve build komutları

```bash
npm run lint          # ESLint (uyarı sayısı 0 ile geçer)
npm run format:check  # Prettier biçim kontrolü
npm run typecheck     # tsc --noEmit (tüm workspace'ler)
npm run build         # apps/api (tsc) + apps/web (vite build)
npm run verify:pwa    # build çıktısında manifest + service worker doğrulaması
```

Tüm bu komutlar bu dokümanı yazarken çalıştırılıp doğrulandı (temiz çıktı, sıfır hata).

## Sık kurulum hataları ve çözümleri

### 1. `npm run test:e2e` çalıştırmak için `.env`'i kabuğa yüklemeye ÇALIŞMAYIN

Eskiden önerilen `set -a && . ./.env && set +a` deseni bu depoda **çalışmaz** çünkü
`EMAIL_FROM=Tutanak <noreply@localhost>` satırındaki tırnaksız `<...>` içeriği hem
`bash` hem `zsh`'de dosya yönlendirmesi (`<`, `>`) olarak yorumlanır ve `parse error
near \`\n'` ile patlar. Doğru ve gerekli olan çözüm bu deseni **hiç kullanmamaktır**:
her e2e test dosyası kendi zorunlu ortam değişkenlerini kendi `beforeAll`'ı içinde
ayarlar; kabuğa `.env` yüklemenize gerek yoktur, yalnızca `DATABASE_URL` dışarıdan
verilmelidir (yukarıdaki "Testleri çalıştırma" bölümüne bakın).

### 2. Fotoğraf yükleme `502 STORAGE_UNAVAILABLE` döner

MinIO ayakta değil veya `tutanak-photos` kovası oluşmamış. `docker compose up` yolunda
`minio-init` servisi bunu otomatik yapar; Docker'sız çalışıyorsanız MinIO'yu ayrıca ayağa
kaldırın: `docker compose up minio minio-init -d`.

### 3. Paylaşım e-postası her zaman `status: failed` dönüyor

Bu bir hata değildir — `RESEND_API_KEY` boşken beklenen davranıştır (bkz. README "Bilinen
Sınırlamalar"). Paylaşım linki yine de geçerlidir; WhatsApp veya "Kopyala" ile devam
edilebilir. Gerçek gönderim test etmek isterseniz `.env`'e gerçek bir `RESEND_API_KEY`
girin.

### 4. `npm run lint` / `test` kök dizinde `husky`/`prepare` adımında takılıyor

`.husky/pre-commit` repoda yok (bilinen sınırlama); `npm install` sırasındaki
`prepare: "husky || true"` script'i husky kurulu olmasa bile hatasız devam eder — bu bir
hata değildir, `|| true` bilinçlidir.

### 5. `docker compose up` sonrası API `depends_on` nedeniyle DB'ye bağlanamıyor

`db` servisi `healthcheck` (`pg_isready`) geçene kadar `api` başlamaz
(`depends_on: db: condition: service_healthy`); ilk açılışta 10-15 saniye normal
gecikmedir, log'da `Applying migration` satırını bekleyin.

### 6. Portlar zaten kullanımda (`5432`, `9000`, `3000`, `5173` vb.)

Aynı makinede başka bir `tutanak-app` (veya başka bir proje) container'ı çalışıyor
olabilir: `docker ps` ile kontrol edin, çakışan container'ı durdurun veya farklı bir proje
adıyla (`docker compose -p tutanak-app-2 up`) çalıştırın.

## PWA doğrulaması

- Manifest: `apps/web/public/manifest.webmanifest`, `index.html` içinde
  `<link rel="manifest">` ile bağlanır.
- Service worker yalnızca **production build çıktısında** aktiftir
  (`npm run build && npm run preview --workspace @tutanak/web`); dev sunucusunda
  (`npm run dev`) service worker kayıt olmaz.
- Tarayıcıda doğrulama: DevTools → Application → Service Workers → `sw.js`
  "activated and is running".

## Sürekli Entegrasyon (CI)

`.github/workflows/ci.yml`, her `push`/`pull_request`'te sırasıyla çalışır:
`prisma:generate` → `format:check` → `lint` → `typecheck` → `prisma:validate` →
şema-migration sapma kontrolü → `migrate:deploy` → `seed` → `test` → `test:e2e` →
`build` → `verify:pwa` → `npm audit`. Migration adımları iş içinde ayağa kalkan
`postgres:16-alpine` servisine karşı çalışır.
