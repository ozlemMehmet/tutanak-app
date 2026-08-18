# DevOps Raporu — Tutanak (release-prep, 2. tur)

> Üretici: devops-agent | Tarih: 2026-08-18 | Kaynak durum: `main` @
> `5f86403848bef5c9555f28832913739c256fa47b` (T-001..T-028 [T-013 iptal, kapsamı T-003'e
> taşındı] + H-001, H-002, H-003, H-004)

## 0. Bu Oturumun Yaklaşımı

Bu, release-prep aşamasının **ikinci turu**. İlk tur (`factory/10-release/devops-report.md`'nin
önceki hâli, kaynak `374cce9` = T-028) GATE3 öncesi keşfedilen dört kullanıcı hatasının
(B-001..B-004) H-001..H-004 ticket'larıyla düzeltilmesinden ÖNCEydi. Bu tur, o düzeltmelerin
deployment yüzeyinde (Dockerfile/compose/CI-CD/env/runbook) bir kırılma yaratıp yaratmadığını
sıfırdan, bağımsız olarak doğrulamak için açıldı. Önceki rapor tamamen bu belgeyle
değiştirildi; hiçbir iddiasına körü körüne güvenilmedi.

`factory/pipeline.json` ve `factory/.factory/**`'ye dokunulmadı. Dal oluşturma/değiştirme/
birleştirme/push yapılmadı; değişiklikler `main` üzerindeki çalışma ağacında normal commit'e
hazır bırakıldı (bu depoda devops-agent'ın git commit çalıştırma yetkisi yok).

## 1. Kapsam ve Platform Kararı

Platform kararı DEĞİŞMEDİ: `factory/04-architecture/architecture.md` §5.1 — tek VPS (Hetzner
CX22, Nürnberg/EU) + `docker compose`, Caddy TLS/ters vekil, fotoğraflar Cloudflare R2'de.

## 2. H-001..H-004'ün Deployment Yüzeyine Etkisi (satır satır incelendi)

| Ticket | Ürün değişikliği | Deployment yüzeyine etkisi | Bulgu |
|---|---|---|---|
| H-001 | PDF'e DejaVu Sans/Bold gömülü font eklendi; `apps/api/package.json` `build` betiği `scripts/copy-pdf-fonts.mjs`'i çalıştıracak şekilde genişletildi | `apps/api/Dockerfile` `build` aşaması `npm run build --workspace @tutanak/api` çalıştırır — betik zaten bu komutun parçası, Dockerfile'da AYRI bir adım gerekmiyor | Runtime imajında fontların gerçekten `dist/modules/pdf/fonts/` altında olduğu bu oturumda `docker run` ile DOĞRUDAN doğrulandı (§4.1). Değişiklik gerekmedi. |
| H-002 | Kullanıcıya dönük API/arayüz/PDF metinleri düzgün Türkçe'ye çevrildi | Yeni env değişkeni, yeni bağımlılık veya yeni servis YOK | Env şeması ve `.env.example` etkilenmedi (§3). |
| H-003 | Ödeme "pending" ekranında artan aralıklı yoklama + elle "Durumu yenile" | Saf istemci (frontend) davranışı; API sözleşmesi, env veya build çıktısı değişmedi | Web Dockerfile/derleme adımlarında değişiklik gerekmedi. |
| H-004 | Masaüstü CSS yerleşimi (`app.css`) | Yalnızca statik CSS; `apps/web/Dockerfile`'ın `vite build` çıktısı hâlâ `/srv`'ye kopyalanıyor, Caddyfile değişmedi | Web bundle boyutu 312,63 kB → 313,64 kB (gzip 97,30 → 97,81 kB) — ölçülebilir ama önemsiz bir artış, davranış hatası değil. |

**Sonuç: dört ticket'ın hiçbiri yeni bir env değişkeni, yeni bir bağımlılık, yeni bir servis
veya Dockerfile/compose/CI-CD değişikliği gerektirmedi.** Aşağıdaki §3-§5 bu sonucu bağımsız
kanıtlarla doğrular.

## 3. Ortam Değişkeni Denetimi (bu oturumda yeniden yapıldı)

`apps/api/src/config/env.schema.ts`'teki `envObjectSchema` anahtarları elle çıkarıldı
(`grep` ile 25 anahtar) ve `.env.example` ile karşılaştırıldı; ayrıca `apps/api/src` ve
`apps/web/src` genelinde `process.env.`/`import.meta.env.` doğrudan okumaları arandı (config
modülü dışında sıfır sonuç).

- Şema (25 anahtar, H-001..H-004'ten önceki turla BİREBİR AYNI): `DATABASE_URL, JWT_SECRET,
  JWT_EXPIRES_IN, SUBSCRIPTION_PRICE_AMOUNT, SUBSCRIPTION_CURRENCY,
  RATE_LIMIT_WINDOW_SECONDS, RATE_LIMIT_MAX_REQUESTS, AUTH_RATE_LIMIT_MAX_REQUESTS,
  SUBSCRIPTION_PERIOD_DAYS, NODE_ENV, PAYMENT_PROVIDER, PUBLIC_APP_URL, EMAIL_FROM,
  RESEND_API_KEY, IYZICO_API_KEY, IYZICO_SECRET_KEY, IYZICO_WEBHOOK_SECRET, R2_ENDPOINT,
  R2_PUBLIC_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, PHOTO_MAX_BYTES,
  PHOTO_MAX_PER_REPORT, PRESIGNED_URL_TTL_SECONDS`.
- `.env.example` (25 satır): şemanın 24 anahtarı birebir (`NODE_ENV` hariç — kasıtlı, dosya
  içi yorumda gerekçeli) + `VITE_API_PROXY_TARGET` (yalnızca `apps/web` yerel `vite dev`
  vekili, sır değil).
- **Fark yok.** Eksik/fazla anahtar bulunmadı, düzeltme gerekmedi.

## 4. Doğrulama (bu oturumda gerçekten çalıştırıldı, uçtan uca)

### 4.1 İmaj derlemeleri

```
docker build -f apps/api/Dockerfile -t tutanak-api-verify:runtime .   → BAŞARILI (tam katman
                                                                          önbelleği isabet etti)
docker build -f apps/web/Dockerfile -t tutanak-web-verify:runtime .   → BAŞARILI (tam katman
                                                                          önbelleği isabet etti)
```

Katmanların tümüyle önbellekten gelmesi, iki Dockerfile'ın içeriğinin son commit'ten
(`5f86403`) beri değişmediğinin bağımsız bir kanıtıdır — H-001..H-004 deployment yüzeyine
dokunmadı.

H-001'in kritik riski (fontların `build` adımı olmadan runtime imajında ENOENT vermesi,
devops-report v1 §hatırlatma) bu oturumda DOĞRUDAN sınandı:

```
docker run --rm tutanak-api-verify:runtime sh -c "ls -la apps/api/dist/modules/pdf/fonts/"
  → DejaVuSans-Bold.ttf (705.684 bayt), DejaVuSans.ttf (757.076 bayt), LICENSE.txt,
    README.md — TÜMÜ RUNTIME İMAJINDA MEVCUT.
```

Doğrulama imajları iş bitince `docker image rm` ile temizlendi.

### 4.2 `docker compose -f docker-compose.e2e.yml up --build -d`

```
tutanak-app-db-1     Up (healthy)
tutanak-app-minio-1  Up (imajın kendi HEALTHCHECK'i yok — beklenen)
tutanak-app-api-1    Up (healthy)   (migrate deploy + seed + start zinciri BAŞARILI)
tutanak-app-web-1    Up (healthy)
```

Fonksiyonel duman testi (gerçek `curl`, gerçek kayıt/giriş/tutanak/fotoğraf/PDF — bu tur
H-001'in PDF font düzeltmesini uçtan uca doğrulamak için önceki turdan daha derin gitti):

```
GET  /health                                       → 200 {"status":"ok"}
GET  /                                             → 200 (SPA)
POST /api/v1/auth/register                         → 201 (yeni kullanıcı DB'ye yazıldı)
POST /api/v1/auth/login                            → 200 (accessToken alındı)
GET  /api/v1/templates (Authorization ile)          → 200
GET  /api/v1/templates (Authorization YOK)          → 401
POST /api/v1/reports (Türkçe başlık/not:
  "Şişli Çağlayan 3+1 çıkış teslimi" /
  "Mutfak dolabı çizik, ışık düğmesi bozuk")        → 201, JSON gövdesinde Türkçe karakterler
                                                        BOZULMADAN geri döndü (H-002 kanıtı)
GET  /api/v1/reports/{id}/pdf (fotoğrafsız)         → 400 REPORT_HAS_NO_PHOTOS, mesaj gövdesi
                                                        "...fotoğraf olmalıdır..." — API hata
                                                        mesajı da düzgün Türkçe (H-002 kanıtı)
POST /api/v1/reports/{id}/photos (multipart, 1 test
  JPEG)                                             → 201 (presigned URL MinIO'ya döndü)
GET  /api/v1/reports/{id}/pdf (fotoğraflı)          → 200, 17.873 bayt, geçerli PDF 1.3,
                                                        2 sayfa; bayt akışında "DejaVu" alt
                                                        dizesi MEVCUT → gömülü Unicode font
                                                        gerçekten runtime imajından PDF'e
                                                        taşınmış (H-001'in üretim yolunda
                                                        ÇALIŞTIĞININ doğrudan kanıtı)
GET  /api/v1/public/reports/<yok>                   → 404 + X-Robots-Tag: noindex,
                                                        Referrer-Policy: no-referrer
```

`docker compose down -v` ile temiz kapatma yapıldı; container/volume/network artığı kalmadı.

### 4.3 Yedekleme/geri yükleme provası

1. Stack ayağa kaldırıldı, bir kullanıcı kaydedildi (`smoke-devops2-<timestamp>@example.com`).
2. `docker compose exec -T db pg_dump -U tutanak tutanak | gzip > tutanak-drill2.sql.gz`
   (4.529 bayt), `gzip -t` ile bütünlüğü doğrulandı.
3. **Ayrı, boş** bir `postgres:16-alpine` container'ı (e2e ağının DIŞINDA, `docker run`,
   named volume paylaşmadan) başlatıldı, `pg_isready` ile hazır olduğu doğrulandı.
4. `gunzip -c ... | docker exec -i ... psql -U tutanak -d tutanak -v ON_ERROR_STOP=1` ile
   geri yüklendi — şema (tablolar, index, trigger, FK) ve veri hatasız uygulandı.
5. Doğrulama: `SELECT count(*) FROM users` → **1**, `SELECT email FROM users` → kayıt
   edilen adresle **birebir eşleşti**.
6. Drill container'ı ve geçici `.sql.gz` dosyası temizlendi; e2e stack `down -v` ile tekrar
   temiz kapatıldı.

Runbook §5'teki komutlarla birebir aynı desendedir; gerçek R2'ye yükleme adımı bir bulut
hesabı gerektirdiği için yerel provada atlandı (bilinen, belgelenmiş sınırlama, önceki
turdan devam ediyor).

### 4.4 Regresyon testleri (H-001..H-004 sonrası, hepsi bu oturumda yeniden koşuldu)

- Kök `tools/*.spec.ts` (Dockerfile/compose/CI/env'i pinler; `tools/pdf-font-asset.spec.ts`
  H-001 ile eklendi): `npx jest --config jest.config.mjs` → **11/11 suite, 74/74 test
  yeşil** (önceki turda 10/10, 68/68 idi — artış H-001'in yeni testinden).
- `apps/api`: `npm run test` → **56/56 suite, 386/386 test yeşil**.
- `apps/api` `npm run test:e2e` (bağımsız, host'ta 5433 portlu ayrı bir `postgres:16-alpine`
  container'ına karşı, migrate+seed sonrası) → **13/13 suite, 202/202 test yeşil**.
- `apps/web`: `npm run test` → **57/57 suite, 448/448 test yeşil**.
- `npm run build` (kök, tüm workspace'ler) → temiz; `npm run verify:pwa` → "PWA build
  doğrulaması geçti: manifest + service worker + kayıt kodu mevcut."
- `docker compose -f docker-compose.yml config` ve `docker compose -f docker-compose.e2e.yml
  config` → ikisi de hatasız çözüldü.

### 4.5 Kod kalitesi (CI'nin gerçekte çalıştırdığı komutlar, bu oturumda yeniden doğrulandı)

- `npx eslint $(git ls-files '*.ts' '*.tsx' '*.mjs') --max-warnings=0 --no-warn-ignored` →
  **exit 0, sıfır hata/uyarı**.
- Ayrıca kök `npm run lint` (`eslint . --max-warnings=0`, tüm dizin) ve `npm run
  format:check` (`prettier --check .`) da bu oturumda **temiz** geçti — önceki turda kayıtlı
  `.worktrees/T-024`/`.worktrees/T-025` kalıntılarının ürettiği 2 sahte uyarı bu çalışma
  alanında **artık gözlenmiyor** (kalıntı dizinler bulunmadı; kök neden — `eslint.config.mjs`
  `ignores` listesinin `.worktrees/**` içermemesi — koddan hâlâ düzeltilmedi, bir sonraki
  ajan/insan eski bir worktree bırakırsa sorun tekrar oluşabilir; bu gözlem
  `factory/09-docs/FOUND-ISSUES.md` madde 9'da da bağımsız olarak kayıtlı).
- `npm run typecheck` → temiz (`tsc --noEmit` kök + her workspace).
- `npm audit --audit-level=high` → **exit 0** (4 MEDIUM/moderate bulgu var — `iyzipay`'in
  geçişli `qs`/`uuid` bağımlılıkları, `security-audit.md` S-04'te kayıtlı, HIGH eşiğini
  aşmıyor, CI'yı kırmıyor — önceki turdan değişmedi).
- `.github/workflows/cd.yml` satır satır tekrar okundu: fork-PR koruması (`if:` koşulu)
  hâlâ yerinde. `.github/workflows/ci.yml` satır satır okundu: `quality` işi lint + typecheck
  + migrate-sapma-kontrolü + birim + e2e testleri + build + PWA doğrulaması + `npm audit`'i
  kırıcı modda çalıştırıyor — H-001..H-004'ün eklediği testler (`useSubscriptionAutoRefresh`,
  `SubscriptionPage`, `app-layout`, PDF font) bu iş içinde otomatik kapsanıyor, CI'da ayrı bir
  değişiklik gerekmedi. `factory-deploy.yml` okundu, dokunulmadı (rol sözleşmesi gereği,
  bilinçli olarak `workflow_dispatch` ile kapalı — "provider not configured").

## 5. Bu Oturumda Yapılan Değişiklikler

| Dosya | Değişiklik | Gerekçe |
|---|---|---|
| `CHANGELOG.md` | Yeni `[1.0.1] - 2026-08-18` bloğu eklendi: "Düzeltildi" altına PDF/arayüz Türkçe karakter düzeltmesi (H-001/H-002) ve ödeme pending ekranının artık çıkmaz sokak olmaması (H-003); "Değişti" altına masaüstü yerleşim iyileştirmesi (H-004); iç sürüm notuna ilgili ticket ID'leri ve B-005'in bu sürüme dahil edilmediği kaydı | H-001..H-004 kullanıcının doğrudan hissettiği davranışları düzeltti/değiştirdi; `changelog-girdi.md` şablonunun "KULLANICI diliyle" kuralına göre görünür bloğa eklendi. Versiyon `1.0.0` → `1.0.1`: dört düzeltmenin hiçbiri yeni bir özellik eklemedi (minor değil), üçü açıkça bug fix (patch); H-004 davranış değişikliği (görsel yerleşim) küçük ve geriye uyumlu olduğu için aynı patch sürümüne alındı. |
| `factory/10-release/runbook.md` | Üstteki tarih/kaynak satırı `2026-08-18 (... + H-001..H-004 dahil ...)` olarak güncellendi | İçerik bu oturumda satır satır yeniden doğrulandı (§2-§4), hiçbir platform/env/komut değişikliği gerekmedi — yalnızca doğrulama tarihi/kaynak SHA'sı tazelendi. |
| `factory/10-release/devops-report.md` | Bu belge, baştan yazıldı | Önceki hâl `374cce9` (H-001..H-004'ten önceki) kaynak durumu için üretilmişti; bu tur bağımsız olarak yeniden doğruladı ve H-001..H-004'ün deployment yüzeyine etkisini (§2) ayrıca belgeledi. |

Aşağıdaki varlıklar bu oturumda **doğrulandı, değiştirilmedi** (§2-§4.5'te kanıtlarıyla):
`apps/api/Dockerfile`, `apps/web/Dockerfile`, `docker-compose.yml`, `docker-compose.e2e.yml`,
`.env.example`, `.github/workflows/ci.yml`, `.github/workflows/cd.yml`.
`.github/workflows/factory-deploy.yml` okundu, dokunulmadı.

## 6. Bilinen Sınırlamalar / Takip Önerileri (kapsam dışı bırakıldı, gerekçeli)

1. **`apps/api` `runtime` imajında `node_modules` budanmamış (devDependencies dahil).**
   Önceki turdan değişmedi — `prisma migrate deploy`/`prisma/seed.ts` açılışta `prisma`
   CLI'sini gerektirdiği için `npm prune --omit=dev` uygulanamıyor.
2. **`eslint.config.mjs` `ignores` listesi `.worktrees/**` içermiyor** (kök neden,
   `factory/09-docs/FOUND-ISSUES.md` madde 6). Bu oturumda kalıntı worktree bulunmadığı için
   gözlemlenmedi, ancak kök neden koddan düzeltilmedi — deployment varlığı değil, kök
   `eslint.config.mjs`'in ürün-tarafı bir ayarı; devops-agent'ın "deployment yüzeyi"
   yetkisinin sınırında kalan bir öneridir, uygulanmadı.
3. **Staging/preview kanalı yok (bilinçli, maliyet kararı).** Değişmedi — GATE3 öncesi
   kontrol `docker-compose.e2e.yml` ile yerel olarak yapılır (runbook §6).
4. **`factory-deploy.yml` hâlâ "provider not configured" ile kapalı.** Bu turun kapsamı
   DEĞİL — GATE3'te `factoryctl` üzerinden gerçek bulut kimlik bilgileri bağlanana kadar
   bilinçli olarak kapalı kalır.
5. **security-audit.md S-04 (MEDIUM, `iyzipay` geçişli `qs`/`uuid`):** kayıtlı, release'i
   bloklamıyor, önceki turdan değişmedi.
6. **B-005 (şablon adları hâlâ ASCII'ye katlanmış, `apps/api/prisma/seed.ts`)** —
   `factory/bugs/B-005.md`'de kayıtlı, ürün kodu değişikliği gerektirir; bu devops turunun
   yazma yetkisi (deployment varlıkları) dışındadır, dokunulmadı. `.env.example`/env
   şemasını veya Dockerfile/compose/CI-CD'yi ETKİLEMİYOR — seed verisi statik metin, deploy
   sürecinin bir parçası olarak (idempotent upsert) zaten her açılışta çalışıyor, sorun
   içeriğin kendisinde.

## 7. Sürümleme

`CHANGELOG.md`'ye kullanıcı diliyle yazılmış yeni `[1.0.1]` bloğu eklendi (§5); iç sürüm
notunda ilgili ticket ID'leri (H-001..H-004) ve B-005'in bilinçli olarak bu sürüme dahil
edilmediği kaydı var. `factory/pipeline.json`'a dokunulmadı (state/versiyon `factoryctl`'e
aittir).
