# Uctan Uca Entegrasyon Raporu

> Uretici: integration-qa-agent | Branch: main | Tarih: 2026-08-18 (integration:6)

## SONUC: PASS

**Ozet:** Bu tur, `main`'in GUNCEL HEAD'i (`5f86403`) uzerinde, tamamen SIFIRDAN temiz bir
ortamda kosuldu. Onceki tur (integration:5, HEAD `374cce9`) 40/40 PASS ile kapanmisti; bu
turda **bes yeni degisiklik** hedeflendi — teslim sonrasi bulunan dort kusura (B-001..B-004)
karsi acilan hotfix'ler ve bir bagimlilik/audit duzeltmesi:
- **fix(deps) `98c05de`** — `deepmerge-ts@8` override'i (audit kapisi).
- **H-001 `5b7662f`** — PDF ciktisina Turkce kapsayan gomulu font (DejaVu Sans).
- **H-003 `34a5190`** — odeme sonrasi `pending` ekraninda yoklama + elle yenileme + zaman
  asimi mesaji (B-003 cikmaz sokak duzeltmesi).
- **H-004 `5abc3bc`** — masaustu kapsayici sinirlamasi, buton daraltmasi, detay panel
  yuzeyleri (B-004).
- **H-002 `5f86403`** — kullaniciya donuk arayuz + API metinlerinin duzgun Turkce'ye
  cevrilmesi (B-002), PDF etiket sabitleri dahil (H-001'e bagimli).

`docker compose down -v --remove-orphans` (tum volume'ler silindi, `docker volume ls |
grep tutanak-app` bos dogrulandi) + `.env` silinip `cp .env.example .env` ile yeniden
olusturuldu + `docker compose up -d` (tek komut, `--no-cache` GEREKMEDI — bu turda
`apps/api/Dockerfile`'a dokunulmadi) ile sifirdan ayaga kalkti. Ardindan PRD'deki 11
kullanici hikayesinin (H-01..H-11) TAMAMI, **repoda kurulu bir `webapp-testing` skill'i
veya proje-ici Playwright bagimliligi bulunmadigindan**, gercek API cagrilariyla (curl,
gercek 2400x3200px JPEG dosyasi, gercek PDF indirme + projenin KENDI `test/pdf-text.ts`
yardimcisiyla PDF icerigi karakter-seviyesinde cozumlenerek) baştan sona dogrulandi.
Web arayuzu HTTP seviyesinde (SPA kabuk/route/manifest sunumu) ve **kaynak koddaki tam
dize eslesmesiyle** (H-002'nin kabul kriterlerindeki birebir dizeler) capraz dogrulandi;
ayrica `apps/web` ve `apps/api` workspace test paketlerinin TAMAMI bu CANLI ortamdan
BAGIMSIZ, ayni HEAD uzerinde calistirilarak (448+386+74 test, TUMU PASS) tarayici-seviyesi
render davranisi icin destekleyici kanit toplandi (bkz. Bolum 6 — sinirlama notu).

**H-001/H-002'ye ozel canli kanit:** Gercek bir tutanak PDF'i (fotografli + onayli) indirilip
projenin kendi `apps/api/test/pdf-text.ts` (`/ToUnicode` CMap cozumleyici, glif-numarasindan
karaktere) yardimciyla okundu. Cikti, hicbir bozulma OLMADAN: `"Şişli Çağlayan - Giriş
Teslimi"`, `"Not: Işık düğmesi kırık, mutfak çıkışı temiz"`, `"Fotoğraf tarihi: ..."`,
`"Taraf onayı"`, `"Onaylayan: ..."`, `"Onay tarihi: ..."` satirlarini tasidi. Bu, PDFKit'in
glif-numarali (Identity-H) akisini "metin var gibi gorunuyor" seklinde yanlis
pozitiflemeden, GERCEK karakterlerin dogru cozuldugunu kanitlar.

**H-003'e ozel kanit:** API seviyesinde `checkout` → webhook ONCESI `GET /me` ile
`subscription.status:"pending"` dogrulandi (yoklamanin/yenilemenin gormesi gereken ARA
durum), webhook SONRASI `"active"`'e gectigi dogrulandi. Web tarafindaki yoklama/zaman
asimi DAVRANISI (artan aralikli polling, "Durumu yenile" eylemi, mesaj) tarayici olmadan
canli calistirilamadi (bkz. Bolum 6 sinirlamasi); bu davranis `useSubscriptionAutoRefresh.
spec.tsx` (12 test) ve `SubscriptionPage.spec.tsx` ile bu turda CANLI calistirilip
dogrulandi (component-level, gercek zamanlayicilarla).

40/40 kontrol (11 hikaye + 12 DoD + izolasyon + temiz kurulum + T-026/T-027/T-028/H-001..
H-004 regresyon) PASS. Bu turda FAIL bulunmadi; asagida bir kapsam-boslugu bulgusu (FAIL
degil, seffaflik icin kayit altina alindi) ve bir test-derinligi sinirlamasi not edildi.

## 1. Temiz Kurulum Provasi
- **Sifir ortamda tek komut kurulum: PASS.** `docker compose down -v --remove-orphans` ile
  `tutanak-app_db-data`, `tutanak-app_minio-data`, `tutanak-app_api-node-modules`,
  `tutanak-app_web-node-modules` volume'lerinin TUMU silindi. `.env` SILINIP `cp
  .env.example .env` ile YENIDEN olusturuldu (README §10 adimi birebir; diff bos
  dogrulandi). `docker compose up -d` → `db` (healthy), `minio`, `minio-init`, `api`,
  `web` sorunsuz basladi (`docker compose ps` → tumu "Up"/"healthy").
- **Bos veritabaninda migration: PASS.** API loglari:
  ```
  1 migration found in prisma/migrations
  Applying migration `20260812000000_init`
  All migrations have been successfully applied.
  3 sablon seed edildi.
  Nest application successfully started
  ```
  `GET http://localhost:3000/health` → `{"status":"ok"}` (200, ~0.004-0.02 sn).
  `GET http://localhost:5173/` → 200 (Vite dev server, SPA kabugu dogru).
- **H-001 build zinciri regresyonu: PASS.** Font dosyalari (DejaVu Sans Regular+Bold)
  yeniden derlenen imajda sorunsuz yuklendi; PDF uretimi hatasiz calisti (asagida).

## 2. Hikaye Bazli Senaryolar
<!-- Repoda kurulu bir `webapp-testing` skill'i veya Playwright bagimliligi yok (bkz.
     Bolum 6). Gercek API cagrilariyla (curl), gercek dosyalarla (2400x3200 JPEG, PDF)
     ve projenin kendi PDF-cozumleme test yardimcisiyla dogrulandi. Ham loglar/dosyalar:
     /tmp/qa-int6/*.json, /tmp/qa-int6/*.pdf, /tmp/qa-int6/photo.jpg. -->

### H-08: Selin — e-posta+sifre ile kayit/giris
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `POST /auth/register` | `201`, kullanici id + e-posta dondu | PASS |
| 2 | Yanlis sifreyle `POST /auth/login` | `401` | PASS |
| 3 | Dogru sifreyle `POST /auth/login` | `200`, gecerli JWT `accessToken` dondu | PASS |
**Hikaye sonucu: PASS**

### H-03 / H-01: Kaan — sablon secip foto+not ile kayit olusturma
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `GET /templates` | 3 hazir sablon dondu (`move_in_out`, `meter_fixture`, `periodic_check`) | PASS |
| 2 | `POST /reports` (sablon + Turkce baslik "Şişli Çağlayan - Giriş Teslimi" + not) | `201`, `status:"draft"` | PASS |
| 3 | Gercek 2400x3200 px JPEG dosyasi ureten script ile `POST /reports/:id/photos` | `201`, foto kaydedildi, `widthPx/heightPx:1200/1600` (T-026 sunucu-tarafi kucultme hala aktif) | PASS |
**Hikaye sonucu: PASS**

### H-02: Kaan — otomatik, degistirilemez tarih/saat damgasi
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `POST /reports/:id/photos` govdesine sahte `capturedAt:"2000-01-01T00:00:00.000Z"` eklendi | Sunucu yaniti: `capturedAt` sunucunun KENDI saatiydi (`2026-08-18T07:07:26.619Z`), sahte deger YOK SAYILDI | PASS |
**Hikaye sonucu: PASS**

### H-04: Kaan — PDF indirme (+ H-001/H-002 canli dogrulamasi, bu turun odagi)
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `GET /reports/:id/pdf` | `200`, 782.987 bayt, `file`: "PDF document, version 1.3, 2 pages" | PASS |
| 2 | Projenin `test/pdf-text.ts` ile PDF metni cozumlendi | 1 gomulu `/Subtype /Image` XObject + 2 `/FontFile` (Regular+Bold, H-001) dogrulandi | PASS |
| 3 | Cozumlenen metin okundu | `"Şişli Çağlayan - Giriş Teslimi"`, `"Not: Işık düğmesi kırık, mutfak çıkışı temiz"`, `"Fotoğraf tarihi: 18.08.2026 10:07:26"` — hicbir bozuk karakter/glif-numarasi kacagi YOK | PASS |
| 4 | Onay sonrasi PDF yeniden indirildi | `"Taraf onayı" / "Onaylayan: ayse.int6@example.com" / "Onay tarihi: 18.08.2026 10:08:01"` dogru Turkce ile goruntulendi (H-07 zinciriyle birlesik dogrulama) | PASS |
**Hikaye sonucu: PASS**

### H-05: Kaan — e-posta/WhatsApp ile paylasma (+ H-002 metin dogrulamasi)
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `POST /reports/:id/share-link` | `url`: `http://localhost:5173/t/<token>`, `whatsAppUrl` decode edildiginde: `"Emlak teslim tutanağını görüntülemek ve onaylamak için: ..."` (dogru Turkce) | PASS |
| 2 | `POST /reports/:id/share-link/email` (RESEND_API_KEY bos, T-023 karari geregi) | `202` + `status:"failed"` + `errorMessage:"E-posta sağlayıcısı gönderimi reddetti."` (H-002 ile duzeltilmis dogru Turkce, ASCII katlanmis DEGIL) | PASS |
**Hikaye sonucu: PASS**

### H-10: Kaan — gecmis tutanaklari listeleme/arama
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | Ikinci bir tutanak olusturuldu (`meter_fixture` sablonu) | `201` | PASS |
| 2 | `GET /reports` | Her iki tutanak listelendi, `total:2` | PASS |
| 3 | `GET /reports?q=Kadikoy` ve `?q=Şişli` (Turkce karakterli arama terimi) | Her ikisi de DOGRU tek kaydi filtreledi | PASS |
**Hikaye sonucu: PASS**

### H-06: Ayse — hesap acmadan link uzerinden goruntuleme
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `GET /public/reports/:shareToken` (Authorization basligi OLMADAN) | `200`, baslik/sablon/not/fotograf/tarih/`disclaimer` alanlari goruntulendi | PASS |
**Hikaye sonucu: PASS**

### H-11: Ayse — onay oncesi "resmi hukuki delil degildir" uyarisi
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | Ayni public yanit okundu | `disclaimer: "Bu tutanak resmi hukuki delil değildir, destekleyici kanıttır."` — dogru Turkce, onay ISTEGINDEN ONCE alaninda mevcut | PASS |
**Hikaye sonucu: PASS**

### H-07: Ayse — tek tikla onay
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `POST /public/reports/:shareToken/approval` (`approverEmail`) | `201`, `approvedAt` sunucu zaman damgasi dondu | PASS |
| 2 | Selin'in tokeniyla `GET /reports/:id` | `status:"approved"`, `approval.approverEmail`+`approvedAt` alanlarina islendi, PDF'e de gomuldu (bkz. H-04 adim 4) | PASS |
**Hikaye sonucu: PASS**

### H-09: Selin — abonelik odemesi
| Adim | Islem | Gozlenen (KANIT) | Durum |
|---|---|---|---|
| 1 | `GET /me` | `subscription.status:"inactive"` | PASS |
| 2 | `POST /billing/checkout` | `201`, `transactionReference`, `checkoutUrl`, `amount:"199.00"` | PASS |
| 3 | Webhook ONCESI `GET /me` | `subscription.status:"pending"` (H-003'un yoklama davranisinin gormesi gereken ara durum, CANLI dogrulandi) | PASS |
| 4 | Sunucu-sunucu webhook simulasyonu (`X-Iyzico-Signature` basligiyla) `POST /billing/webhook` | `200 OK` | PASS |
| 5 | `GET /me` | `subscription.status:"active"`, `199.00 TRY`, `currentPeriodEnd` bir ay ileri | PASS |
**Hikaye sonucu: PASS**

## 3. Hikayeler Arasi Akis Zinciri
- **Zincir 1 (Selin/Kaan persona'si, TEK oturumda uctan uca, gercek API):** kayit → giris
  (yanlis sifre reddi dogrulandi) → sablon sec → baslik+not (Turkce) → olustur → gercek
  2400x3200 JPEG yukle (sahte `capturedAt` reddedildi, sunucu zaman damgasi kullanildi) →
  PDF indir (Turkce metin dogru cozumlendi) → paylas (link+wa.me+e-posta, Turkce metinler
  dogru) → `/reports`'a don → yeni kayit listede → Turkce terimle ara →
  `/subscription` → checkout → pending → webhook → active. **Sonuc: PASS, kesintisiz.**
- **Zincir 2 (Ayse persona'si — Selin'in URETTIGI GERCEK linkle, hesap YOK):** paylasim
  linki → uyari metni (disclaimer) okundu → e-posta girildi → onaylandi → Selin'in
  tokeniyla API'de `"approved"` + `approval` alanlari dogrulandi → PDF'e onay bilgisi
  gomuldu. **Sonuc: PASS.**
- **Zincir 3 (izolasyon, Kaan-B persona'si):** Yeni bir hesap acildi, Selin'in tutanagina
  hem listeleme hem dogrudan API'den (GET/PDF/share-link/photo-upload) erisim denendi.
  **Sonuc: PASS — her vektorde reddedildi** (bkz. Bolum 5).
- **Zincir 4 (odeme — sunucu-sunucu, ara durum dahil):** `checkout` → `pending` ara-durum
  dogrulamasi → simule webhook → `active` + tutar/tarih capraz dogrulama; B kullanicisinin
  aboneligi A'nin odemesinden ETKILENMEDI (bagimsiz, `inactive` kaldi). **Sonuc: PASS.**
- **Zincir 5 (H-001..H-004 hotfix regresyon zinciri — bu turun asil odagi):** temiz build
  (deps override ile audit kapisi acik) → Turkce baslikli/notlu kayit olustur → foto yukle
  (sunucu-tarafi 1200x1600 kucultme, T-026, hala aktif) → PDF indir (H-001 gomulu font +
  H-002 duzeltilmis etiketler BIRLIKTE, tek bir PDF'te, HICBIR bozulma OLMADAN) → paylas
  (H-002 duzeltilmis e-posta/whatsapp metinleri) → onayla (H-002 duzeltilmis disclaimer) →
  PDF'e onay bilgisi ISLENDI (H-002 duzeltilmis "Taraf onayı" etiketleriyle) → odeme
  (H-003'un yoklamasinin gormesi gereken `pending` ara-durumu API'de dogrulandi). Iki
  bagimli hotfix'in (H-001 → H-002 PDF-etiket alt-kismi) siralamasi CANLI PDF ciktisinda
  dogrulandi: font GERCEKTEN Turkce karakterleri tasiyor, etiketler GERCEKTEN Turkce.
  H-004'un masaustu CSS degisikligi mobil yerlesimi (`.page` kirilma noktasi `md`=768px
  ALTINDA devreye girmiyor) etkilemedi; web workspace test paketindeki
  `app-layout.spec.ts` (26 test) bu turda CANLI calistirilip dogrulandi. **Sonuc: PASS,
  hicbir dikis bozulmadi.**

## 4. Definition of Done Kontrolu
| DoD maddesi | Durum | Kanit |
|---|---|---|
| Kullanici e-posta+sifre ile kayit olup giris yapabiliyor | **PASS** | H-08, gercek API |
| Kullanici 3 hazir sablondan birini secebiliyor | **PASS** | H-03, `GET /templates` 3 kayit |
| Kullanici sablonda baslik+foto+not ile kayit olusturabiliyor | **PASS** | H-01/H-02 |
| Her kayda otomatik, degistirilemez tarih-saat damgasi ekleniyor | **PASS** | H-02 — sahte `capturedAt` reddedildi |
| Tamamlanan tutanak PDF olarak indirilebiliyor | **PASS** | H-04 — gercek indirilen dosya + Turkce metin cozumlemesi |
| Tutanak e-posta/WhatsApp linkiyle paylasilabiliyor | **PASS** | H-05 — link+wa.me calisiyor (dogru Turkce), e-posta belgelendigi gibi `failed` |
| Karsi taraf hesap acmadan linkten tutanagi goruntuleyebiliyor | **PASS** | H-06 |
| Karsi taraf tek tikla onaylayabiliyor; damga+kimlik PDF'e isleniyor | **PASS** | H-07 — API'de `status:"approved"` VE PDF metninde "Onaylayan/Onay tarihi" dogrulandi |
| Onay ekraninda "resmi hukuki delil degildir" uyarisi gorunuyor | **PASS** | H-11 — dogru Turkce (`değildir`, `kanıttır`) |
| Kullanici gecmis tutanaklarini listeleyip arayabiliyor | **PASS** | H-10 — Turkce karakterli arama terimiyle de dogrulandi |
| Kullanici abonelik odemesi yapabiliyor, durum hesabina yansiyor | **PASS** | H-09 — `pending` ara-durumu + webhook sonrasi `active` |
| Uygulama mobil tarayicida kamera erisimiyle calisiyor (PWA) | **PASS** | `manifest.webmanifest` 200 dondu; `PhotoCaptureInput.tsx` icinde `capture="environment"` + `accept="image/*"` dogrulandi (kod-seviyesi; gercek mobil tarayici/donanim bu turda kullanilmadi, bkz. Bolum 6) |

**12 maddeden 12'si PASS.**

## 5. Coklu Kullanici Izolasyonu
- **Test:** Selin (Kullanici A) foto+PDF+paylasim linkli+onayli bir tutanak olusturdu.
  Kaan-B (farkli, yeni kayit olmus Kullanici B) ayni sisteme kayit oldu ve A'nin tutanagina
  dogrudan API'den erismeyi/degistirmeyi denedi.
- **`GET /reports` (liste):** B'nin listesi **BOS** (`total:0`), A'nin tutanagi GORUNMUYOR.
- **`GET /reports/:id`** → **403 FORBIDDEN**
- **`GET /reports/:id/pdf`** → **403 FORBIDDEN**
- **`POST /reports/:id/share-link`** → **403 FORBIDDEN**
- **`POST /reports/:id/photos`** (B, A'nin tutanagina foto EKLEMEYE calisti) → **403 FORBIDDEN**
- **Odeme izolasyonu:** A'nin aboneligi `active` olduktan sonra B'nin `GET /me` yaniti hala
  `subscription.status:"inactive"` — hesaplar arasi sizinti yok.
- **A kullanicisi B'nin verisine erisebiliyor mu: HAYIR (PASS)** — yetkilendirme sahiplik
  bazli, TUM vektorlerde (okuma, PDF, paylasim uretme, foto yazma, odeme) tutarli izolasyon
  dogrulandi.

## 6. FAIL'ler Icin Yeniden Acilmasi Onerilen Ticketlar
| Bulgu | Onerilen ticket(lar) | Gerekce |
|---|---|---|
| Yok — bu turda FAIL bulunmadi | — | 40/40 kontrol (11 hikaye + 12 DoD + izolasyon + temiz kurulum + H-001..H-004 regresyon) PASS. |

**Kapsam-boslugu bulgusu (FAIL degil, seffaflik icin kayit altina alindi):** H-002'nin
kapsami acikca `apps/web/src` ve `apps/api/src` ile sinirliydi (ticket metninde birebir
yazili); bu nedenle asagidaki iki yuzey H-002'den SONRA da hala ASCII'ye katlanmis Turkce
tasiyor ve bu turda GERCEKTEN gozlemlendi:
- **Sablon adlari/aciklamalari** (`prisma/seed.ts`, `apps/api/src` DISINDA) — `GET
  /templates` yaniti `"Giris/Cikis Teslim Tutanagi"`, `"Sayac/Demirbas Tespiti"`,
  `"Periyodik Durum Kontrolu"` doner (Turkce karakter yok). Bu metin, PDF ciktisinda
  `Şablon: Giris/Cikis Teslim Tutanagi` seklinde H-002 ile duzeltilmis diger tum
  etiketlerin (Şişli Çağlayan, Işık düğmesi, Fotoğraf tarihi...) YANINDA, tutarsiz
  sekilde gorunuyor — kullanicinin gozune GORUNEN, karma (yarim duzeltilmis) bir PDF.
- **PWA manifest metinleri** (`apps/web/public/manifest.webmanifest`, `apps/web/src`
  DISINDA) — `name`/`description` alanlari ASCII katlanmis (`"Emlak Teslim Tutanagi"`).
  `index.html`'deki `<title>` ve `<meta name="description">` de ayni kaynaktan (statik
  dosya) geldigi icin ayni sekilde ASCII.

Bu iki nokta PRD'nin DoD listesinde birebir bir madde OLMADIGI (DoD karakter kodlamasi
belirtmiyor) ve H-002 ticketinin acikca "kapsam disi degil ama dosya yolu ile sinirli"
tanimladigi dosyalarin DISINDA kaldigi icin bu turun SONUCUNU FAIL'e cevirmiyor. Ancak
B-002 bulgusunun ("kullaniciya donuk HER ekran/dize") orijinal genisligini tam
karsilamiyor ve PDF'te kullanicinin gorebilecegi karma bir sonuc birakiyor. **Oneri:**
yeni bir hotfix ticket (orn. H-005) `prisma/seed.ts` sablon adlari/aciklamalari ve
`apps/web/public/manifest.webmanifest` + `index.html` statik meta metinleri icin acilsin;
orkestrator/insan karari.

**Test-derinligi sinirlamasi (FAIL degil, kanit turu notu):** Repoda kurulu bir
`webapp-testing` skill'i veya proje-ici Playwright bagimliligi bulunmuyor (`node_modules/
.bin` ve `apps/*/node_modules/.bin` tarandi, sonuc bos). Bu tur, urun davranisini gercek
API cagrilariyla + projenin kendi PDF-cozumleme yardimcisiyla + web workspace test
paketinin (448 test, jsdom render, gercek zamanlayicilar) bu HEAD uzerinde CANLI
calistirilmasiyla dogruladi; ancak gercek bir tarayicida tiklama/dokunma/kamera-erisimi
DAVRANISI (piksel-seviyesi render, gercek DOM olaylari) bu turda GOZLEMLENMEDI. Bu bir
FAIL degil — sinyal yeterince guclu (API + PDF + component testleri UCU birlestiginde
davranis zinciri tutarli) — ancak sonraki bir turda `webapp-testing` skill'i veya
Playwright kurulursa daha guclu (gercek tarayici) kanit onerilir; bu bir kapasite notu,
orkestrator icin izlenmesi onerilir.

**Perf/gozlem notlari (FAIL sayilmayan, erken sinyal — perf-agent icin):**
- Bu QA turu derin p95/eszamanlilik olcumu yapmadi (perf-agent'in isi, release-prep'te
  kosar). Tum HTTP yanitlari gozle gorulur sekilde hizliydi (`/health` 0.004-0.02 sn), 10
  saniyelik "bariz sorun" esiginin cok altinda.
- `docker stats`: api 363MB, web 243MB, db 32MB, minio 75MB — hepsi normal, onceki tura
  (integration:5: api 374MB, web 216MB) gore anlamli bir sapma yok; bariz bir bellek
  patlamasi gozlenmedi.

**Ortam notu:** Bu tur, yerel `main`'in GUNCEL HEAD'i (`5f86403`) uzerinde, hicbir
tarball/checkout is-around'u GEREKMEDEN kosuldu. Test sonrasi `docker compose down` ile
konteynerler durduruldu (volume'ler bu tur SONUNDA bosaltilmadi; bir sonraki QA turu kendi
temiz-kurulum adiminda `-v` ile sifirlayacaktir). Ham kanit dosyalari: `/tmp/qa-int6/*.json`,
`/tmp/qa-int6/report.pdf`, `/tmp/qa-int6/report-approved.pdf`, `/tmp/qa-int6/photo.jpg`,
`/tmp/qa-int6/jest-{root,web,api}.log` (bu oturuma ait gecici alan).
