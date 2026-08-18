# Tutanak — Emlak Teslim Tutanağı Platformu

Emlak ofisleri ve emlak danışmanlarının, kiracı giriş/çıkış tesliminde mülkün durumunu
**fotoğraf + not + otomatik tarih damgası** ile kayıt altına almasını ve karşı tarafın
(kiracı) **hesap açmadan, tek tıkla onaylamasını** sağlayan mobil öncelikli bir web
uygulamasıdır (PWA).

Onay bir e-imza değildir; ürün arayüzünde açıkça **"resmi hukuki delil değildir,
destekleyici kanıttır"** uyarısıyla sunulur.

## Kime hitap eder

| Kullanıcı | Ne yapar |
|---|---|
| **Emlak danışmanı / ofis yöneticisi** | Hesap açar, sahada tutanak oluşturur, fotoğraf ekler, PDF indirir, kiracıya e-posta/WhatsApp ile paylaşır, geçmiş tutanaklarını arar, aylık abonelik öder. |
| **Kiracı (karşı taraf)** | Kendisine gönderilen linki hesap açmadan açar, tutanağı inceler, tek tıkla onaylar. |

Son kullanıcı akışları için: **[USER-GUIDE.md](./USER-GUIDE.md)**.

## Ürün kapsamı (uygulanmış olan)

- E-posta + şifre ile kayıt/giriş (JWT)
- 3 hazır emlak şablonu (giriş/çıkış teslim, sayaç/demirbaş tespiti, periyodik durum kontrolü)
- Fotoğraf + başlık + not ile tutanak taslağı oluşturma; her fotoğrafta sunucu tarafında
  üretilen, değiştirilemez tarih-saat damgası
- Tutanağın PDF çıktısı
- E-posta / WhatsApp linki ile paylaşım
- Karşı tarafın hesapsız, token'lı linkten görüntülemesi ve tek tıkla onayı
- Geçmiş tutanakları listeleme ve arama
- Aylık abonelik ödemesi (checkout + webhook ile durum güncelleme)

Kapsam dışı olanlar (v2+) için `factory/02-prd/prd.md` §4'e bakın; bu doküman setinde
sadece **var olan** davranış anlatılır.

## 30 saniyede hızlı başlangıç

```bash
git clone <repo-url> tutanak-app && cd tutanak-app
cp .env.example .env
docker compose up
```

Ayağa kalkınca: web `http://localhost:5173`, API `http://localhost:3000/api/v1`,
sağlık kontrolü `http://localhost:3000/health`. Hiçbir dış hesap/anahtar gerekmez
(ödeme sahte sağlayıcıyla, yerelde S3-uyumlu MinIO ile çalışır).

Ayrıntılı kurulum, ortam değişkenleri ve sık karşılaşılan hatalar için:
**[SETUP.md](./SETUP.md)**.

## Diğer dokümanlar

| Doküman | İçerik |
|---|---|
| [SETUP.md](./SETUP.md) | Sıfırdan kurulum, ortam değişkenleri, komutlar, sık hatalar |
| [API.md](./API.md) | Tüm endpoint'ler, auth, örnek istek/yanıt, hata kodları |
| [USER-GUIDE.md](./USER-GUIDE.md) | Son kullanıcı için adım adım kullanım, SSS |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Gerçekleşen mimari, bileşenler, plandan sapmalar |

## Teknoloji özeti

Node.js 22 + TypeScript (strict), npm workspaces monorepo:

```
apps/api    NestJS 11 backend, Prisma 6 + PostgreSQL 16, Cloudflare R2 (S3), Resend, iyzico
apps/web    React 19 + Vite 6 PWA (Workbox service worker)
```

Yerelde `docker compose` dört servis çalıştırır (`db`, `minio`, `api`, `web`). Üretim
imajı ayrıca `apps/web/Dockerfile` içine gömülü bir Caddy yapılandırması içerir (statik
dosya sunumu + `/api` ters vekil + güvenlik başlıkları); tek VPS dağıtımı bunun
üzerine kuruludur. Ayrıntılar: [ARCHITECTURE.md](./ARCHITECTURE.md).

## Bilinen sınırlamalar

- **E-posta gönderimi yerelde her zaman `failed` döner ve hiçbir yerde görüntülenemez.**
  Uygulama e-postayı Resend'in **HTTPS API istemcisi** üzerinden gönderir (SMTP değil);
  `docker-compose.yml`'de bir SMTP yakalayıcı (mailpit vb.) **yoktur** — hiçbir servis
  giden e-postayı yakalamaz. `RESEND_API_KEY` boşken (yerel varsayılan) gönderim denemesi
  gerçek `api.resend.com`'a gider ve reddedilir; sonuç `202 + status: "failed"` olarak
  yanıta yansır. Bu davranış bir hata değildir: gönderim başarısız olsa da paylaşım
  linkinin kendisi geçerli kalır ve kullanıcı WhatsApp veya kopyalama ile devam edebilir.
  Gerçek gönderimi denemek için `.env`'e geçerli bir `RESEND_API_KEY` girin.
- **`husky` pre-commit hook'u hiç kurulmadı.** `lint-staged` yapılandırması `package.json`
  içinde hazır ama `.husky/pre-commit` dosyası repoda yok; commit öncesi otomatik
  lint/format çalışmaz, yalnızca CI'da (`push`/`pull_request`) çalışır.
- **Abonelik durumu erişimi kısıtlamaz (paywall yok).** Ödemesi `inactive`/`pending` olan bir
  kullanıcı da tutanak oluşturmaya, fotoğraf eklemeye, PDF indirmeye devam edebilir; abonelik
  yalnızca `/subscription` ekranında bir durum göstergesidir.
- **Terk edilen ödeme (checkout) sunucu tarafında süresiz `pending` kalır.** Kullanıcı
  ödeme sayfasını tamamlamadan çıkarsa sunucuda zaman aşımı/otomatik iptal mekanizması
  yoktur (bu, H-003 ile **değişmedi** — bkz. ARCHITECTURE.md §7.16). H-003, yalnızca
  istemci tarafında bu durumu görünür kıldı: `/subscription` ekranı artık `pending`
  durumunda birkaç dakika içinde kendiliğinden yeniden dener, her zaman görünür bir
  "Durumu yenile" butonu sunar ve bekleme süresi dolunca ne yapılması gerektiğini
  söyleyen bir mesaja döner — ama kayıt sunucuda hâlâ süresiz `pending` kalabilir.
- **Üç sabit şablonun adı hâlâ ASCII'ye katlanmış Türkçe'dir** (`Giris/Cikis Teslim
  Tutanagi`, `Sayac/Demirbas Tespiti`, `Periyodik Durum Kontrolu`). Uygulamanın geri
  kalanındaki tüm kullanıcıya dönük metinler tam aksanlı Türkçe'ye çevrildi, ama seed
  verisi (`apps/api/prisma/seed.ts`) bu kapsamın dışında kaldı; bu, teslim sonrası ayrı
  bir açık bulgu olarak kayıtlıdır (`factory/bugs/B-005.md`, henüz düzeltilmedi).
- **Tutanak metni (başlık/not) oluşturulduktan sonra düzenlenemez.** Güncelleme/silme
  endpoint'i yoktur; yalnızca fotoğraf eklenebilir (onaylanana kadar).
- **Arama Türkçe'ye özgü harf normalizasyonu yapmaz** (`İ/ı` gibi); Postgres `ILIKE` +
  `pg_trgm` kullanır, veritabanı locale'ine bağlıdır.
- **Tek API instance'ı varsayılır.** Hız sınırlama bellek içi sayaçla yapılır; API yeniden
  başlarsa sayaçlar sıfırlanır, birden fazla replikada limit replika başına işler.
- **Hız sınırı her zaman istemci IP'sine göredir, kimlik doğrulanmış uçlarda da kullanıcı
  başına değil.** Genel hız sınırı guard'ı (`ClientIpThrottlerGuard`) `JwtAuthGuard`'dan
  önce, **tüm** endpoint'lerde çalışır; aynı ofisteki birden fazla danışman aynı ağ
  çıkışını (NAT/aynı Wi-Fi) paylaşıyorsa aynı sayacı paylaşır.
