# İşletme Runbook'u — Tutanak (Emlak Teslim Tutanağı Platformu)

> Üretici: devops-agent | Tarih: 2026-08-18 (T-001..T-028 + H-001..H-004 dahil, T-013 iptal —
> bu turda `main @ 5f86403` üzerinde yeniden uçtan uca doğrulandı, içerik değişikliği
> gerekmedi — bkz. `factory/10-release/devops-report.md`)
> Hedef okuyucu: 3 ay sonra gece yarısı sorun yaşayan sen. Her adım kopyala-yapıştır komut içerir.
> Platform: **tek VPS (Hetzner Cloud, Nürnberg/EU) + `docker compose`** — karar kaynağı:
> `factory/04-architecture/architecture.md` §5.1. Bu belgedeki her komut yerel olarak
> (docker-compose.e2e.yml ile aynı imaj/Dockerfile hedefleri kullanılarak) provası yapılıp
> doğrulandıktan sonra yazılmıştır — bkz. `factory/10-release/devops-report.md`.

## 0. Tek Seferlik Platform Kurulumu

> **Format kuralı:** Her komut kendi küçük kod bloğunda, üstünde tek satırlık "Ne yapar:"
> açıklamasıyla. Geri alınamaz/mali etkili komutların üstünde `⚠️` işareti var.

<!-- Doğrulanan dokümantasyon kaynağı: https://docs.docker.com/engine/install/debian/ ,
     https://caddyserver.com/docs/automatic-https , https://cli.github.com/manual/gh_repo_deploy-key -->

### 0.1 Sunucu

⚠️ Ne yapar: Hetzner Cloud'da CX22 (2 vCPU/4 GB/40 GB NVMe), Nürnberg (EU) bölgesinde, Ubuntu 24.04 ile bir sunucu oluşturur (aylık ~5 USD, architecture.md §5.2). Web arayüzünden de yapılabilir; burada `hcloud` CLI ile verilmiştir.

```bash
hcloud server create --name tutanak-prod --type cx22 --location nbg1 --image ubuntu-24.04 --ssh-key <hesabina-eklenmis-ssh-anahtari-adi>
```

Ne yapar: Sunucuya SSH ile bağlanır (IP'yi `hcloud server ip tutanak-prod` ile alın).

```bash
ssh root@<sunucu-ip>
```

Ne yapar: Docker Engine + Compose eklentisini resmi script ile kurar.

```bash
curl -fsSL https://get.docker.com | sh
```

Ne yapar: SSH (22) portuna izin verir (bağlantınızın kesilmemesi için HTTP/HTTPS'ten önce açılır).

```bash
ufw allow 22/tcp
```

Ne yapar: HTTP (80) portuna izin verir (Caddy'nin Let's Encrypt doğrulaması için gerekli).

```bash
ufw allow 80/tcp
```

Ne yapar: HTTPS (443) portuna izin verir.

```bash
ufw allow 443/tcp
```

⚠️ Ne yapar: Güvenlik duvarını etkinleştirir — yukarıdaki üç kural önceden eklenmemişse bağlantınız kesilebilir; sırayı değiştirmeyin.

```bash
ufw --force enable
```

Ne yapar: Uygulama dosyalarının duracağı dizini oluşturur.

```bash
mkdir -p /opt/tutanak-app
```

Ne yapar: Çalışma dizinine geçer — bu oturumdaki (SSH bağlantısı boyunca) sonraki tüm komutlar bu dizinde çalıştığı varsayımıyla yazılmıştır.

```bash
cd /opt/tutanak-app
```

### 0.2 İmaj deposu erişimi (GHCR)

Ne yapar: `.github/workflows/cd.yml`, `main`'e giden her doğrulanmış commit için `ghcr.io/<owner>/<repo>-api` ve `ghcr.io/<owner>/<repo>-web` imajlarını otomatik yayınlar (repo `public` değilse aşağıdaki adım gerekir; `public` ise atlanabilir). Bir **Personal Access Token (classic, `read:packages` yetkili)** ile sunucudan giriş yapılır — token GitHub hesap ayarlarından (Settings → Developer settings → PAT) üretilir, buraya yazılmaz.

```bash
docker login ghcr.io -u <github-kullanici-adi>
```

### 0.3 Dış servis hesapları (sır DEĞERLERİ burada YOK — yalnızca nereden alınacağı §2'de)

Ne yapar: Cloudflare R2'de fotoğraf kovasını oluşturur (EU bölgesi — architecture.md §5.1 "veri yeri" kararı).

```bash
wrangler r2 bucket create tutanak-photos-prod --location eu
```

⚠️ Ne yapar: R2 erişimi için bir API token (Access Key ID + Secret) üretir; bu değerler yalnızca bir kez gösterilir, güvenli bir şifre yöneticisine kaydedilmeli ve VPS'teki `.env` dosyasına (aşağıda §1) yazılmalıdır.

```bash
wrangler r2 api-token create --name tutanak-prod --permission object-read-write
```

Diğer tek seferlik hesap kurulumları (komut yerine panelden yapılır, bu yüzden burada betik yoktur):
- **Resend:** hesap açılır, gönderen alan adı (`EMAIL_FROM`'daki domain) doğrulanır (DNS TXT/DKIM kaydı), API anahtarı üretilir.
- **iyzico:** üye iş yeri hesabı açılır, API anahtarları ve webhook gizli anahtarı panelden alınır, webhook URL'i `https://<domain>/api/v1/billing/webhook` olarak tanımlanır.
- **Alan adı:** DNS'te `A` kaydı sunucunun IP'sine, `CAA` kaydı (varsa) Let's Encrypt'e izin verecek şekilde ayarlanır.

## 1. İlk Deploy (adım adım)

> Aynı format kuralı burada da geçerli: her adım ayrı blok, üstünde "Ne yapar:" satırı.

Ne yapar: Üretim `.env` dosyasını oluşturur. Değerleri §2 tablosundaki kaynaklardan tek tek dolduracaksınız; bu komut yalnızca boş dosyayı açar, gerçek değerleri bir editörle (`nano .env`) siz girersiniz.

```bash
touch .env
```

Ne yapar: `.env` dosyasının izinlerini yalnızca sahibi okuyabilecek şekilde kısıtlar (architecture.md §7 "Secrets") — içine sırlar yazılmadan önce yapılmalıdır.

```bash
chmod 600 .env
```

Ne yapar: `.env` içine, aşağıdaki §2 tablosundaki TÜM anahtarları (uygulama env'i + `POSTGRES_PASSWORD`/`APP_DOMAIN`/`IMAGE_TAG`) gerçek değerleriyle yazın (editör: `nano .env`). Bu adım komutla değil elle yapılır, bu yüzden burada kod bloğu yoktur — §2 tablosunu satır satır takip edin.

Ne yapar: Üretim `docker-compose.yml` dosyasını sunucuda oluşturur. İçerik, `docker-compose.e2e.yml`'in (repo kökü) aynı imaj/Dockerfile hedeflerini kullanır; tek fark burada `build:` yerine GHCR'dan **önceden derlenmiş, SHA ile etiketlenmiş** `image:` çekilmesidir (test edilen imaj = deploy edilen imaj ilkesi) ve MinIO yoktur (gerçek R2 kullanılır).

```bash
cat > /opt/tutanak-app/docker-compose.yml <<'EOF'
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: tutanak
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: tutanak
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U tutanak']
      interval: 5s
      timeout: 5s
      retries: 10
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '3' }

  api:
    image: ghcr.io/${GHCR_OWNER}/${GHCR_REPO}-api:${IMAGE_TAG}
    restart: unless-stopped
    env_file: [.env]
    environment:
      DATABASE_URL: postgresql://tutanak:${POSTGRES_PASSWORD}@db:5432/tutanak
    depends_on:
      db:
        condition: service_healthy
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '3' }

  web:
    image: ghcr.io/${GHCR_OWNER}/${GHCR_REPO}-web:${IMAGE_TAG}
    restart: unless-stopped
    environment:
      APP_DOMAIN: ${APP_DOMAIN}
      # CSP'nin img-src/connect-src yonergeleri bu kokenden turer (apps/web/Dockerfile).
      # Verilmezse Caddy sorunsuz acilir ama fotograf URL'leri tarayicida SESSIZCE
      # engellenir — sunucu tarafinda hicbir hata gorunmez.
      R2_PUBLIC_ENDPOINT: ${R2_PUBLIC_ENDPOINT}
    ports: ['80:80', '443:443']
    depends_on: [api]
    volumes:
      - caddy-data:/data
      - caddy-config:/config
    logging:
      driver: json-file
      options: { max-size: '10m', max-file: '3' }

volumes:
  db-data:
  caddy-data:
  caddy-config:
EOF
```

Ne yapar: GHCR'daki en güncel doğrulanmış imajları çeker (`.env`'deki `GHCR_OWNER`/`GHCR_REPO`/`IMAGE_TAG` — `IMAGE_TAG` genelde deploy edilecek commit'in tam SHA'sıdır). `/opt/tutanak-app` dizininde çalıştırılmalıdır (§0.1'de oluşturulup geçilen dizin).

```bash
docker compose --env-file .env pull
```

Ne yapar: Servisleri arka planda ayağa kaldırır. `api` imajının `CMD`'si açılışta sırasıyla `prisma migrate deploy` (şema) → seed (3 sabit şablon, idempotent) → `node dist/main.js` çalıştırır (apps/api/Dockerfile).

```bash
docker compose --env-file .env up -d
```

Ne yapar: Servislerin sağlıklı duruma geçtiğini doğrular (`api` ve `web` imajlarında `HEALTHCHECK` tanımlıdır).

```bash
docker compose ps
```

Ne yapar: Duman testi 1/2 — API'nin sağlık ucu Caddy üzerinden 200 dönüyor mu.

```bash
curl -f https://<domain>/health
```

Kabul: `{"status":"ok"}` döner.

Ne yapar: Duman testi 2/2 — Caddy üzerinden `/api/v1` ters vekili çalışıyor mu (401 dönmesi normaldir: kimliksiz istektir, önemli olan Caddy'nin isteği API'ye ilettiğidir).

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://<domain>/api/v1/templates
```

Kabul: `401` yazdırır (200 değil — kimlik doğrulama gerektiren bir uca kimliksiz gidildiği için beklenen budur).

## 2. Ortam Değişkenleri

Uygulama env şeması (`apps/api/src/config/env.schema.ts`) ve `.env.example` tek doğruluk
kaynağıdır; aşağıdaki tablo üretimde **gerçek** değerlerin nereden geleceğini ekler.

| Değişken | Anlamı | Örnek değer | Nereden alınır |
|---|---|---|---|
| `DATABASE_URL` | Postgres bağlantı adresi | `postgresql://tutanak:***@db:5432/tutanak` | Compose dosyasında otomatik kurulur (`POSTGRES_PASSWORD`'e bağlı); elle değiştirmeyin |
| `JWT_SECRET` | JWT imzalama anahtarı | 32+ karakter rastgele metin | `openssl rand -base64 48` ile üretilir, bir kez yazılır, kaybolursa tüm oturumlar geçersiz olur |
| `R2_ENDPOINT` | Cloudflare R2 S3 uyumlu uç noktası | `https://<account-id>.r2.cloudflarestorage.com` | Cloudflare panosu → R2 → bucket → "S3 API" |
| `R2_PUBLIC_ENDPOINT` | Tarayıcıya dönen ön-imzalı URL adresi. **Bu değer hem `api` hem `web` servisine geçer**: `web` tarafında CSP'nin `img-src`/`connect-src` kökenini belirler, eksikse fotoğraflar tarayıcıda sessizce engellenir | R2 özel alan adı ya da `R2_ENDPOINT` ile aynı | Cloudflare panosu → R2 → bucket → "Public access" (özel domain bağlıysa onu kullanın) |
| `R2_BUCKET` | Fotoğraf kovası adı | `tutanak-photos-prod` | §0.3'te oluşturduğunuz kova adı |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` | R2 API kimlik bilgileri | — | §0.3 `wrangler r2 api-token create` çıktısı (yalnızca bir kez gösterilir) |
| `RESEND_API_KEY` | İşlemsel e-posta API anahtarı | `re_***` | Resend panosu → API Keys |
| `EMAIL_FROM` | Paylaşım e-postasının gönderen adresi | `Tutanak <bildirim@sizin-domaininiz.com>` | Resend'de doğrulanan domain ile aynı olmalı |
| `IYZICO_API_KEY` / `IYZICO_SECRET_KEY` / `IYZICO_WEBHOOK_SECRET` | Ödeme sağlayıcısı kimlik bilgileri | — | iyzico üye iş yeri paneli → Ayarlar → API Anahtarları / Webhook |
| `PAYMENT_PROVIDER` | Aktif ödeme adaptörü | `iyzico` | Üretimde her zaman `iyzico` (yerelde `fake`) |
| `SUBSCRIPTION_PRICE_AMOUNT` | Abonelik ücreti (ondalıklı string) | `199.00` | Ürün/fiyatlandırma kararı (PRD açık sorusu çözüldüğünde) |
| `SUBSCRIPTION_CURRENCY` | Para birimi | `TRY` | Sabit |
| `SUBSCRIPTION_PERIOD_DAYS` | Abonelik dönem uzunluğu (gün) | `30` | Sabit |
| `PUBLIC_APP_URL` | Genel uygulama adresi | `https://<domain>` | Bağladığınız alan adı |
| `PHOTO_MAX_BYTES` / `PHOTO_MAX_PER_REPORT` | Maliyet korkuluğu üst sınırları | `10485760` / `30` | architecture.md §5.3, değiştirmeden bırakın |
| `JWT_EXPIRES_IN` | Erişim tokeni ömrü | `7d` | Sabit |
| `PRESIGNED_URL_TTL_SECONDS` | Fotoğraf URL ömrü | `900` | Sabit |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX_REQUESTS` | Hız sınırı ayarları | architecture.md §7 tablosu | Sabit, değiştirmeden bırakın |
| **`POSTGRES_PASSWORD`** *(infra, app env değil)* | DB container şifresi | 24+ karakter rastgele | `openssl rand -base64 24` |
| **`APP_DOMAIN`** *(infra)* | Caddy'nin otomatik TLS alacağı alan adı | `app.sizin-domaininiz.com` | DNS'te sunucuya yönlendirdiğiniz alan adı |
| **`GHCR_OWNER` / `GHCR_REPO`** *(infra)* | İmaj deposu yolu | `ozlemmehmet` / `tutanak-app` | GitHub repo adı, küçük harf |
| **`IMAGE_TAG`** *(infra)* | Deploy edilecek imaj etiketi | commit SHA'sı | `.github/workflows/cd.yml` çıktısı; rollback'te önceki SHA yazılır (§3) |

## 3. Rollback Prosedürü

> Aynı format kuralı: her komut ayrı blok + "Ne yapar:" satırı. Cloud Run'daki gibi "önceki
> revizyona dön" tek komutu yoktur (VPS + compose); burada rollback = önceki imaj etiketiyle
> yeniden başlatmaktır — geri alınabilir bir işlemdir, mali etki yoktur.

Ne yapar: Şu an çalışan imaj etiketini (SHA) not eder — rollback sonrası "ileri sarmak" gerekirse lazım olur.

```bash
docker compose images | grep -E 'tutanak-app-(api|web)'
```

Ne yapar: `.env` içindeki `IMAGE_TAG` değerini bir önceki bilinen-iyi commit SHA'sıyla değiştirir (`nano .env`, tek satır düzenlenir — bu adım elle yapılır, kod bloğu bir sonraki adımdadır).

Ne yapar: Önceki etiketli imajı çeker (veri kaybı yok — `db` volume'üne dokunulmaz).

```bash
docker compose --env-file .env pull
```

Ne yapar: Servisleri önceki etiketli imajla yeniden başlatır.

```bash
docker compose --env-file .env up -d
```

Ne yapar: Rollback sonrası duman testini tekrarlar.

```bash
curl -f https://<domain>/health
```

> **Not (şema geriye dönüşü):** `prisma migrate deploy` yalnızca İLERİ migration uygular; bir
> migration'ı geri almak gerekiyorsa (nadir, yıkıcı şema değişikliği) `apps/api/package.json`
> `migrate:down` betiği kullanılır — bu, kod rollback'inden AYRI ve bilinçli bir karardır,
> otomatik tetiklenmez.

## 4. İzleme ve Alarmlar

- **Servis durumu:** `docker compose ps` (sağlıksız container `unhealthy` gösterir — `api`/`web` imajlarındaki `HEALTHCHECK` bunu üretir).
- **Kaynak kullanımı:** `docker stats --no-stream` — CX22 4 GB RAM'in %70'ini aşan sürekli kullanım mimari inceleme tetikleyicisidir (architecture.md §5.4: sürekli CPU > %60 iki hafta üst üste).
- **Disk doluluğu:** `df -h /` — %70 doluluk uyarı eşiği (architecture.md §5.3); Postgres volume büyümesi burada görülür.
- **Uygulama logları:** `docker compose logs -f api` (pino JSON, `error`/`warn` seviyeleri — CLAUDE.md §4.4). 5xx oranı bütçesi ≤ %0,5 (architecture.md §6); bunu izlemek için basit bir sayım:
  ```bash
  docker compose logs api --since 24h | grep -c '"level":50'
  ```
- **Dışarıdan çalışma zamanı izleme (ücretsiz katman yeterli):** UptimeRobot/benzeri bir servisle `https://<domain>/health`'e 5 dakikada bir HTTP kontrolü kurun; hedef aylık erişilebilirlik ≥ %99,5 (architecture.md §6).
- **Sertifika:** Caddy otomatik yeniler; `docker compose logs web | grep -i certificate` ile son yenileme doğrulanabilir.

## 5. Yedekleme ve Geri Yükleme

Yedekleme hedefi: gecelik `pg_dump | gzip` → R2, 14 gün saklama; RPO ≤ 24 sa (architecture.md
§5.1, §6). Aşağıdaki komutlar **yerel olarak provası yapılıp doğrulanmıştır**
(bkz. devops-report.md "Yedekleme/geri yükleme provası") — gerçek komutlar aynen budur.

Ne yapar: Çalışan `db` container'ından sıkıştırılmış bir SQL yedeği alır (tarih damgalı dosya adıyla).

```bash
docker compose exec -T db pg_dump -U tutanak tutanak | gzip > /opt/tutanak-app/backups/tutanak-$(date +%F).sql.gz
```

Ne yapar: Yedeği R2'ye yükler (`aws` CLI, R2 S3-uyumlu uç noktasıyla yapılandırılmış — `aws configure` bir kez çalıştırılır, `R2_ENDPOINT`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY` ile).

```bash
aws s3 cp /opt/tutanak-app/backups/tutanak-$(date +%F).sql.gz s3://tutanak-photos-prod/db-backups/ --endpoint-url "$R2_ENDPOINT"
```

Ne yapar: 14 günden eski yerel yedekleri siler (R2'deki kopyalar kova yaşam döngüsü kuralıyla ayrıca temizlenir — panelden bir kez kurulur).

```bash
find /opt/tutanak-app/backups -name '*.sql.gz' -mtime +14 -delete
```

Ne yapar: Yukarıdaki üç adımı her gece 03:00'te otomatik çalıştıracak crontab girdisini ekler.

```bash
(crontab -l 2>/dev/null; echo "0 3 * * * cd /opt/tutanak-app && docker compose exec -T db pg_dump -U tutanak tutanak | gzip > backups/tutanak-\$(date +\%F).sql.gz && aws s3 cp backups/tutanak-\$(date +\%F).sql.gz s3://tutanak-photos-prod/db-backups/ --endpoint-url \$R2_ENDPOINT && find backups -name '*.sql.gz' -mtime +14 -delete") | crontab -
```

### Geri yükleme provası (felaket senaryosu — periyodik olarak tekrarlanmalı)

Ne yapar: R2'den en güncel yedeği indirir.

```bash
aws s3 cp s3://tutanak-photos-prod/db-backups/tutanak-<tarih>.sql.gz . --endpoint-url "$R2_ENDPOINT"
```

⚠️ Ne yapar: **Geri dönüşü olmayan** işlem — hedef veritabanındaki mevcut verinin üzerine yazar. Önce boş/ayrı bir hedefte (ör. `tutanak_restore_test` adlı geçici bir veritabanında) denenmesi şiddetle önerilir; gerçek bir felaket kurtarmada `db` container'ı durdurulup volume `db-data` sıfırdan başlatıldıktan sonra çalıştırılır.

```bash
gunzip -c tutanak-<tarih>.sql.gz | docker compose exec -T db psql -U tutanak -d tutanak
```

Ne yapar: Geri yüklemenin başarılı olduğunu doğrular (herhangi bir tabloda satır sayısı kontrolü — burada `users` örnektir).

```bash
docker compose exec -T db psql -U tutanak -d tutanak -c "SELECT count(*) FROM users;"
```

## 6. Staging/Preview Kanalı

Bu MVP'nin aylık altyapı bütçesi ~7-8 USD (architecture.md §5.2) ikinci bir sürekli-açık VPS'i
(staging) haklı çıkarmaz — bu bilinçli bir maliyet kararıdır, unutkanlık değildir. GATE3
öncesi insan kontrolü için:

1. **Birincil yol — yerel duman testi (ücretsiz, en hızlı):** `docker compose -f docker-compose.e2e.yml up --build -d` (repo kökü) GERÇEK üretim imajlarını (aynı Dockerfile hedefleri) MinIO ile dış hesapsız ayağa kaldırır (e-posta için ayrı bir yakalayıcı yoktur — Resend'in HTTPS API'si kullanılır, SMTP değil; bkz. §8). `http://localhost:8080` üzerinden tüm akış (kayıt → tutanak → paylaşım → onay) elle denenir. Bu, `factory/10-release/devops-report.md`'de bu tur için de yeniden doğrulandı.
2. **İkincil yol — geçici VPS kanalı (yalnızca büyük/riskli sürümlerde, elle açılıp kapatılır):** Aynı Hetzner hesabında geçici bir CX22 (`tutanak-staging`) açılır, §0-1 aynen tekrarlanır, `APP_DOMAIN=staging.<domain>` ile ayrı bir alt alan adına bağlanır; test bitince sunucu **silinir** (sürekli ikinci fatura kalemi açılmaz).

## 7. Maliyet İzleme

| Kalem | Aylık tahmin (architecture.md §5.2) | Nereden izlenir |
|---|---|---|
| Hetzner CX22 + otomatik yedek | ~6 USD | Hetzner Cloud Console → Billing |
| Cloudflare R2 (≤20 GB) | ~0.40 USD | Cloudflare Dashboard → R2 → Usage |
| Resend | 0 USD (ücretsiz katman, 3.000 e-posta/ay) | Resend Dashboard → Usage |
| Alan adı | ~1 USD (yıllık amortize) | Kayıt sağlayıcısı faturası |
| iyzico | İşlem başına komisyon (sabit ücret yok) | iyzico paneli → Ekstre |
| **Toplam** | **~7-8 USD/ay** | — |

⚠️ **Maliyet tavanı:** Toplam aylık gider **25 USD'yi aşarsa** bu bir mimari inceleme
tetikleyicisidir (architecture.md §5.3) — sessizce ödenmez, kaynağı (hangi kalem
büyüdü) araştırılır. `web` (Caddy) container'ında `max-instances` kavramı yoktur (VPS tek
replika); asıl kaçak riski R2 depolama büyümesi veya iyzico işlem hacmidir.

## 8. Sık Sorunlar ve Çözümleri

| Belirti | Olası neden | Çözüm komutu/adımı |
|---|---|---|
| `docker compose ps` → `api` sürekli `unhealthy` | Migration/seed başarısız (bkz. `docker compose logs api`) ya da `DATABASE_URL`/`POSTGRES_PASSWORD` uyuşmuyor | `docker compose logs api \| tail -50`; `.env`'deki `POSTGRES_PASSWORD` ile compose'un `db` servisindeki değer aynı mı kontrol edin |
| `curl https://<domain>` → sertifika hatası | DNS henüz yayılmamış ya da 80/443 kapalı (ufw) | `dig <domain>` ile IP'yi doğrulayın; `ufw status` ile 80/443 açık mı bakın; `docker compose logs web \| grep -i error` |
| `POST /billing/webhook` sürekli `502` | iyzico'ya giden çağrı başarısız (`IYZICO_API_KEY` yanlış/eksik) | `.env`'deki `IYZICO_*` değerlerini panelden tekrar kontrol edin; `PAYMENT_PROVIDER=fake` YANLIŞLIKLA üretimde kalmış olabilir |
| Fotoğraf yükleme `502 STORAGE_UNAVAILABLE` | R2 kimlik bilgileri veya `R2_ENDPOINT` hatalı | `.env`'deki `R2_*` değerlerini Cloudflare panosuyla karşılaştırın; `docker compose exec api wget -qO- $R2_ENDPOINT` ile erişim test edilebilir |
| Paylaşım e-postası hep `status: failed` dönüyor | `RESEND_API_KEY` boş/geçersiz ya da `EMAIL_FROM` domaini Resend'de doğrulanmamış (CLAUDE.md §4.2.2 — bu bir istisna DEĞİL, beklenen davranış biçimidir) | `.env`'deki `RESEND_API_KEY`'i kontrol edin; Resend panosunda domain doğrulama durumuna bakın. **Yerelde** bu davranış zaten beklenir (T-023 bekliyor, bkz. devops-report.md) |
| Disk `%70`'i geçti | Postgres WAL büyümesi ya da eski yedekler temizlenmemiş | `du -sh /var/lib/docker/volumes/*/`; `find backups -mtime +14` ile eski yedekleri elle temizleyin, cron çalışıyor mu kontrol edin (`crontab -l`) |
