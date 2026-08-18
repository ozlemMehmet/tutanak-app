# API.md — Tutanak API

Bu doküman `apps/api/src` altındaki gerçek controller'lardan üretildi ve her örnek,
çalışan uygulamaya karşı **gerçekten koşulup** yanıtı yapıştırılarak doğrulandı
(`main`, commit `5f86403` — T-028 + H-001..H-004 dahil, tüm 19 endpoint bu revizyonda
da mevcut; endpoint listesi/yolları/HTTP durumları H-001..H-004 ile **değişmedi**,
doğrulandı — bkz. ARCHITECTURE.md §7.12, §7.14, §7.15).
`factory/04-architecture/api-contract.yaml` (OpenAPI) ile karşılaştırma **"Sözleşmeden
sapmalar"** bölümündedir.

**Bu revizyonda değişen tek şey hata/mesaj metinlerinin içeriğidir (H-002):**
kullanıcıya dönen tüm hata mesajları, e-posta içeriği, PDF etiketleri ve ödeme sepeti
adı artık **tam aksanlı Türkçe** basılıyor (önceki revizyonlarda ASCII'ye katlanmıştı,
örn. `"Girdi dogrulanamadi."` → `"Girdi doğrulanamadı."`). Aşağıdaki tüm örnekler bu
revizyonda yeniden çalıştırılıp güncel çıktıyla değiştirildi. **Tek istisna:** üç sabit
şablon adı (`GET /templates`) hâlâ ASCII'ye katlanmıştır — bu, H-002'nin kapsamı
dışında kalan, ayrıca doğrulanmış ve kayıt altına alınmış açık bir bulgudur (bkz.
"templates" bölümü ve README.md "Bilinen sınırlamalar").

- Taban adres: `http://localhost:3000/api/v1` (yerel). `GET /health` bu önekin
  **dışındadır**: `http://localhost:3000/health`.
- Aksi belirtilmedikçe her endpoint `Authorization: Bearer <accessToken>` ister.
  `/auth/*` ve `/public/*` altındaki endpoint'ler kimlik doğrulama **istemez**.
- Tüm hata yanıtları tek tip zarf kullanır:
  ```json
  { "error": { "code": "STRING", "message": "insan tarafından okunabilir metin", "details": [{ "field": "...", "message": "..." }], "traceId": "uuid" } }
  ```
  `details` yalnızca `VALIDATION_ERROR` ve `EMAIL_ALREADY_REGISTERED`'da doldurulur.
- İstek gövdeleri katıdır: sözleşmede tanımsız bir alan `400 VALIDATION_ERROR` üretir.
  **İki istisna** vardır: fotoğraf yükleme (`file` dışındaki alanlar sessizce yok
  sayılır) ve `POST /billing/webhook` (sağlayıcı alanları sessizce ayıklanır).
- Sorgu parametreleri de aynı katılığa tabidir: tanımsız bir `?query=...` da
  `400 VALIDATION_ERROR` üretir.
- Tüm endpoint'ler bellek içi hız sınırına tabidir; sayaç **her zaman istemci IP'sine**
  göre tutulur (kimlik doğrulanmış uçlarda bile kullanıcı bazlı değildir — global
  `ClientIpThrottlerGuard`, `JwtAuthGuard`'dan önce çalışır): varsayılan 300 istek/dk/IP,
  `/auth/register` ve `/auth/login` 5 istek/dk/IP; aşımda `429 RATE_LIMIT_EXCEEDED`.

## Hata kodları (tam liste)

`apps/api/src/common/errors/app-error.ts`'teki `ErrorCode` birleşik tipiyle birebirdir:

| Kod | HTTP | Anlamı |
|---|---|---|
| `VALIDATION_ERROR` | 400 | Gövde/sorgu doğrulaması başarısız |
| `UNSUPPORTED_MEDIA_FORMAT` | 400 | Fotoğraf JPEG/PNG/WEBP değil |
| `FILE_TOO_LARGE` | 400 | Fotoğraf `PHOTO_MAX_BYTES`'ı aşıyor |
| `REPORT_HAS_NO_PHOTOS` | 400 | Fotoğrafsız tutanaktan PDF istendi |
| `UNAUTHENTICATED` | 401 | Token yok/geçersiz |
| `INVALID_CREDENTIALS` | 401 | E-posta/şifre hatalı |
| `INVALID_WEBHOOK_SIGNATURE` | 401 | Webhook imza başlığı yok/geçersiz |
| `FORBIDDEN` | 403 | Kaynak başka kullanıcıya ait |
| `NOT_FOUND` | 404 | Kaynak yok |
| `TEMPLATE_NOT_FOUND` | 404 | Şablon id geçersiz |
| `SHARE_LINK_NOT_FOUND` | 404 | Token geçersiz veya link hiç üretilmemiş |
| `EMAIL_ALREADY_REGISTERED` | 409 | Kayıtta e-posta zaten var |
| `REPORT_ALREADY_APPROVED` | 409 | Onaylı tutanağa fotoğraf eklenmeye/ikinci onay yapılmaya çalışıldı |
| `PHOTO_LIMIT_REACHED` | 409 | `PHOTO_MAX_PER_REPORT` aşıldı |
| `SUBSCRIPTION_ALREADY_ACTIVE` | 409 | Zaten aktif abonelik için checkout denendi |
| `STORAGE_UNAVAILABLE` | 502 | Obje depolama (R2/MinIO) erişilemedi |
| `PAYMENT_PROVIDER_ERROR` | 502 | Ödeme sağlayıcısına ulaşılamadı |
| `RATE_LIMIT_EXCEEDED` | 429 | Hız sınırı aşıldı |
| `INTERNAL_ERROR` | 500 | Beklenmeyen hata (detay sızdırılmaz) |

---

## Altyapı

### `GET /health`

Konteyner sağlık kontrolü. `/api/v1` önekinin **dışındadır**, kimlik doğrulama istemez.
İstemci (web uygulaması) bunu çağırmaz.

```bash
curl -s http://localhost:3000/health
```
```json
{"status":"ok"}
```

---

## auth

### `POST /auth/register`

Yeni kullanıcı kaydı. Auth **gerektirmez**. Şifre `bcrypt` (cost 10) ile hash'lenir;
düz metin hiçbir yerde saklanmaz/loglanmaz. **Token döndürmez** — kayıttan sonra ayrıca
giriş yapılmalıdır.

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"selin@example.com","password":"Passw0rd!123"}'
```
```json
{"id":"b441cfa4-c7b7-4714-92e9-81341a68963d","email":"selin@example.com","createdAt":"2026-08-18T07:15:57.778Z"}
```

Doğrulama kuralları: `email` geçerli e-posta biçimi, ≤254 karakter; `password` 8-128
karakter arası **herhangi bir** metin (özel karakter zorunluluğu yok).

Hata — e-posta zaten kayıtlı (`409`):
```json
{"error":{"code":"EMAIL_ALREADY_REGISTERED","message":"Bu e-posta zaten kayıtlı.","details":[{"field":"email","message":"bu e-posta zaten kayıtlı"}],"traceId":"f801ee87-c3b4-4a22-be0e-fa1a927097c9"}}
```

Hata — doğrulama (`400`):
```json
{"error":{"code":"VALIDATION_ERROR","message":"Girdi doğrulanamadı.","details":[{"field":"email","message":"geçerli bir e-posta adresi giriniz"},{"field":"password","message":"parola en az 8 karakter olmalıdır"}],"traceId":"c3d678f5-0688-48f1-baa2-6d9e95635c75"}}
```

### `POST /auth/login`

```bash
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"selin@example.com","password":"Passw0rd!123"}'
```
```json
{"accessToken":"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...","expiresIn":604800,"user":{"id":"b441cfa4-c7b7-4714-92e9-81341a68963d","email":"selin@example.com","createdAt":"2026-08-18T07:15:57.778Z"}}
```

`expiresIn` saniye cinsindendir (`JWT_EXPIRES_IN=7d` → 604800). Token `localStorage`'da
saklanır, refresh token yoktur — süre dolunca yeniden giriş gerekir.

Hata — hatalı kimlik bilgisi (`401`, hem yanlış şifre hem yok e-posta için **aynı** kod ve
mesaj — kullanıcı numaralandırmasını önlemek için):
```json
{"error":{"code":"INVALID_CREDENTIALS","message":"E-posta veya parola hatalı.","traceId":"1d5d6c73-81d4-4ce3-a77a-37cc6e68f7c6"}}
```

---

## me

### `GET /me`

Oturum sahibinin profili + güncel abonelik durumu. `subscription` alanı **her zaman**
doludur; kullanıcının hiç abonelik satırı yoksa (checkout hiç çağrılmadıysa) varsayılan
nesne döner (`status: "inactive"`, `priceAmount: null`). Bu endpoint asla abonelik satırı
**oluşturmaz**.

```bash
curl -s http://localhost:3000/api/v1/me -H "Authorization: Bearer $TOKEN"
```
```json
{"id":"b441cfa4-...","email":"selin@example.com","createdAt":"2026-08-18T07:15:57.778Z","subscription":{"status":"inactive","priceAmount":null,"currency":"TRY","currentPeriodEnd":null}}
```

Hata — token yok (`401`):
```json
{"error":{"code":"UNAUTHENTICATED","message":"Bu işlem için oturum açmanız gerekiyor.","traceId":"25195bf5-7ae8-4320-b8dd-e37647b070b1"}}
```

---

## templates

Auth **gerektirir** (genel/public değildir).

### `GET /templates`

```bash
curl -s http://localhost:3000/api/v1/templates -H "Authorization: Bearer $TOKEN"
```
```json
[
  {"id":"b80c7545-...","code":"move_in_out","name":"Giris/Cikis Teslim Tutanagi","description":"Kiraci giris veya cikis teslimi sirasinda mulkun genel durumunun foto ve notlarla kayit altina alinmasi."},
  {"id":"4791ec79-...","code":"meter_fixture","name":"Sayac/Demirbas Tespiti","description":"Elektrik, su, dogalgaz sayac degerleri ve mulkte birakilan demirbaslarin tespiti."},
  {"id":"f6e535e0-...","code":"periodic_check","name":"Periyodik Durum Kontrolu","description":"Kira donemi icinde yapilan periyodik mulk durum kontrolunun belgelenmesi."}
]
```

Her zaman **tam olarak bu 3 kayıt** döner (seed idempotent, sabit); MVP'de kullanıcı
tanımlı şablon yoktur.

> **Bilinen sınırlama:** `name`/`description` alanları hâlâ ASCII'ye katlanmış Türkçe
> döner (`Giris/Cikis` — `ş,ğ,ı,ç,ö,ü` yok). H-002 (arayüz/API metinlerini tam aksanlı
> Türkçe'ye çevirme) kaynak kodun tamamını (`apps/api/src`, `apps/web/src`) kapsadı ama
> `apps/api/prisma/seed.ts` bu kapsamın **dışında** kaldı; bu, teslim sonrası açık bir
> hata olarak kayıtlıdır (`factory/bugs/B-005.md`, henüz düzeltilmedi). Diğer tüm
> kullanıcıya dönük metinler (aşağıdaki tüm hata mesajları, PDF etiketleri, e-posta
> içeriği) tam aksanlıdır.

### `GET /templates/{templateId}`

```bash
curl -s http://localhost:3000/api/v1/templates/b80c7545-856c-4ac6-a2de-a4857c06d211 \
  -H "Authorization: Bearer $TOKEN"
```
```json
{"id":"b80c7545-...","code":"move_in_out","name":"Giris/Cikis Teslim Tutanagi","description":"..."}
```

---

## reports

Auth gerektirir; her endpoint yalnızca **isteği yapan kullanıcının kendi** tutanaklarına
erişebilir — başka kullanıcının kaynağına erişim `403 FORBIDDEN` döner (doğrulandı,
aşağıda).

### `POST /reports`

Taslak oluşturur. `title` 1-200 karakter zorunlu, `note` ≤5000 karakter opsiyonel
(gönderilmezse `""`).

```bash
curl -s -X POST http://localhost:3000/api/v1/reports \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"templateId":"b80c7545-856c-4ac6-a2de-a4857c06d211","title":"Ornek Daire - Giris Tutanagi","note":"Salon duvarinda kucuk bir cizik var."}'
```
```json
{"id":"30711e4e-...","templateId":"b80c7545-...","templateName":"Giris/Cikis Teslim Tutanagi","title":"Ornek Daire - Giris Tutanagi","note":"Salon duvarinda kucuk bir cizik var.","status":"draft","photoCount":0,"createdAt":"2026-08-18T07:16:08.751Z","updatedAt":"2026-08-18T07:16:08.751Z"}
```

`status` yaşam döngüsü: `draft` → (`share-link` üretilince) `shared` → (onaylanınca)
`approved`. Geri dönüş yoktur; hiçbir endpoint durumu doğrudan değiştirmez.

### `GET /reports`

Sayfalı liste + arama. Sorgu parametreleri: `q` (≤100 karakter, boşsa filtre yok),
`page` (varsayılan 1), `pageSize` (varsayılan 20, ≤50). **Sözleşmede tanımsız bir
parametre (`?limit=5` gibi) `400 VALIDATION_ERROR` üretir** — doğrulandı:

```bash
curl -s "http://localhost:3000/api/v1/reports?limit=5" -H "Authorization: Bearer $TOKEN"
# {"error":{"code":"VALIDATION_ERROR","message":"Girdi doğrulanamadı.","details":[{"field":"limit","message":"property limit should not exist"}],"traceId":"..."}}

curl -s "http://localhost:3000/api/v1/reports?page=1&pageSize=5" -H "Authorization: Bearer $TOKEN"
```
```json
{"items":[{"id":"30711e4e-...","templateId":"b80c7545-...","templateName":"Giris/Cikis Teslim Tutanagi","title":"Ornek Daire - Giris Tutanagi","note":"...","status":"draft","photoCount":1,"createdAt":"...","updatedAt":"..."}],"page":1,"pageSize":5,"total":1}
```

`q` arar (`title`/`note` içinde, `ILIKE` tabanlı), sıralama her zaman `created_at DESC`.

### `GET /reports/{reportId}`

```bash
curl -s http://localhost:3000/api/v1/reports/30711e4e-31ee-41b9-a481-08d5203e2ddb \
  -H "Authorization: Bearer $TOKEN"
```
```json
{"id":"30711e4e-...","templateId":"b80c7545-...","templateName":"Giris/Cikis Teslim Tutanagi","title":"Ornek Daire - Giris Tutanagi","note":"...","status":"draft","photoCount":1,"createdAt":"...","updatedAt":"...","photos":[{"...":"..."}]}
```

Hata — başka kullanıcının tutanağı (`403`, veri sızdırmaz):
```json
{"error":{"code":"FORBIDDEN","message":"Bu tutanağa erişim yetkiniz yok.","traceId":"cda0deb2-ec00-4654-86d1-0b1652c5474b"}}
```

Hata — var olmayan id (`404`):
```json
{"error":{"code":"NOT_FOUND","message":"Tutanak bulunamadı.","traceId":"21f280c4-b161-4635-87b4-9feb4ae29eaf"}}
```

### `GET /reports/{reportId}/pdf`

Tutanağı `application/pdf` olarak döner (tam üretildikten sonra tek parça; yarım dosya
stream edilmez). Fotoğrafsız tutanakta `400 REPORT_HAS_NO_PHOTOS`.

```bash
curl -s -D - -o rapor.pdf "http://localhost:3000/api/v1/reports/30711e4e-.../pdf" \
  -H "Authorization: Bearer $TOKEN"
```
```
HTTP/1.1 200 OK
Content-Type: application/pdf
Content-Disposition: attachment; filename="tutanak-30711e4e-31ee-41b9-a481-08d5203e2ddb.pdf"
Content-Length: 16143
```
(doğrulandı: `file rapor.pdf` → `PDF document, version 1.3, 2 pages`. Dosya boyutu
önceki revizyona göre büyüdü — **H-001** ile PDF artık gömülü bir Unicode TrueType
fontu (DejaVu Sans/Bold, `ş ğ ı Ş İ` dahil) taşıyor; önceden standart WinAnsi fontu
kullanıldığı için Türkçe'ye özgü harfler PDF çıktısında bozuk basılıyordu — bkz.
ARCHITECTURE.md §7.6.)

Hata — fotoğrafsız tutanak (`400`):
```json
{"error":{"code":"REPORT_HAS_NO_PHOTOS","message":"PDF oluşturmak için tutanakta en az bir fotoğraf olmalıdır; önce fotoğraf ekleyin.","traceId":"1e177b91-4195-4b43-b517-1e2695d1563d"}}
```

---

## photos

Auth gerektirir; `multipart/form-data`, alan adı zorunlu olarak `file`. Onaylı tutanakta
(`status: approved`) yükleme **reddedilir** (kanıt bütünlüğü kuralı).

### `POST /reports/{reportId}/photos`

```bash
curl -s -X POST "http://localhost:3000/api/v1/reports/30711e4e-.../photos" \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@foto.jpg;type=image/jpeg"
```
```json
{"id":"c0346cd9-...","reportId":"30711e4e-...","capturedAt":"2026-08-18T07:16:30.032Z","contentType":"image/png","sizeBytes":95,"widthPx":4,"heightPx":4,"url":"http://localhost:9000/tutanak-photos/reports/.../....png?X-Amz-Algorithm=...&X-Amz-Signature=..."}
```

`capturedAt` **sunucuda** üretilir; istemciden gönderilen `file` dışındaki hiçbir alan
okunmaz (multipart gövdesinde bu tek istisnadır — ek alanlar 400 üretmez, sessizce
yok sayılır). `url` MinIO/R2'ye 15 dakika (`PRESIGNED_URL_TTL_SECONDS`) geçerli
ön-imzalı bir okuma linkidir.

**Depoya yazılmadan önce yeniden boyutlandırılır (T-026):** uzun kenarı 1600 pikseli aşan
fotoğraflar, depoya yazılmadan önce sunucuda oranı korunarak 1600 piksele küçültülür
(`fit: inside, withoutEnlargement: true` — küçük görsel büyütülmez); EXIF yönlendirmesi
küçültmeden **önce** uygulanır. Yanıttaki `widthPx`/`heightPx` **küçültülmüş** (depoya
yazılan) ölçüleri yansıtır, orijinal çözünürlük hiçbir yerde saklanmaz. Bu, PDF
üretiminde de aynı sınırı kullanan tek kaynaklı bir sabittir (`PHOTO_MAX_EDGE_PX`,
`apps/api/src/modules/photos/photo-image.processor.ts`).

**İstemci (PWA) de aynı sınırı ayrıca uygular (T-028):** resmi web istemcisi, bu
endpoint'e istek yapmadan **önce** tarayıcıda uzun kenarı 1600 piksele küçültür
(`apps/web/src/features/photos/downscale-photo.ts`) — amaç sahadan yüklenen 5-6 MB'lik
karelerde yükleme süresini kısaltmaktır, bu bir güvenlik/doğruluk katmanı değildir ve
istemciye güvenilmez: yukarıdaki sunucu tarafı küçültme, doğrulama ve boyut sınırı
**değişmeden** çalışmaya devam eder. Bu curl örneği ham `foto.jpg`'i doğrudan gönderir
(istemci küçültmesi tarayıcıya özgüdür, `curl`'de yoktur); sunucu davranışı ikisinde de
aynıdır.

Hata — desteklenmeyen dosya türü (`400`, yalnızca JPEG/PNG/WEBP kabul edilir, MIME
beyanı değil dosyanın sihirli baytları kontrol edilir; doğrulandı):
```json
{"error":{"code":"UNSUPPORTED_MEDIA_FORMAT","message":"Yalnızca JPEG, PNG veya WEBP fotoğraf yükleyebilirsiniz.","traceId":"628e3d16-d29b-4f67-9960-7574a5c78827"}}
```

Hata — onaylı tutanağa yükleme (`409`, doğrulandı):
```json
{"error":{"code":"REPORT_ALREADY_APPROVED","message":"Bu tutanak onaylandığı için içeriği dondurulmuştur; yeni fotoğraf eklenemez.","traceId":"d74e9f79-2400-43e6-b8dc-b32d1b3494b0"}}
```

Hata — 30. fotoğraftan sonra (`409`, `PHOTO_MAX_PER_REPORT` varsayılan 30, kaynaktan
doğrulandı — `photos.service.ts`):
```json
{"error":{"code":"PHOTO_LIMIT_REACHED","message":"Bir tutanağa en fazla 30 fotoğraf eklenebilir.","traceId":"..."}}
```

Hata — dosya `PHOTO_MAX_BYTES`'ı aşıyor (`400`, kaynaktan doğrulandı —
`photo-upload-limit.interceptor.ts`):
```json
{"error":{"code":"FILE_TOO_LARGE","message":"Fotoğraf izin verilen boyut sınırını aşıyor.","traceId":"..."}}
```

### `GET /reports/{reportId}/photos`

Sayfalamasızdır (tutanak başına üst sınır 30 olduğu için bilinçli tercih); ön-imzalı
URL'lerle birlikte tüm fotoğrafları döner, sıralama `(sort_order, captured_at)`.

---

## sharing

Auth gerektirir (link **üretimi**; genel **görüntüleme** `public` altındadır, aşağıya
bakın).

### `POST /reports/{reportId}/share-link`

İdempotenttir: mevcut link varsa **aynı token**la döner. Başarılı çağrı `reports.status`'u
`draft` ise `shared`'a geçirir (zaten `shared`/`approved` ise durum korunur).

```bash
curl -s -X POST "http://localhost:3000/api/v1/reports/30711e4e-.../share-link" \
  -H "Authorization: Bearer $TOKEN"
```
```json
{"token":"OTh-i4d7W8CBA0R4NAQvHIHmNp_8G2HxOZSFXdx6zfo","url":"http://localhost:5173/t/OTh-i4d7W8CBA0R4NAQvHIHmNp_8G2HxOZSFXdx6zfo","whatsAppUrl":"https://wa.me/?text=Emlak%20teslim%20tutana%C4%9F%C4%B1n%C4%B1%20g%C3%B6r%C3%BCnt%C3%BClemek%20ve%20onaylamak%20i%C3%A7in%3A%20...","createdAt":"2026-08-18T07:16:30.190Z"}
```
(`whatsAppUrl`'in URL-encode edilmiş metni artık tam aksanlı Türkçe'dir — H-002; çözülmüş
hali: "Emlak teslim tutanağını görüntülemek ve onaylamak için: ...".)

`token` 32 bayt kriptografik rastgele (base64url, tahmin edilemez). `url`, `PUBLIC_APP_URL`
üzerine kurulur.

### `GET /reports/{reportId}/share-link`

Aynı gövdeyi döner; link hiç üretilmemişse `404 SHARE_LINK_NOT_FOUND`.

### `POST /reports/{reportId}/share-link/email`

Link **üretmez** — önce `POST .../share-link` çağrılmış olmalı (yoksa `404
SHARE_LINK_NOT_FOUND`). Gönderim başarısız olsa bile **hata değildir**: `202` + gövdede
`status: "failed"` döner (yerelde `RESEND_API_KEY` boş olduğu için her zaman böyledir,
bkz. FOUND-ISSUES.md).

```bash
curl -s -X POST "http://localhost:3000/api/v1/reports/30711e4e-.../share-link/email" \
  -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"recipientEmail":"kiraci@example.com"}'
```
```json
{"id":"6d3358f2-...","channel":"email","recipientEmail":"kiraci@example.com","status":"failed","errorMessage":"E-posta sağlayıcısı gönderimi reddetti.","createdAt":"2026-08-18T07:17:31.541Z"}
```
(HTTP durumu **202 Accepted** — doğrulandı.)

---

## public (kimlik doğrulama gerektirmez)

Kiracının (Ayşe) hesapsız eriştiği yüzey; token'a dayalı capability linkleridir.

### `GET /public/reports/{shareToken}`

```bash
curl -s "http://localhost:3000/api/v1/public/reports/OTh-i4d7W8CBA0R4NAQvHIHmNp_8G2HxOZSFXdx6zfo"
```
```json
{"title":"Ornek Daire - Giris Tutanagi","templateName":"Giris/Cikis Teslim Tutanagi","note":"Salon duvarinda kucuk bir cizik var.","photos":[{"id":"c0346cd9-...","capturedAt":"2026-08-18T07:16:30.032Z","url":"http://localhost:9000/..."}],"status":"shared","createdAt":"2026-08-18T07:16:08.751Z","isApproved":false,"disclaimer":"Bu tutanak resmi hukuki delil değildir, destekleyici kanıttır."}
```

`disclaimer` metni sabittir ve H-11 kabul kriterinin karşılığıdır; artık tam aksanlı
Türkçe basılır (H-002 — önceki revizyonlarda `degildir`/`kanittir` idi). Onaylı bir
tutanakta yanıta ayrıca `"approval": {"id":"...","approverEmail":"...","approvedAt":"..."}`
alanı eklenir (nesne alanları `null` değil, **yoklukla** ifade edilir).

Hata — geçersiz/var olmayan token (`404`):
```json
{"error":{"code":"SHARE_LINK_NOT_FOUND","message":"Bu bağlantı geçersiz veya artık kullanılmıyor.","traceId":"f1334034-f6fe-4bfa-92ba-314d378f4bc1"}}
```

### `POST /public/reports/{shareToken}/approval`

Tek tıkla onay. Gövde: `{ "approverEmail": "string" }`.

```bash
curl -s -X POST "http://localhost:3000/api/v1/public/reports/OTh-i4d7W8CBA0R4NAQvHIHmNp_8G2HxOZSFXdx6zfo/approval" \
  -H 'Content-Type: application/json' -d '{"approverEmail":"kiraci@example.com"}'
```
```json
{"id":"ec8644dc-...","approverEmail":"kiraci@example.com","approvedAt":"2026-08-18T07:17:31.611Z"}
```
(HTTP **201 Created**.) Onaydan sonra `reports.status` `approved`'a geçer ve tutanağın
içeriği (fotoğraflar) dondurulur — bir daha fotoğraf eklenemez.

Hata — mükerrer onay (`409`, DB unique kısıtı garantisi; ikinci onay kaydı **oluşmaz**;
doğrulandı):
```json
{"error":{"code":"REPORT_ALREADY_APPROVED","message":"Bu tutanak zaten onaylanmış; ikinci bir onay kaydedilmez.","traceId":"6208a290-192f-4ab6-9f16-be46341ef903"}}
```

---

## billing

### `POST /billing/checkout`

Auth gerektirir. Kullanıcının `subscriptions` satırını "get-or-create" ile oluşturur/bulur
ve durumu `pending`'e taşır. Zaten `active` bir abonelik için `409
SUBSCRIPTION_ALREADY_ACTIVE`.

```bash
curl -s -X POST http://localhost:3000/api/v1/billing/checkout -H "Authorization: Bearer $TOKEN"
```
```json
{"transactionReference":"fake-42e5f7aa-2fe4-4d44-8b97-2a01779864f0","checkoutUrl":"http://localhost:5173/subscription?checkout=return&ref=fake-42e5f7aa-2fe4-4d44-8b97-2a01779864f0","amount":"199.00","currency":"TRY"}
```

`PAYMENT_PROVIDER=fake` (yerel varsayılan) iken `checkoutUrl` doğrudan
`PUBLIC_APP_URL`'e döner; üretimde (`PAYMENT_PROVIDER=iyzico`) gerçek iyzico Checkout
Form adresidir. iyzico'nun ödeme sayfasında görünen sepet kalemi adı (`iyzico-payment.
adapter.ts`) H-002 ile `"Aylik abonelik"`ten `"Aylık abonelik"`e düzeltildi — bu alan bu
API'nin gövdesinde görünmez, yalnızca sağlayıcının kendi ödeme ekranında görünür.

### `POST /billing/webhook`

Auth gerektirmez (`@Public()`), ama **imza zorunludur** (`X-Iyzico-Signature` başlığı).
Gövde sağlayıcıya aittir — DTO/whitelist uygulanmaz, tanınmayan alanlar sessizce
ayıklanır, yalnızca `providerReference` + `status` (`succeeded`\|`failed`) zorunludur.
İşlenmiş/bilinmeyen referans için de **`200`** döner (sağlayıcının tekrar denemesini
önlemek için hata üretilmez).

```bash
curl -s -i -X POST http://localhost:3000/api/v1/billing/webhook \
  -H 'Content-Type: application/json' -H 'X-Iyzico-Signature: test-signature' \
  -d '{"providerReference":"fake-42e5f7aa-2fe4-4d44-8b97-2a01779864f0","status":"succeeded"}'
```
```
HTTP/1.1 200 OK
Content-Length: 0
```

Bu istekten sonra `GET /me` → `subscription.status: "active"`,
`currentPeriodEnd: now() + SUBSCRIPTION_PERIOD_DAYS gün` (doğrulandı:
`"currentPeriodEnd":"2026-09-17T07:17:40.802Z"`, checkout+webhook aynı gün, 30 gün sonrası).
Web istemcisinde bu geçişi kullanıcı hiçbir şey yapmadan görür: `SubscriptionPage`
`pending` durumundayken artan aralıklarla (**H-003**) otomatik `GET /me` yoklaması yapar
— ayrıntı için USER-GUIDE.md §9 ve ARCHITECTURE.md §7.16'ya bakın.

Hata — imza başlığı yok (`401`, doğrulandı):
```json
{"error":{"code":"INVALID_WEBHOOK_SIGNATURE","message":"Bildirim imzası doğrulanamadı.","traceId":"3d2b4f68-eff5-43e2-9ec3-4ac1df5111e9"}}
```

---

## Sözleşmeden sapmalar (`api-contract.yaml` ↔ gerçek kod)

`api-contract.yaml`'ın kendi başlığı zaten iki istisnayı (multipart fotoğraf, webhook
gövdesi) ve `GET /health`'in sözleşme dışı olduğunu **açıkça belgeliyor**; bunlar
"sapma" değil, sözleşmenin kendi tanımıdır. Bu doküman setini hazırlarken kontrol edilen
tüm diğer endpoint'lerde (istek/yanıt şeması, hata kodları, HTTP durumları) sözleşme ile
gerçek davranış arasında **fark bulunmadı** — web istemcisi zaten
`npm run gen:api-types` ile bu dosyadan TypeScript tipleri üretiyor
(`apps/web/src/api/schema.d.ts`), bu da iki tarafın sürüklenmesini pratikte engelliyor.

Tespit edilen tek pratik uyarı: sorgu/gövde katılığı yeni geliştiricileri şaşırtabilir —
örn. `GET /reports?limit=5` gibi sözleşmede olmayan bir parametre eklemek her zaman
`400 VALIDATION_ERROR` üretir (yukarıda gösterildi); doğru parametre adları için bu
dokümana veya `api-contract.yaml`'a bakın.
