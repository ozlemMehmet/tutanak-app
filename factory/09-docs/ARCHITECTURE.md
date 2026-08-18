# ARCHITECTURE.md — Gerçekleşen Mimari

Bu doküman `main` branch'teki gerçek kod (`apps/api/src`, `apps/web/src`) taranarak ve
uygulama canlı çalıştırılarak yazıldı (bu revizyon: commit `5f86403`, T-028 + H-001..
H-004 dahil). Planlanan mimari için `factory/04-architecture/architecture.md` ve
`CLAUDE.md`'ye bakın; burada yalnızca **gerçekleşmiş** olan ve **plandan sapmalar**
anlatılır.

## 1. Bileşenler (bir bakışta)

```
İstemci (tarayıcı)
   │
   ├─ apps/web  — React 19 + Vite 6 SPA (PWA: Workbox service worker, manifest)
   │              npm workspace: @tutanak/web
   │
   └── HTTP ────────────────────────────────────────────────────►
                                                                   │
                                    apps/api — NestJS 11 (Node 22, TS strict)
                                    npm workspace: @tutanak/api
                                    │
                                    ├─ modules/  (HTTP + iş mantığı, 9 modül)
                                    │   auth · users · templates · reports · photos
                                    │   · pdf · sharing · approvals · billing
                                    │
                                    ├─ infra/    (dış sistem adaptörleri, port arkasında)
                                    │   prisma (Postgres) · storage (R2/MinIO)
                                    │   · email (Resend) · payment (iyzico/fake)
                                    │
                                    └─ common/   (guard, filter, pipe, hata sınıfları, decorator)
                                    │
                                    ▼
                          PostgreSQL 16  ◄── Prisma 6 (migration + client)
                          Cloudflare R2 / MinIO (fotoğraf objeleri)
                          Resend API (işlemsel e-posta — yalnızca üretimde gerçek gönderim)
                          iyzico API (abonelik ödemesi, PAYMENT_PROVIDER=iyzico iken)
```

Tek repo, npm workspaces (`apps/*`); paylaşılan bir `packages/*` yoktur. İki uygulama
arasındaki sözleşme `factory/04-architecture/api-contract.yaml`dır; web tarafı tipleri
`npm run gen:api-types` (`openapi-typescript`) ile bu dosyadan üretir
(`apps/web/src/api/schema.d.ts`).

## 2. Backend — modül envanteri (`apps/api/src/modules/`)

| Modül | Sorumluluk | Öne çıkan dosyalar |
|---|---|---|
| `health` | Konteyner sağlık kontrolü (`/health`, sözleşme dışı) | `health.controller.ts` |
| `auth` | Kayıt, giriş, JWT üretimi, sabit-zamanlı doğrulama | `auth.service.ts`, `jwt.strategy.ts` |
| `users` | `GET /me` (profil + abonelik özeti) | `users.controller.ts` |
| `templates` | 3 sabit şablonun listelenmesi/getirilmesi | `templates.service.ts` |
| `reports` | Taslak oluşturma, listeleme/arama, PDF tetikleme | `reports.service.ts`, `reports.repository.ts` |
| `photos` | Fotoğraf yükleme (boyut/format/limit doğrulama), listeleme | `photo-upload-limit.interceptor.ts`, `photo-format.validator.ts`, `photo-image.processor.ts` |
| `pdf` | PDFKit ile belge üretimi (fotoğraf + damga + onay bloğu), gömülü DejaVu Sans/Bold Unicode fontuyla Türkçe render (H-001) | `report-pdf.builder.ts`, `pdf-photo.processor.ts`, `fonts/` |
| `sharing` | Paylaşım linki üretimi/idempotansı, e-posta gönderimi, genel görüntüleme | `share-link.service.ts`, `public-report.controller.ts`, `whatsapp-link.builder.ts` |
| `approvals` | Token ile tek tıkla onay, mükerrer onay engeli | `approvals.service.ts` |
| `billing` | Checkout başlatma, webhook işleme, abonelik yaşam döngüsü | `billing.service.ts`, `billing.controller.ts` |

Ortak katman (`common/`): `AllExceptionsFilter` (tek tip hata zarfı), `JwtAuthGuard`
(varsayılan kapalı, `@Public()` ile açılır), `ValidationPipeFactory`
(`whitelist + forbidNonWhitelisted + transform`), rate-limit factory
(`@nestjs/throttler` üzerine bellek içi sayaç).

Dış sistemler `infra/` altında **port + adapter** deseniyle bağlanır — servisler
(`modules/`) somut SDK'ları hiç bilmez, yalnızca `StoragePort` / `EmailPort` /
`PaymentPort` arayüzlerini görür. Bu, testte ve yerelde sahte adaptörlerle
(`FakeStorageAdapter`, `FakeEmailAdapter`, `FakePaymentAdapter`) çalışmayı sağlar.

## 3. Frontend — yapı (`apps/web/src/`)

```
api/        ApiClient (fetch sarmalayıcı), access-token saklama, schema.d.ts (üretilmiş tipler)
components/ AppShell (üst bar + gezinme), RequireAuth (route guard), Pagination, InlineFieldError
features/   auth, reports, photos, sharing, approvals, billing — her biri kendi
            API çağrısı (*.api.ts) + TanStack Query hook'u (use*.ts) + sunum bileşeni
pages/      LoginPage, RegisterPage, ReportListPage, ReportCreatePage, ReportDetailPage,
            PublicReportPage, SubscriptionPage
pwa/        service worker kaydı (Workbox, yalnızca production build'de aktif)
router.tsx  rota haritası (aşağıda)
```

Rota haritası (gerçek, `router.tsx`):

| Yol | Auth | Sayfa |
|---|---|---|
| `/` | — | `/reports`'a yönlendirir |
| `/login`, `/register` | Hayır | `LoginPage`, `RegisterPage` |
| `/t/:token` | Hayır (public) | `PublicReportPage` — kiracının hesapsız eriştiği ekran, `AppShell` **yok** |
| `/reports` | Evet | `ReportListPage` |
| `/reports/new` | Evet | `ReportCreatePage` |
| `/reports/:reportId` | Evet | `ReportDetailPage` |
| `/subscription` | Evet | `SubscriptionPage` |

Sayfalar veri çekmeyi/yazmayı hiç kendisi yapmaz; TanStack Query hook'larına devreder
(`useReports`, `useCreateReport`, `usePhotos`, `useShareLink`, `useStartCheckout` vb.) —
bu ayrım kod tabanında tutarlı biçimde uygulanmış (39 web test dosyası, ayrı ayrı
doğrulanmış).

## 4. Veri akışı — örnek senaryolar

**Tutanak oluşturma → fotoğraf → PDF:**
`POST /reports` (taslak, `status=draft`) → **tarayıcıda** `downscalePhotoForUpload`
(T-028: `createImageBitmap` + `<canvas>`, EXIF yönü piksellere uygulanır, uzun kenar
> 1600 px ise küçültülür, herhangi bir adım başarısız olursa sessizce orijinal dosyaya
düşülür) → `POST /reports/{id}/photos` (her yüklemede sunucuda **ayrıca** Sharp ile EXIF
yönlendirmesi uygulanıp yeniden kodlanır, uzun kenar 1600 px'i aşıyorsa oranı korunarak
küçültülür (`withoutEnlargement`, T-026 — bkz. API.md "photos"), R2/MinIO'ya yazma, DB
satırı **yalnızca** depolama yazımı başarılıysa oluşur — yetim kayıt yok) →
`GET /reports/{id}/pdf` (PDFKit senkron üretir, R2'den zaten küçültülmüş fotoğrafları
okuyup gömer, `application/pdf` olarak tek parça döner).

**Paylaşım → onay:**
`POST /reports/{id}/share-link` (`status: draft→shared`, 32 bayt rastgele token) →
kullanıcı linki WhatsApp/e-posta/kopyala ile iletir → kiracı `GET /public/reports/{token}`
ile içeriği görür → `POST /public/reports/{token}/approval` (`status: shared→approved`,
DB unique kısıtı mükerrer onayı engeller) → tutanak içeriği (fotoğraf ekleme) donar.

**Abonelik:**
`POST /billing/checkout` (get-or-create `subscriptions` satırı, `status=pending`) →
kullanıcı sağlayıcıda öder → sağlayıcı `POST /billing/webhook` çağırır (imza doğrulanır,
`processed_at IS NULL` koşullu `UPDATE` ile idempotan işlenir) → `status=active`,
`current_period_end = now() + SUBSCRIPTION_PERIOD_DAYS`.

## 5. Dış bağımlılıklar ve yerel karşılıkları

| Bağımlılık | Üretim | Yerel/test |
|---|---|---|
| Obje depolama | Cloudflare R2 (S3 API) | MinIO (`docker-compose.yml`), `FakeStorageAdapter` (birim test) |
| E-posta | Resend (HTTPS API) | Yerel karşılık **yok** — gerçek Resend API'sine gidiyor, anahtar boşsa `202 + status:"failed"` (bkz. §7) |
| Ödeme | iyzico | `PAYMENT_PROVIDER=fake` → `FakePaymentAdapter` (dış çağrı yok); **üretimde (`NODE_ENV=production`) `fake` reddedilir**, uygulama açılmaz |
| Reverse proxy / TLS | Caddy (`apps/web/Dockerfile` içine gömülü Caddyfile) | Yerelde yok; `docker compose` doğrudan portları yayınlar |

## 6. Dağıtım (gerçekleşen, yerel doğrulama)

`docker-compose.yml`, **dört** servis tanımlar: `db` (Postgres 16, healthcheck ile),
`minio` + `minio-init` (kova otomatik oluşturma), `api` (`target: dev`, açılışta
`migrate:deploy && seed && start:dev` çalıştırır), `web` (`npm ci && vite dev --host`).
Yerelde giden e-postayı yakalayan bir servis **yoktur** (bkz. §7.1).

Üretim dağıtım hedefi (tek VPS + Caddy) planın ötesine geçip **gerçekleşmiştir**:
`apps/web/Dockerfile`, statik SPA build çıktısını (`vite build`) Caddy imajına kopyalar
ve imaja gömülü bir Caddyfile içerir — bu Caddyfile `/api/*` ve `/health`'i `api`
container'ına ters vekiller, kalan her yolu SPA fallback'i olarak sunar ve statik
yanıtlara `Content-Security-Policy`, `Strict-Transport-Security`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` başlıklarını ekler
(T-024, güvenlik denetimi S-02 bulgusu).

`apps/api/Dockerfile` artık **çok aşamalı**dır: `deps` (bağımlılık katmanı, önbelleklenir)
→ `dev` (`docker-compose.yml`'nin bind-mount + watch ile kullandığı hedef, T-001'den
beri) → `build` (`tsc` derlemesi) → `runtime` (üretim imajı, `CMD` içinde
`migrate:deploy && seed && node dist/main.js`, `HEALTHCHECK` ile `/health` sorgular).
`docker compose up` (yerel) `target: dev`'i **açıkça** seçer; bu belirtilmeseydi
varsayılan (son) aşama olan `runtime` derlenirdi ve bind-mount + watch komutu
devDependencies'siz bir imajda çalışmazdı.

**CI/CD pipeline'ı depoda mevcuttur** (`.github/workflows/ci.yml` + `cd.yml`):
`ci.yml` her `push`/`pull_request`'te lint/typecheck/migrate/test/build/`npm audit`
çalıştırır (bkz. SETUP.md "Sürekli Entegrasyon"); `cd.yml`, `ci.yml`'nin `main` üzerinde
**başarıyla bittiği** `workflow_run` olayında tetiklenir (doğrudan `push` tetikleyicisi
kullanılmaz — "test edilen imaj = deploy edilen imaj" ilkesi) ve `apps/api/Dockerfile`
(`runtime` hedefi) + `apps/web/Dockerfile` imajlarını derleyip `ghcr.io/<owner>/<repo>-api`
ve `-web` olarak GHCR'a yayınlar. Tetikleyen çalışmanın **bu depodan** ve bir `push`
olayından geldiği ayrıca doğrulanır (`head_repository.full_name == github.repository &&
event == 'push'`) — bu kontrol, bir fork PR'ının onaylanmasıyla saldırganın kendi
Dockerfile'ıyla derlenmiş bir imajın GHCR'a yayınlanmasını önlemek için sonradan eklendi
(güvenlik denetimi S-13, HIGH — bkz. §7.13). Sunucuya asıl kurulum/dağıtım adımları
(VPS provizyonu, `docker compose pull && up -d`, `pg_dump` yedekleme betiği) bu
depodaki koda dahil değildir; ayrı bir işletme dokümanı olarak
`factory/10-release/runbook.md`'de tutulur (bu doküman setinin kapsamı **yalnızca**
uygulama kodu ve CI/CD tanımlarıdır, sunucu işletimi değil).

## 7. Plandan sapmalar

Aşağıdaki liste, `factory/04-architecture/*` planı ile gerçek koddaki (`main`) davranış
arasındaki farkları, geliştirici devlog'larından (`factory/05-dev/T-*-devlog.md` ve
teslim-sonrası hotfix'ler için `factory/05-dev/H-*-devlog.md`) derlenmiş olarak listeler.
Kapsam ve merdiven kararları (cache yok, kuyruk yok, tek instance) **sapmadan** —
planlandığı gibi uygulanmıştır.

### 7.1 E-posta: yerelde hiçbir SMTP yakalayıcı yok, gönderim her zaman `failed` döner
`architecture.md` yerel karşılık olarak "Mailpit container" öngörüyordu ve
`docker-compose.yml` bir süre bir `mailpit` servisi çalıştırdı; ancak e-posta gönderim
katmanı Resend'in **HTTPS API** istemcisini kullanır (SMTP değil), bu yüzden yerel
e-postalar mailpit'e hiçbir zaman düşmedi. T-023 kapsamında bu çelişki **mailpit
servisi tamamen kaldırılarak** çözüldü (`docker-compose.yml`'de artık mailpit **yoktur**,
doğrulandı: `docker compose config --services` → `db, minio, api, minio-init, web`).
Güncel davranış: `RESEND_API_KEY` boşken (yerel varsayılan) her gönderim denemesi gerçek
Resend sunucusunda reddedilir ve `202 + status: "failed"` olarak yanıta yansır — akış
kırılmaz (paylaşım linki geçerli kalır), ama giden e-posta yerelde **hiçbir arayüzde
görüntülenemez**. *(Kaynak: T-008 devlog "Anayasa Boşlukları"; T-023 devlog — mailpit
kaldırma kararı.)*

### 7.2 Hız sınırlama: kimlik doğrulama uçlarında IP başına, kullanıcı başına değil
`architecture.md` §7 "kimlikli uçlarda kullanıcı başına, kimliksiz uçlarda IP başına"
sayım tanımlar. Gerçekte `@nestjs/throttler` `JwtAuthGuard`'dan **önce** çalıştığı için
sayım anında `req.user` henüz yoktur; `/auth/*` dahil **tüm** uçlarda sayaç IP bazlıdır.
Bu, T-014 kapsamında bilinçli bırakılmış bir sınırlamadır (kullanıcı bazlı sayım için
ikinci bir named throttler gerekir). *(Kaynak: T-014 devlog.)*

T-024 (güvenlik denetimi S-01) bu mekanizmayı **düzeltti, kaldırmadı**: T-014'te
`express`'in `trust proxy` ayarı yapılmadığı için tüm istemciler tek bir sayaç
paylaşıyordu (biri limiti doldurunca herkes 429 alıyordu) ve istemcinin gönderdiği
`X-Forwarded-For` başlığı sayaç anahtarını etkileyebiliyordu (taklit edilebilir).
`main.ts`'te `trust proxy = 1` (yalnızca tek güvenilir vekil sekmesi, Caddy) ve özel
`ClientIpThrottlerGuard` (`req.ip`'i sabitler, istemcinin uydurduğu zincirin ilk
halkasını kullanmaz) ile her istemci artık **kendi** sayacını tüketir. Sayım hâlâ
IP başınadır (kullanıcı başına değil) — bu, düzeltilen davranış değil. *(Kaynak: T-024
devlog.)*

### 7.3 Husky pre-commit hook'u hiç kurulmadı
`package.json`'da `prepare: "husky || true"` ve `lint-staged` yapılandırması hazır olsa
da `.husky/pre-commit` dosyası repoda **yoktur** (doğrulandı: `git show
origin/main:.husky/pre-commit` → *does not exist*). Bu T-001'den beri devlog'larda
"bilinen sınırlama" olarak işaretli kalmış, hiçbir sonraki ticket'ta kapatılmamıştır.
Sonuç: yerel commit'lerde otomatik lint/format çalışmaz; disiplin yalnızca CI'da
zorlanır.

### 7.4 Rate limit / abonelik / fotoğraf üst sınırı yapılandırma anahtarları plana sonradan eklendi
`architecture.md`'nin ilk sürümünde tanımsız olan üç ortam değişkeni
(`RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_MAX_REQUESTS`)
T-014 kapsamında koda eklendi ve `.env.example`'a yazıldı; devlog bunu mimari
dokümanının (`§5.1` tablosu) güncellenmesi gereken bir boşluk olarak işaretledi.
Kod bu üç anahtarı **kullanır ve doğrular** (`env.schema.ts`) — sapma yalnızca plan
dokümanının senkron kalmamasıdır.

### 7.5 Frontend fotoğraf üst sınırı istemciye ayrı bir yoldan geçmiyor
Sunucudaki `PHOTO_MAX_PER_REPORT` (varsayılan 30) için istemciye özel bir yapılandırma
kanalı (`VITE_*` anahtarı veya sözleşme alanı) planlanmamıştı. Web tarafı, sözleşmede
zaten sabit olan `30` değerini `features/photos/photo-limits.ts` içinde **ayrıca sabit**
olarak tutar (proaktif UI kapatma için); sunucudaki `409 PHOTO_LIMIT_REACHED` savunma
katmanı olarak korunur. İki değer şu an aynıdır ama tek kaynaktan gelmez — sunucu
değeri değiştirilirse istemci sabiti elle güncellenmelidir. *(Kaynak: T-020 devlog.)*

### 7.6 [ÇÖZÜLDÜ — H-001] PDF'te Türkçe'ye özgü harfler artık doğru render ediliyor
PDFKit'in standart WinAnsi kodlaması `ş, ğ, ı, İ` gibi Türkçe'ye özgü karakterleri
taşımıyordu; kullanıcı başlık/nota bu harfleri yazınca PDF'te yanlış glif çıkıyordu
(T-007'den beri "kapsam dışı" bırakılmış, kullanıcı tarafından bulunup **B-001** olarak
raporlanmış bir kusurdu). **H-001** bunu düzeltti: `apps/api/src/modules/pdf/fonts/`
altına DejaVu Sans + DejaVu Sans-Bold (2.37, Bitstream Vera + Arev lisansı, serbestçe
gömülebilir) commit edildi, `report-pdf.builder.ts` artık bu fontları `registerFont` ile
kaydedip kullanıyor; başlık/gövde/onay bloğu Türkçe karakterleri bozulmadan taşıyor
(doğrulandı — bkz. API.md "GET /reports/{reportId}/pdf"). İki ayrı derleme/çalışma
zamanı yolu senkron tutulmalı: üretim `build` script'i (`apps/api/scripts/copy-pdf-
fonts.mjs`) ve yerel `start:dev`/`docker compose` watch yolu (`apps/api/nest-cli.json`
`assets` kuralı) — ikisi de `tools/pdf-font-asset.spec.ts` ile ayrı ayrı kilitli
(font'un yalnızca `build`'e eklenip `nest-cli.json` eklenmemesi, önceki turda gerçek bir
kırılmaya yol açmıştı: API açılışta `ENOENT` ile düşüyordu). Punto/marj/düzen
sabitlerine dokunulmadı, yalnızca font ailesi değişti. *(Kaynak: T-007 devlog; B-001;
H-001 devlog.)*

### 7.7 Abonelik durumu erişimi kısıtlamaz
Planda da açıkça "paywall kapsam dışı" denmişti (T-012); gerçek kodda da hiçbir
endpoint abonelik durumuna bakarak erişimi reddetmez — bu bir sapma değil, kasıtlı
kapsam dışı bırakmanın teyididir, ama README/USER-GUIDE'da kullanıcıyı şaşırtmamak için
ayrıca not edildi.

### 7.8 T-024: güvenlik denetimi sonrası plana eklenen üç sertleştirme
Bir SonarCloud/güvenlik denetimi raporunun (S-01, S-02, S-03 bulguları) sonucunda,
planın orijinal sürümünde bulunmayan üç davranış koda eklendi:

1. **`PAYMENT_PROVIDER` artık varsayılansız ve zorunlu** (§5.1 tablosu eskiden `fake`
   varsayılanı öngörüyordu); tanımsızken uygulama **açılmaz**. Ayrıca
   `NODE_ENV=production` iken `fake` **reddedilir** — sahte sağlayıcı webhook imzasını
   yalnızca "başlık var mı" seviyesinde doğruladığı için, unutulan bir yapılandırma
   üretimde ücretsiz/sahte abonelik açılmasına izin verebilirdi.
2. **Üretim statik yanıtlarına güvenlik başlıkları eklendi** (§6'da detaylandırıldı):
   `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`,
   `Referrer-Policy`. Planda `localStorage`'daki erişim tokenini "katı CSP" ile telafi
   etme kararı vardı ama kodda hiçbir katmanda (ne API `helmet`, ne frontend) bu
   başlıklar yoktu; bu tur eksikliği kapattı.
3. **Hız sınırlama sayacı artık gerçekten istemci başına** (§7.2'de detaylandırıldı):
   `trust proxy` eksikliği ve istemci tarafından taklit edilebilir `X-Forwarded-For`
   güveni düzeltildi.

*(Kaynak: T-024 devlog.)*

### 7.9 T-025: giriş zamanlama yan kanalı kapatıldı (davranış değişmedi)
Var olmayan bir e-posta ile giriş denendiğinde, önceki kodda `bcrypt.compare` hiç
çağrılmıyordu (kullanıcı bulunamadı erken dönüyordu) — bu, T-015'te zaten sabit-zamanlı
karşılaştırma davranışıyla **giderilmişti** (her iki dalda da `compare` çağrılıyordu, bir
sabit `DUMMY_PASSWORD_HASH` literal'ine karşı). T-025, bu literal'in kod tabanında
**gerçek bir bcrypt hash'i olarak sabit yazılı durmasını** (statik analiz/güvenlik
bulgusu) kapattı: literal artık yok, `DUMMY_PASSWORD_HASH` açılışta rastgele bir girdiden
(`randomBytes(32)`) üretiliyor. Dışa dönük davranış **değişmedi** (T-015'in zamanlama
toleransı testleri değiştirilmeden geçiyor); bu bir güvenlik sertleştirmesi notudur,
kullanıcı/geliştirici deneyimini etkilemez. *(Kaynak: T-025 devlog.)*

### 7.10 Süreç notu: bu doküman seti birden çok revizyonda `main`'in ilerleyişini takip etti
**Bu revizyon (`5f86403`):** `main`, T-028'in üzerine dört teslim-sonrası hotfix ticket'ı
daha almış durumda — H-001 (PDF Türkçe font gömme, §7.6), H-002 (arayüz/API metinlerini
tam aksanlı Türkçe'ye çevirme, §7.15), H-003 (abonelik "bekleniyor" ekranına otomatik
yoklama + elle yenileme, §7.16), H-004 (masaüstü yerleşimi, §7.17). Bu dört ticket bir
kullanıcının canlı ürünü denemesiyle bulunan dört hataya (`factory/bugs/B-001..B-004.md`)
karşılık açıldı; **maintenance aşamasının kendi ajan koşucusu olmadığı için** triage ve
hotfix'ler control plane'in (pipeline.json) dışında, ayrı bir oturumda yürütüldü — bu
doküman seti H-001..H-004'ün `main`'e mergelenmiş hâlini (`5f86403`) yansıtır. Beşinci bir
bulgu (**B-005**, şablon adlarının hâlâ ASCII kalması) H-002 sonrası tespit edildi ve
**henüz düzeltilmedi** — bkz. §7.18.

Önceki entegrasyon turlarında (`factory/08-integration/e2e-report.md`) ve bu doküman
setinin ilk sürümlerinde tekrar tekrar karşılaşılan bir ortam bulgusu vardı: bu çalışma
alanındaki yerel `main` dalı zaman zaman `origin/main`'in gerisinde kalıyordu (ilk sürüm
`2cbfec8`/T-022 sonrasına göre yazılmıştı). Bu revizyonda yerel `main`, `origin/main` ile
**birebir aynı** (`374cce9`, T-028 dahil) — doğrulandı: `git rev-parse HEAD` ve
`git rev-parse origin/main` aynı SHA'yı döner. Bu revizyon, önceki turlarda güncellenmiş
T-023 (mailpit kaldırma), T-024 (S-01/S-02/S-03 güvenlik bulguları), T-025 (zamanlama yan
kanalı), T-026 (yükleme yolunda 1600 px küçültme + `UV_THREADPOOL_SIZE=8`), T-027
(imaj bağımlılık tedarik zinciri sertleştirmesi) değişikliklerinin üzerine, bu turda
ayrıca T-028 (fotoğraf küçültmesi istemciye taşındı, performans) yansıtılarak
güncellendi — bkz. §6, §7.12, §7.13, §7.14.

### 7.11 T-026: fotoğraf yükleme performansı — küçültme yalnızca PDF yolunda değil, yükleme yolunda da uygulanıyor
`architecture.md` §104, 1600 px küçültmeyi baştan karar olarak veriyordu, ama kod bunu
yalnızca PDF üretim yolunda uyguluyordu; yükleme yolu orijinal çözünürlüğü depoluyordu.
T-026 bunu tamamladı: küçültme artık **yükleme anında** (`photo-image.processor.ts`)
uygulanır, PDF yolu zaten küçültülmüş dosyayı okur. Ayrıca üretim imajına
(`apps/api/Dockerfile`) `UV_THREADPOOL_SIZE=8` eklendi (kodda okunmaz, yalnızca imaj
seviyesinde bir Node/libuv çalışma parametresidir, bu yüzden `.env.example`'da yer
almaz). Bu, plandan sapma değil, planın eksik uygulanan bir parçasının tamamlanmasıdır.
*(Kaynak: T-026 devlog.)*

### 7.12 T-027: üretim imajı bağımlılık kurulumu tedarik zinciri sertleştirmesi
`apps/api/Dockerfile` ve `apps/web/Dockerfile`, `npm ci` adımını artık `--ignore-scripts`
ile çalıştırır (SonarCloud bulgusu, PR #27): ele geçirilmiş bir bağımlılık, imaj
derlemesi sırasında kod çalıştıramaz. Planda bu konuda bir kural yoktu (CLAUDE.md §9
yalnızca `npm audit` kapısını tanımlıyordu); bu sertleştirme koda planın ötesinde,
denetim bulgusuna tepki olarak eklendi. Kapatmanın kırdığı üç adım `apps/api/Dockerfile`
içinde **açıkça** geri getirildi: `npm rebuild bcrypt sharp` (native modül ikilisi),
`node -e "require('bcrypt'); require('sharp')"` (fiili yüklenebilirlik kanıtı — asıl
kalkan budur, `npm rebuild` sessizce hiçbir şey yapmadan da başarılı dönebilir) ve
`npm run prisma:generate --workspace @tutanak/api` (eskiden `apps/api`'nin
`postinstall`'iydi; onsuz üretilmiş Prisma Client olmadığı için uygulama hiç açılmazdı).
`apps/web/Dockerfile`'da telafi adımı **gerekmedi** (native modül yok, esbuild ikilisi
`@esbuild/*` optionalDependencies ile gelir) — bu imajda `COPY apps/api/prisma/` satırı da
artık dayanaksız kaldığı için kaldırıldı. Bu değişiklik yalnızca imaj derleme adımını
etkiler; API'nin çalışma zamanı davranışı (bu dokümandaki hiçbir endpoint/hata kodu)
değişmedi — doğrulandı (bkz. API.md giriş notu). *(Kaynak: T-027 devlog, `tools/dependency-install-scripts.spec.ts`.)*

### 7.13 Release chore (PR #27): CD tedarik zinciri açığı kapatıldı, deploy varlıkları sürüm kontrolüne alındı
Planın "tek VPS + Caddy" hedefini tamamlayan release-prep çıktıları (çok aşamalı
`apps/api/Dockerfile`, üretim `docker-compose.yml` notları, `.github/workflows/cd.yml`,
`CHANGELOG.md`) daha önce yalnızca çalışma ağacında üretiliyor ve her turda kayboluyordu;
bu commit (`622be61`) onları depoya kalıcı olarak aldı. Aynı commit bir güvenlik açığını
kapattı (security-audit S-13, HIGH): `cd.yml`'nin `workflow_run` tetikleyicisi yalnızca dal
**adını** (`main`) süzüyordu, tetikleyen koşumun hangi **depodan** geldiğini
doğrulamıyordu — depo public olduğu için bir saldırgan fork PR'ı açıp bakımcıya "Approve
and run" dedirterek kendi Dockerfile'ıyla derlenmiş bir imajı GHCR'a yayınlatabilirdi.
Düzeltme koşula tetikleyen deponun kimliğini ve olay türünü ekledi:
`head_repository.full_name == github.repository && workflow_run.event == 'push'` (bkz.
§6). Bu, planın "CI/CD" bölümünün plandan sapması değil, planın önceden koda
yansımamış bir parçasının (release otomasyonu) bu turda tamamlanmasıdır. *(Kaynak: commit
`622be61` mesajı, `tools/ci-workflow.spec.ts`, `tools/docker-build-context.spec.ts`.)*

### 7.14 T-028: fotoğraf küçültme istemciye (PWA) taşındı — sunucu küçültmesi kaldırılmadı
`performance-report.md` (3. tur, P-01, CRITICAL) fotoğraf yükleme uç noktasının p95
bütçesini hedef eşzamanlılıkta hiçbir koşumda tutturamadığını gösterdi (kök neden:
sunucudaki `sharp` maliyeti gelen görselin çözülen piksel sayısıyla büyüyor, saha
fotoğrafları 5-6 MB/2400x3200 civarında). Planda (`architecture.md` §6 "Performans
Bütçeleri" yalnızca sunucu p95 hedefini tanımlar, istemci tarafı küçültme konusunda bir
karar yoktu; raporun **birinci** önerisi uygulandı: web istemcisi artık
`POST /reports/{id}/photos` isteği yapmadan **önce**, tarayıcıda
(`createImageBitmap` + `<canvas>`) uzun kenarı 1600 piksele küçültüyor
(`apps/web/src/features/photos/downscale-photo.ts` → `downscalePhotoForUpload`,
`useUploadPhoto` mutation'ı içinde çağrılır). **Sunucu tarafı küçültme (T-026)
kaldırılmadı** — ticket'in açık kriteriydi, `apps/api` altında bu ticket'ta tek satır
değişmedi (doğrulandı: `git diff --stat` T-027↔T-028 arası `apps/api` için boş).
İstemci küçültmesi bir doğruluk/güvenlik katmanı değildir: her hata yolunda (API yok,
desteklenmeyen biçim, EXIF yönünü uygulamayan tarayıcı, çözme/kodlama hatası) sessizce
orijinal dosyaya düşülür, akış kırılmaz. Gerçek Chrome ölçümü: 5.825.569 bayt/2400x3200
girdi → 1.192.733 bayt/1600x1200 çıktı (4,9x küçük, istemci tarafı süre 74 ms); üretim
imajlarıyla A/B yük testinde (c=30, n=60, 8 koşum) p95 1.719–30.147 ms → 560–687 ms,
hata oranı %1,67 → %0. Bilinen sınırlama: depolanan dosya artık iki kez kayıplı JPEG
kodlamasından geçiyor (istemci + sunucu), gözle görülür fark yok (~%1 daha küçük dosya,
±1/255 renk sapması) ama teorik olarak bir nesil daha kayıp taşıyor; ölçüm 10 çekirdekli
bir geliştirme makinesinde yapıldı, üretim hedefi (2 vCPU) için mutlak p95 bu ortamda
kanıtlanamaz (oransal kazanç donanımdan bağımsız kabul edildi). *(Kaynak: T-028 devlog,
`downscale-photo.spec.ts`, `performance-report.md` 3. tur.)*

### 7.15 H-002: kullanıcıya dönük tüm metinler ASCII'ye katlanmıştı, artık tam aksanlı Türkçe — seed verisi hariç
Teslim sonrası kullanıcı bulgusu **B-002**: uygulamanın kullanıcıya (ve kiracıya, ödeme
sayfasındaki müşteriye) gösterdiği metinlerin tamamı Türkçe'ye özgü harfleri
(`ş ğ ı ö ü ç` ve büyükleri) taşımıyordu — hata mesajları, doğrulama mesajları, PDF
sabit etiketleri, e-posta konusu/gövdesi, WhatsApp ön-metni, ödeme sayfası sepet kalemi
adı. **H-002** kaynak kodun tamamını (spec dosyaları hariç `apps/web/src` 63 dosyanın
22'si, `apps/api/src` 99 dosyanın 31'i) tek tek tarayıp düzeltti; i18n katmanı
**eklenmedi** (CLAUDE.md §11 çoklu dili v2+ kapsamına koyuyor), düzeltme dizenin
bulunduğu yerde yapıldı. Anlam/durum kodları (`code` alanları, ekran durumları)
**değişmedi** — yalnızca yazım düzeltildi; istemci dallanmayı `code` ile yapar, metinle
değil. API.md'deki tüm hata/başarı örnekleri bu revizyonda yeniden koşulup güncel
(aksanlı) çıktıyla değiştirildi.

**Kapsam dışında kalan ve düzeltilmeyen tek yüzey — `apps/api/prisma/seed.ts`:** üç sabit
şablonun `name`/`description` alanları hâlâ ASCII'ye katlanmış Türkçe'dir (`Giris/Cikis
Teslim Tutanagi`). Bu, teslim sonrası ayrı bir açık bulgu olarak kayıtlıdır
(`factory/bugs/B-005.md`, henüz bir düzeltme ticket'ı açılmadı) ve `GET /templates` /
`GET /reports` gibi şablon adı döndüren her endpoint'te gözlemlenebilir — bkz. API.md
"templates" bölümü, README.md "Bilinen sınırlamalar". *(Kaynak: B-002, H-002 devlog,
B-005.)*

### 7.16 H-003: ödeme sonrası "bekleniyor" ekranı artık çıkmaz sokak değil — otomatik yoklama + elle yenileme eklendi
Teslim sonrası kullanıcı bulgusu **B-003** (triage S2): `POST /billing/checkout` sonrası
kullanıcı ödeme sağlayıcısında öder, sağlayıcı `POST /billing/webhook`'u **asenkron**
çağırır (saniyeler sonra); önceki kodda `SubscriptionPage`'in `GET /me` çağrısı yalnızca
**iki tetikleyicide bir kez** çalışıyordu (`?checkout=return` dönüşü, sekme
`visibilitychange`) — webhook bu tek çağrıdan sonra gelirse ekran kullanıcı hiçbir şey
yapmadan sonsuza dek "Ödeme sonucu bekleniyor" metninde kalıyordu; para tahsil edilmiş
olabilir ama arayüz bunu asla göstermiyordu. Planda (`architecture.md`) bu durum için
bir yoklama/zaman aşımı tanımı **yoktu**; `design.md` da yalnızca "bilgi metni + buton
gizli/disabled" öngörüyordu. **H-003** üç şey ekledi (`apps/web/src/features/billing/
useSubscriptionAutoRefresh.ts`, `SubscriptionPage.tsx`): (1) `pending` durumundayken
artan aralıklarla (3/5/8/12/15/20/25 sn, toplam 88 sn bütçe) otomatik `GET /me` yoklaması
— `active` olunca durur; (2) her zaman görünür/tıklanabilir bir **"Durumu yenile"**
butonu (yoklama bitse de kalır); (3) bütçe tükenince ekran metni "ödeme alındıysa/
alınmadıysa ne olacağını" söyleyen bir mesaja döner. Yoklama aralığı env'den değil kod
içi bir sabitten (`SUBSCRIPTION_POLL_DELAYS_MS`) okunur — web tarafı zamanlama
sabitleri için CLAUDE.md §5.1'de bir yapılandırma kanalı tanımlı değildi, bu bir tasarım
sözleşmesi boşluğu olarak devlog'da not edildi. Backend'e **dokunulmadı**: webhook hâlâ
tek doğruluk kaynağıdır, hâlâ asenkron gelir; bu bir istemci UX düzeltmesidir, sunucu
tarafında zaman aşımlı otomatik iptal mekanizması hâlâ yoktur (bkz. §7.7 ve README
"terk edilen ödeme süresiz `pending` kalır"). *(Kaynak: B-003, H-003 devlog.)*

### 7.17 H-004: masaüstü yerleşimi eklendi — plan/sartname bu ekranı hiç tanımlamıyordu
Teslim sonrası kullanıcı bulgusu **B-004** (triage S3): masaüstü tarayıcıda (1280×900)
içerik kenardan kenara yayılıyor, birincil butonlar viewport genişliğinde duruyor,
tutanak detayındaki "Fotoğraflar"/"Paylaşım" bölümleri kart/panel zemininde
durmuyordu. Kök neden bir uygulama hatası değildi — `design.md`'nin 7 ekran
sartnamesinin hiçbiri masaüstü yerleşimi tanımlamıyordu (yalnızca mobil notu vardı);
kod, sartnamenin yazdığını doğru uyguluyordu. **H-004** yalnızca `apps/web/src/styles/
app.css`'e CSS ekledi (markup'a dokunulmadı): `.page` kapsayıcısı `md` kırılma
noktasında (768px) sınırlanıp yatayda ortalanıyor, `md`+ genişlikte birincil butonlar
(`Ödeme Yap`/`Giriş Yap`/`Taslak Oluştur`) tam genişlikten çıkıp min 192px'te duruyor,
"Fotoğraflar"/"Paylaşım" panelleri `.report-card` ile aynı Elevation 1 gölgesini ve `lg`
yarıçapını alıyor. Mobil (<768px) davranış **değişmedi** (regresyon testleriyle
doğrulandı). Token setinde bir "kapsayıcı genişliği" ve "buton min-genişliği" adımı
yoktu; devlog bunu `ux-designer-agent`'a kalıcı sartname eksikliği olarak raporladı
(uygulanmadı, ayrı bir karar/ticket gerektirir). *(Kaynak: B-004, H-004 devlog.)*

### 7.18 Bilinen açık bulgu (henüz bir hotfix ticket'ı yok): şablon adları ASCII'ye katlanmış kaldı
`factory/bugs/B-005.md` — H-002 doğrulaması sırasında orkestratör tarafından tespit
edildi, **CONFIRMED**, henüz karşılığında bir H-00x ticket'ı açılmadı. Ayrıntı için
§7.15'e bakın; bu doküman setinde README.md "Bilinen sınırlamalar" ve API.md
"templates" bölümünde de tekrarlanmıştır.
