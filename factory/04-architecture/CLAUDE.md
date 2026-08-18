# CLAUDE.md — Geliştirme Anayasası (Emlak Teslim Tutanağı Platformu, MVP)

> Üretici: architect-agent | Tarih: 2026-08-12 | Tur: 5
> Bu dosya **bağlayıcıdır**. Her dev ajanı her ticket'ta buna uyar; code-reviewer bu dosyaya göre denetler.
> Anayasada karşılığı olmayan bir ihtiyaç doğarsa dev **icat etmez**: `devlog`'a "anayasa boşluğu" olarak yazar ve mevcut en yakın kuralla ilerler.
> İlgili belgeler: `architecture.md` (kararlar + gerekçeler), `data-model.sql` (DDL, tek doğruluk kaynağı), `api-contract.yaml` (API, tek doğruluk kaynağı).

---

## 1. Klasör Yapısı (tam ağaç — hangi kod nereye)

```
/
├─ package.json                      # npm workspaces kökü, ortak scriptler
├─ docker-compose.yml                # yerel: api, web, db, minio, mailpit
├─ .env.example                      # YALNIZCA anahtar adları, gerçek değer YOK
├─ .github/workflows/ci.yml          # lint + tsc + test + build (+ migrate)
├─ eslint.config.mjs                 # ESLint 9 flat config (kök, workspace'ler genişletir)
├─ .prettierrc
├─ README.md                         # yerelde çalıştırma + test adımları (T-001)
│
├─ apps/api/                         # NestJS backend
│  ├─ Dockerfile
│  ├─ prisma/
│  │  ├─ schema.prisma               # data-model.sql ile BİREBİR uyumlu
│  │  ├─ migrations/                 # Prisma Migrate çıktısı (elle düzenlenmez)
│  │  └─ seed.ts                     # 3 sabit şablon (idempotent upsert)
│  ├─ src/
│  │  ├─ main.ts                     # bootstrap: NestFactory.create(..., { rawBody: true })
│  │  │                              #   (webhook imza doğrulaması ham gövde ister — §3.7/§3.13),
│  │  │                              #   global pipe/filter/interceptor, helmet, /api/v1 öneki
│  │  ├─ app.module.ts
│  │  ├─ config/                     # env şeması (zod) + ConfigModule; env okuma SADECE burada
│  │  ├─ common/
│  │  │  ├─ errors/                  # AppError hiyerarşisi (§4)
│  │  │  ├─ filters/                 # AllExceptionsFilter → tek tip hata zarfı
│  │  │  ├─ guards/                  # JwtAuthGuard (global), @Public() dekoratörü
│  │  │  ├─ interceptors/            # RequestLoggingInterceptor (traceId)
│  │  │  ├─ pipes/                   # global ValidationPipe yapılandırması
│  │  │  └─ decorators/              # @CurrentUser()
│  │  ├─ modules/
│  │  │  ├─ auth/                    # auth.controller.ts, auth.service.ts, jwt.strategy.ts, dto/
│  │  │  ├─ users/                   # users.service.ts, users.repository.ts, dto/, mappers/
│  │  │  ├─ templates/
│  │  │  ├─ reports/                 # taslak + listeleme/arama + sahiplik kuralı
│  │  │  ├─ photos/                  # yükleme, sihirli bayt doğrulama, sharp işleme
│  │  │  ├─ pdf/                     # report-pdf.service.ts (PDFKit düzeni)
│  │  │  ├─ sharing/                 # share-link.service.ts, whatsapp-link.builder.ts, public controller
│  │  │  ├─ approvals/
│  │  │  └─ billing/                 # checkout + webhook (imza doğrulama)
│  │  └─ infra/                      # dış sistemler — HER BİRİ port + adapter (§7)
│  │     ├─ prisma/prisma.service.ts
│  │     ├─ storage/                 # storage.port.ts, r2-storage.adapter.ts, fake-storage.adapter.ts
│  │     ├─ email/                   # email.port.ts, resend-email.adapter.ts, fake-email.adapter.ts
│  │     └─ payment/                 # payment.port.ts, iyzico-payment.adapter.ts, fake-payment.adapter.ts
│  └─ test/
│     ├─ db.ts                       # SADECE bağlantı/SQL/SQLSTATE yardımcıları — entity ÜRETMEZ
│     ├─ factories/                  # test verisi fabrikaları, dosya başına bir varlık
│     │  ├─ user.factory.ts
│     │  ├─ report.factory.ts
│     │  └─ ...
│     └─ *.e2e-spec.ts               # HTTP seviyesi entegrasyon testleri
│
└─ apps/web/                         # React + Vite PWA
   ├─ public/
   │  ├─ manifest.webmanifest        # name, icons, start_url, display: standalone (T-001)
   │  └─ icons/
   ├─ index.html
   ├─ vite.config.ts                 # vite-plugin-pwa yapılandırması
   ├─ src/
   │  ├─ main.tsx, App.tsx, router.tsx
   │  ├─ pages/                      # rota başına bir sayfa bileşeni
   │  │  ├─ LoginPage.tsx, RegisterPage.tsx
   │  │  ├─ ReportListPage.tsx, ReportCreatePage.tsx, ReportDetailPage.tsx
   │  │  ├─ SubscriptionPage.tsx
   │  │  └─ PublicReportPage.tsx     # /t/:token — oturumsuz kiracı görünümü
   │  ├─ features/                   # özellik bazlı bileşen + hook grupları (reports/, photos/, sharing/, billing/)
   │  ├─ components/                 # özellikten bağımsız, yeniden kullanılan UI parçaları
   │  ├─ api/
   │  │  ├─ client.ts                # tek fetch sarmalayıcı: token, hata zarfı çözümleme
   │  │  └─ schema.d.ts              # openapi-typescript ile ÜRETİLİR — elle düzenlenmez
   │  ├─ hooks/, lib/, styles/
   └─ e2e/                           # Playwright senaryoları
```

**Kural:** `modules/*` iş mantığı barındırır, `infra/*` dış dünyayı barındırır, `common/*` çapraz kesen konuları barındırır. Bir dosya bu üçünden hangisine ait olduğu belirsizse yanlış yerdedir.

---

## 2. İsimlendirme

| Öğe | Kural | Örnek |
|---|---|---|
| TS dosya | `kebab-case.<rol>.ts` | `report-pdf.service.ts`, `create-report.dto.ts` |
| React bileşen dosyası | `PascalCase.tsx` | `PhotoCaptureInput.tsx` |
| Sınıf | `PascalCase` + rol soneki | `ReportsService`, `JwtAuthGuard`, `R2StorageAdapter` |
| Arayüz (port) | `PascalCase` + `Port` | `StoragePort`, `EmailPort` — `IStorage` gibi Macar öneki YASAK |
| Metod | `camelCase`, fiil ile başlar | `createDraft()`, `issueShareLink()`, `assertOwnership()` |
| Boolean | `is/has/can` öneki | `isApproved`, `hasPhotos` |
| Sabit | `SCREAMING_SNAKE_CASE` | `MAX_PHOTO_BYTES`, `CLOCK_SKEW_TOLERANCE_MS` |
| Endpoint | çoğul kaynak, `kebab-case`, fiil yok | `POST /reports/{id}/share-link` ✅ / `POST /createShareLink` ❌ |
| Endpoint istisnası | Kimlik/ödeme **eylem** endpoint'leri (`/auth/login`, `/auth/register`, `/billing/checkout`, `/billing/webhook`) ve tekil `/me` **bilinçli istisnadır** — sözleşmede böyle tanımlıdır, ihlal sayılmaz | `POST /auth/login` ✅ |
| JSON alan | `camelCase` | `capturedAt`, `approverEmail` |
| DB tablo | çoğul `snake_case` | `report_photos`, `payment_transactions` |
| DB sütun | `snake_case`; FK `<tekil>_id` | `owner_id`, `share_link_id` |
| DB index | `<tablo>_<sütunlar>_idx` / unique `_key` | `reports_owner_created_at_idx` |
| Branch | `feat/T-00X-kisa-aciklama`, `fix/...`, `chore/...` | `feat/T-006-photo-upload` |
| Commit | Conventional Commits + ticket kimliği | `feat(photos): T-006 fotoğraf yükleme ve sunucu damgası` |

Kod, yorum ve log **mesaj metinleri Türkçe**; tanımlayıcılar (değişken/sınıf/tablo) **İngilizce**. Karışık dil tek tanımlayıcıda kullanılmaz.

---

## 3. Katman Kuralları

**3.1 Controller** yalnızca: HTTP bağlama, DTO doğrulama tetikleme, servis çağırma, yanıt eşleme. **İş mantığı, `if` zinciriyle iş kuralı, doğrudan Prisma çağrısı controller'da YASAK.** Controller metodu ≤ 15 satır.

**3.2 Service** iş mantığının tek yeridir; HTTP'yi bilmez (`Request`/`Response` nesnesi almaz), yalnızca domain girdileri alır ve domain/DTO tipleri döner. HTTP durum kodları servis içinde değil, fırlatılan `AppError` alt sınıfı üzerinden belirlenir (§4).

**3.3 Interface + impl kuralı — abartma yasağı.** Servisler için ayrı arayüz **yazılmaz** (tek implementasyon var, Nest DI sınıf token'ıyla çalışır). Arayüz **yalnızca** `infra/*` altındaki dış sistem portları için zorunludur (§7).

**3.4 Veri erişimi.** Prisma çağrıları modül içindeki `*.repository.ts` dosyalarında toplanır; servis, Prisma tiplerini dışarı sızdırmaz. Ham SQL yalnızca trigram araması gibi ORM'in doğal olarak ifade edemediği yerlerde ve parametreli (`Prisma.sql`) olarak kullanılır — string birleştirme ile SQL kurmak YASAK.

**3.5 DTO ↔ entity dönüşümü** yalnızca `modules/<x>/mappers/<x>.mapper.ts` içinde yapılır (`toReportDto(entity)`). Controller da servis de elle alan kopyalamaz. **Prisma entity'si API yanıtı olarak doğrudan döndürülemez** (`password_hash`, `storage_key` gibi alanların sızmasını yapısal olarak engeller).

- **İsteğe bağlı nesne alanları `null` değil, YOK olur.** `ReportDetail.approval` ve `PublicReportView.approval` alanları tutanak onaylanmamışken yanıt gövdesine **hiç konulmaz** (`approval: null` gönderilmez); istemci onayın varlığını `status === 'approved'` / `isApproved` üzerinden anlar. Gerekçe: OpenAPI 3.0'da `$ref` + kardeş `nullable` kalıbı tip üreticilerinde `| null` üretmez, bu da `schema.d.ts` ile runtime arasında sessiz sapma yaratırdı (sözleşmede aynı cümle yazılıdır). Skaler alanlarda (`errorMessage`, `priceAmount`, `currentPeriodEnd`) `nullable: true` kalıbı geçerlidir ve `null` gönderilir.

**3.6 Sözleşme önceliği.** `api-contract.yaml` ve `data-model.sql` bağlayıcıdır. Kod ile sözleşme çelişirse dev **sözleşmeyi kendi başına değiştirmez**; devlog'a "anayasa/sözleşme boşluğu" yazar. Web tarafı tiplerini `npm run gen:api-types` ile üretir, `schema.d.ts` elle düzenlenmez.

**3.7 Zaman.** Kullanıcıya görünen tüm damgalar (`captured_at`, `approved_at`, `created_at`) **veritabanı/sunucu tarafında** üretilir. İstemciden gelen hiçbir tarih alanı okunmaz, DTO'ya bile alınmaz.

**Gövde katılığı ve tam olarak İKİ istisnası (bağlayıcı).** Global `ValidationPipe` `forbidNonWhitelisted: true` ile çalışır ve **JSON** gövdelerde beyaz liste dışı alan `400 VALIDATION_ERROR` üretir. Bu kuralın **yalnızca iki istisnası** vardır; liste **genişletilemez** — bu iki route dışında hiçbir endpoint'te "ek alanı yok say" davranışı yoktur:

1. **Multipart fotoğraf yükleme (T-006 kriter 3):** `POST /reports/{reportId}/photos` multipart gövdesinde `file` dışındaki **tüm alanlar sessizce yok sayılır**, ek alan **400 üretmez** ve `capturedAt` dahil hiçbir istemci tarih değeri okunmaz — damga `DEFAULT now()` ile DB'de doğar. Uygulaması: bu route'un handler'ı yalnızca `FileInterceptor` ile `file`'ı alır; gövde alanları için DTO **tanımlanmaz** ve `forbidNonWhitelisted` bu route'ta **devreye sokulmaz**. Gerekçe ve QA doğrulama yolu: architecture.md §7 + §10 T-006 satırı; sözleşmede endpoint açıklaması birebir aynı cümleyi taşır.
2. **Ödeme sağlayıcısı bildirimi (T-012):** `POST /billing/webhook` gövdesi **bize değil sağlayıcıya aittir**; bu route'ta `forbidNonWhitelisted` **uygulanmaz**, `PaymentWebhookRequest` şemasında olmayan alanlar `whitelist: true` ile **sessizce ayıklanır** ve **400 üretmez**. Gerekçe: sağlayıcılar bildirim gövdesine rutin olarak ek alan koyar; imza geçerliyken 4xx dönmek bildirimin süresiz tekrarlanmasına yol açar (architecture.md §8.5) ve T-012 kabul kriteri 2 üretimde hiç çalışmaz. `400` yalnızca **zorunlu** alanlar (`providerReference`, `status`) normalizasyondan sonra eksik/geçersizse döner; **tanınmayan** `providerReference` hata değildir → `200` (§3.13).

Bu istisnalar hiçbir güvenlik gevşetmesi değildir: (1)'de dosya boyut + sihirli bayt + `sharp` yeniden kodlama zincirinden geçer, `file` dışındaki alanlar hiçbir kod yolunda okunmaz; (2)'de gövde **imza doğrulanmadan** hiçbir şekilde işlenmez ve ayıklanan alanlar hiçbir kod yolunda okunmaz.

**3.8 Sahiplik kontrolü.** Bir tutanağa/fotoğrafa/PDF'e dokunan her servis metodu ilk iş olarak `assertOwnership(reportId, userId)` çağırır: kayıt yoksa `NotFoundError`, başkasına aitse `ForbiddenError`. Bu kontrol controller'a veya guard'a taşınmaz (kaynak sahipliği iş kuralıdır).

**3.9 Frontend.** Sunucu durumu TanStack Query ile yönetilir; global istemci state kütüphanesi (Redux vb.) kullanılmaz. Ağ çağrıları yalnızca `src/api/client.ts` üzerinden yapılır — bileşen içinde çıplak `fetch` YASAK. Sayfa bileşeni veri çekmeyi hook'a devreder, kendisi yalnızca düzen/etkileşim kurar.

**3.10 Tutanak durum geçişi (tek kural).** `reports.status` yalnızca iki noktada değişir: (1) `POST /reports/{id}/share-link` başarılı olduğunda `draft` → `shared` (kayıt zaten `shared`/`approved` ise durum korunur, hata dönmez); (2) onay kaydı oluştuğunda `shared` → `approved`. **Geri geçiş yoktur**, durumu doğrudan değiştiren bir endpoint yazılmaz, e-posta gönderimi (`.../share-link/email`) durumu **değiştirmez**. Geçiş, link/onay kaydını yazan aynı transaction içinde yapılır.

Bu kuralın iki bağlayıcı sonucu (dev bunları icat etmez, aynen uygular):
- **Kanıt bütünlüğü:** `reports.status = 'approved'` iken `POST /reports/{id}/photos` **reddedilir** → `ConflictError` (`409 REPORT_ALREADY_APPROVED`); `draft` ve `shared` durumlarında yükleme serbesttir. Onay, tutanağın içeriğini **dondurur** (PDF her istekte yeniden üretildiği için onaydan sonra eklenen fotoğraf onayın kanıt değerini bozardı — architecture.md §8.1). Kontrol `PhotosService`'in başında, `assertOwnership(...)` çağrısından hemen sonra yapılır (§3.8 guard clause).
- **E-posta ön koşulu:** `POST /reports/{id}/share-link/email` paylaşım linki **üretmez**; link yoksa `NotFoundError` (`404 SHARE_LINK_NOT_FOUND`) fırlatılır — önce `POST /reports/{reportId}/share-link` çağrılmalıdır. Bu endpoint'te get-or-create **yapılmaz**, aksi halde `draft` bir tutanak için geçerli genel link ortaya çıkar ve "linkin varlığı durumu belirler" değişmezi kırılır.

**3.11 Abonelik satırı (tek kural).** Kayıt sırasında `subscriptions` satırı **yazılmaz**. Satır yalnızca `POST /billing/checkout` içinde get-or-create ile (unique kısıt `subscriptions_user_id_key`, §7) oluşur. `GET /me` satır yoksa satır **yaratmaz**; `{ status: 'inactive', priceAmount: null, currency: SUBSCRIPTION_CURRENCY, currentPeriodEnd: null }` varsayılanını döner (architecture.md §8.3).

**3.12 Abonelik durum geçişi (tek kural — architecture.md §8.4 ile birebir).**

> `POST /billing/checkout` başarılı olduğunda `subscriptions.status` `inactive` (ya da yeni oluşturulmuş satır) → **`pending`**; webhook `succeeded` → **`active`** ve `current_period_end = now() + SUBSCRIPTION_PERIOD_DAYS gün` yazılır; webhook `failed` → **`inactive`** ve `current_period_end` `NULL` bırakılır; durum **`active`** iken gelen `failed` bildirimi durumu **düşürmez**. Geçiş, `payment_transactions` satırını yazan (checkout) ya da güncelleyen (webhook) aynı transaction içinde yapılır; satırın yaşam döngüsü ve webhook'un koşullu güncellemesi **§3.13**'tedir — webhook geçişi yalnızca güncelleme **1 satır** etkilediğinde uygulanır.

- `current_period_end` değeri **koda gömülmez** ve **sağlayıcı gövdesinden okunmaz**: `PaymentWebhookRequest` dönem bilgisi taşımaz, değer `SUBSCRIPTION_PERIOD_DAYS` yapılandırmasından (§5.1) hesaplanır. `subscriptions_active_needs_period` CHECK'inin runtime'da patlamaması bu kurala uymaya bağlıdır.
- `status = 'failed'` yazılırken `payment_transactions.failure_reason` **zorunludur** (DB CHECK); sağlayıcı neden bildirmediyse sabit bir Türkçe varsayılan neden yazılır, `null` bırakılmaz.
- Abonelik durumu **hiçbir yerde erişimi kısıtlamaz** (paywall T-012 kapsam dışı); yalnızca `GET /me` ile gösterilir. Web tarafı üç durumu da render eder; `pending` → "ödeme sonucu bekleniyor, abonelik henüz aktif değil".

**3.13 Ödeme kaydı ve webhook idempotansı (tek kural — architecture.md §8.5 ile birebir).**

> `POST /billing/checkout`, sağlayıcıdan işlem referansını aldıktan sonra `payment_transactions` satırını **yazar**: `status = 'initiated'`, `provider_reference = <sağlayıcı işlem referansı>`, `amount = SUBSCRIPTION_PRICE_AMOUNT`, `currency = SUBSCRIPTION_CURRENCY`, `processed_at = NULL`. `POST /billing/webhook` **yeni satır yazmaz**; satırı `provider_reference` ile bulur ve **yalnızca `processed_at IS NULL` iken** tek bir koşullu güncellemeyle işler: `UPDATE payment_transactions SET status = <succeeded|failed>, failure_reason = …, processed_at = now() WHERE provider_reference = $1 AND processed_at IS NULL`. Etkilenen satır **1** ise aynı transaction içinde §3.12'deki abonelik geçişi uygulanır. Etkilenen satır **0** ise (daha önce işlenmiş **veya** tanınmayan referans) hiçbir abonelik/ödeme alanı değişmez, `current_period_end` yeniden hesaplanmaz ve endpoint yine **`200`** döner (`warn` log).

- **Gövde normalizasyonunun yeri (tek kural).** İmza doğrulaması **ve** sağlayıcı alan adlarının `PaymentWebhookRequest` kanonik şekline (`providerReference`, `status`, `failureReason`) çevrilmesi **`infra/payment` altındaki adapter'da** yapılır: `PaymentPort.verifyAndParseNotification(rawBody, signature)`. Ham gövdeye erişim `main.ts`'teki `rawBody: true` ile sağlanır (§1). Controller yalnızca ham gövde + imza başlığını port'a verir, servis yalnızca kanonik nesneyi görür — **sağlayıcıya özgü alan adı hiçbir zaman `modules/billing` içine sızmaz**. `FakePaymentAdapter` kanonik gövdeyi birebir kabul eder; yerel çalıştırma ve QA bu şekilde test eder (§8.2).
- **YASAK:** webhook içinde `INSERT` denemek, `SELECT` ile "işlenmiş mi" diye bakıp ardından koşulsuz `UPDATE` yapmak (yarış), uygulama içi kilit/mutex kullanmak, bilinmeyen referansta `400`/`404` dönmek.
- Koşullu `UPDATE` tek ifadede yapılır ve etkilenen satır sayısı (Prisma'da `updateMany().count`) **kontrol edilir**; sayı 0 iken abonelik tablosuna dokunulmaz.
- Abonelik güncellemesi, güncellenen ödeme satırından okunan `subscription_id` ile yapılır; webhook gövdesinden kullanıcı/abonelik türetilmez.
- Sağlayıcı çağrısı başarısızsa (`502 PAYMENT_PROVIDER_ERROR`) `payment_transactions` satırı **hiç yazılmaz** ve abonelik `pending`'e taşınmaz.
- Test zorunluluğu (§8.2): aynı `succeeded` bildiriminin **iki kez** gönderildiği e2e senaryosu şart — ikinci çağrıda `200` dönmeli ve `current_period_end` **değişmemelidir**.

**3.14 Fotoğraf sırası (tek kural).** `report_photos.sort_order` **sunucuda** atanır: aynı tutanaktaki mevcut en büyük değer + 1 (ilk fotoğraf `0`), ekleme ile aynı transaction içinde. İstemci bu değeri gönderemez (§3.7 multipart istisnası gereği gövdedeki ek alanlar zaten yok sayılır) ve yeniden sıralama endpoint'i **yazılmaz**. Fotoğraf listeleyen her sorgu (`GET /reports/{id}/photos`, PDF üretimi, genel görünüm) `(sort_order, captured_at)` sırasını kullanır — sırasız `findMany` yasaktır (architecture.md §8).

---

## 4. Hata Yönetimi

**4.1 Tek tip hata zarfı** (`api-contract.yaml` → `ErrorEnvelope`). 4xx/5xx **her** yanıt bu biçimdedir:

```
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [ { "field": "...", "message": "..." } ], "traceId": "..." } }
```

**4.2 Exception hiyerarşisi** (`common/errors/`):
```
AppError (abstract; code, httpStatus, message, details?)
├─ ValidationError         400  VALIDATION_ERROR
├─ UnauthenticatedError    401  UNAUTHENTICATED | INVALID_CREDENTIALS | INVALID_WEBHOOK_SIGNATURE
├─ ForbiddenError          403  FORBIDDEN
├─ NotFoundError           404  NOT_FOUND | TEMPLATE_NOT_FOUND | SHARE_LINK_NOT_FOUND
├─ ConflictError           409  EMAIL_ALREADY_REGISTERED | REPORT_ALREADY_APPROVED | PHOTO_LIMIT_REACHED | SUBSCRIPTION_ALREADY_ACTIVE
├─ UnprocessableError      400  REPORT_HAS_NO_PHOTOS | UNSUPPORTED_MEDIA_FORMAT | FILE_TOO_LARGE
└─ ExternalServiceError    502  PAYMENT_PROVIDER_ERROR | STORAGE_UNAVAILABLE
```
Servisler **yalnızca** bu sınıfları fırlatır; `throw new Error('...')` ve Nest'in `HttpException`'ı doğrudan kullanılmaz. Global `AllExceptionsFilter` bunları zarfa çevirir; tanınmayan her istisna `500 INTERNAL_ERROR` olur ve **iç detay istemciye sızmaz**.

**Kapsam kuralı:** Bu hiyerarşi `api-contract.yaml` → `ErrorEnvelope.code` enum'unun **tamamını** karşılar; enum'da olmayan bir kod üretilemez, sınıfı olmayan bir kod eklenemez. İki istisna framework kaynaklıdır ve servis kodu tarafından fırlatılmaz: `@nestjs/throttler` limiti aşıldığında filtre yanıtı `429 RATE_LIMIT_EXCEEDED` zarfına çevirir, yakalanmayan istisna `500 INTERNAL_ERROR` olur. Yeni bir hata kodu ihtiyacı doğarsa dev kod uydurmaz — anayasa/sözleşme boşluğu olarak raporlar (§3.6, §11).

**4.2.1 Depolama arızası (R2/MinIO).** Obje depolama erişilemezse `ExternalServiceError` (`502 STORAGE_UNAVAILABLE`) fırlatılır. Yükleme sırası **önce depolama, sonra DB**: PUT başarısızsa `report_photos`'a satır **yazılmaz** (yetim kayıt yasak). Okuma başarısızsa PDF akışı 502 ile durur, yarım/eksik PDF **stream edilmez**. Bu kod yalnızca `POST /reports/{id}/photos` ve `GET /reports/{id}/pdf` yanıtlarında geçerlidir (sözleşmede tanımlı olan yerler).

**4.2.2 E-posta gönderimi istisna DEĞİLDİR.** Resend çağrısı başarısız olursa `ExternalServiceError` **fırlatılmaz**: `share_deliveries` satırı `status = 'failed'` + `error_message` ile yazılır ve endpoint `202` + `ShareDelivery.status = failed` döner (T-008 kabul kriteri: "gönderim durumu yanıtta belirtilir"). `EMAIL_DELIVERY_FAILED` diye bir hata kodu **yoktur**; otomatik yeniden deneme de yoktur (kuyruk yok — architecture.md §4).

**4.2.3 `details` alanı ne zaman dolar.** Yalnızca `VALIDATION_ERROR` ve `EMAIL_ALREADY_REGISTERED` yanıtlarında (T-003 kriteri "409 + alan bazlı hata mesajı" → `details: [{ field: 'email', message: 'bu e-posta zaten kayıtlı' }]`). Diğer hata kodlarında `details` gönderilmez.

**4.3 Hata mesajı kuralı.** `message` son kullanıcıya gösterilebilir Türkçe cümledir; stack trace, SQL, sağlayıcı ham yanıtı, dosya yolu, token **içeremez**. Makine tarafı ayrım için `code` kullanılır — istemci mesaj metnine göre dallanmaz.

**4.4 Loglama seviyeleri** (pino, JSON, her kayıtta `traceId`):
| Seviye | Ne zaman |
|---|---|
| `error` | 5xx, dış servis başarısızlığı, işlenemeyen istisna — stack ile |
| `warn` | Beklenen ama dikkat çekici: rate limit tetiklendi, webhook imzası geçersiz, mükerrer onay denemesi |
| `info` | İş olayları: kullanıcı kaydı, tutanak oluşturuldu, paylaşım linki üretildi, abonelik aktifleşti |
| `debug` | Yalnızca yerel/geliştirme; production'da kapalı |

**Asla loglanmayacaklar:** şifre, şifre hash'i, JWT, paylaşım token'ı, iyzico anahtarları, fotoğraf içeriği. E-posta adresleri maskelenerek loglanır (`a***@domain.com`).

**4.5 Frontend hata gösterimi.** `client.ts` hata zarfını tek noktada çözer; kullanıcıya `error.message` gösterilir, alan hataları (`details[]`) ilgili form alanının altına bağlanır. Yakalanmayan hatalar için tek bir `ErrorBoundary` vardır.

---

## 5. Secrets Yönetimi

- Tüm sırlar ortam değişkeni ile gelir; `config/` dışında hiçbir yerde `process.env` okunmaz (zod şeması ile açılışta doğrulanır — eksik sır varsa uygulama **açılmaz**).
- Repoda yalnızca `.env.example` (anahtar adları + açıklama, değer yok). Gerçek `.env` `.gitignore`'dadır ve **hiçbir koşulda commit edilmez**.
- **Sır listesi (TAM liste — tek doğruluk kaynağı burasıdır; `architecture.md` §7 listeyi tekrar etmez):** `DATABASE_URL`, `JWT_SECRET`, `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `RESEND_API_KEY`, `IYZICO_API_KEY`, `IYZICO_SECRET_KEY`, `IYZICO_WEBHOOK_SECRET`. (`PUBLIC_APP_URL` sır **değildir** — genel uygulama adresidir; §5.1 tablosundadır.)
  - Tek koşullu istisna: `IYZICO_*` üçlüsü yalnızca `PAYMENT_PROVIDER=iyzico` iken zorunludur (zod şemasında koşullu doğrulama); `PAYMENT_PROVIDER=fake` iken istenmez — yerel çalıştırma bu sayede dış hesapsız ayağa kalkar (§5.1, §10). Diğer tüm sırlar her ortamda zorunludur.
- `.env.example` içeriği = bu liste **+ §5.1 tablosundaki tüm anahtarlar** (değer yok, yalnızca ad + tek satır açıklama; yerel varsayılanı olanlar için çalışır değer). Bu iki listede olmayan bir env anahtarı kodda okunamaz.
- Frontend'e yalnızca `VITE_` önekli, **sır olmayan** değerler gider (API tabanı, uygulama URL'i). Herhangi bir API anahtarı frontend bundle'ına konulamaz.
- Test/örnek anahtarlar bile gerçekçi biçimde repoya yazılmaz; testler `FakeX` adapter'ları kullanır.

### 5.1 Sır olmayan yapılandırma (aynı mekanizma: env + zod + `.env.example`)

Sır değildir ama **kod içine gömülmesi yasaktır**; `config/` şemasında tanımlıdır ve `.env.example`'da anahtar adı olarak yer alır:

| Anahtar | Tip / varsayılan | Amaç |
|---|---|---|
| `SUBSCRIPTION_PRICE_AMOUNT` | Ondalıklı **string**, ör. `199.00` (zod: `/^\d+\.\d{2}$/`) | T-012 abonelik tutarı. `numeric(12,2)` sütunlarına (`payment_transactions.amount`, `subscriptions.price_amount`) ve `CheckoutResponse.amount`'a **birebir string** olarak yazılır. **`parseFloat`/`Number()` ile parse etmek YASAK** (para float'a dönüştürülmez); PRD'de kesin fiyat açık soru olduğu için değer yapılandırmadan gelir, koda sabitlenmez. |
| `SUBSCRIPTION_CURRENCY` | `char(3)`, varsayılan `TRY` | Para birimi; DB varsayılanıyla aynı tutulur. |
| `SUBSCRIPTION_PERIOD_DAYS` | Pozitif tam sayı, varsayılan `30` (zod: `int().positive()`) | T-012 abonelik dönem uzunluğu. Webhook `succeeded` işlenirken `subscriptions.current_period_end = now() + SUBSCRIPTION_PERIOD_DAYS gün` olarak **sunucuda hesaplanır** (§3.12, architecture.md §8.4). `subscriptions_active_needs_period` CHECK'inin karşılığı budur; **gün sayısını koda gömmek ve sağlayıcı gövdesinden okumak YASAK** (`PaymentWebhookRequest` dönem bilgisi taşımaz). |
| `EMAIL_FROM` | `Ad <adres@alan>` veya düz e-posta biçimi, ör. `Tutanak <noreply@app.example.com>` (zod: bu iki biçimi kabul eden regex) | T-008 paylaşım e-postasının **gönderen adresi**; `ResendEmailAdapter`'ın zorunlu `from` parametresi. Adres koda gömülmez. Yerelde mailpit her adresi kabul ettiği için `.env.example`'daki varsayılan çalışır durumdadır. |
| `PAYMENT_PROVIDER` | `iyzico` \| `fake` (zod: enum); yerel/test varsayılanı `fake`, production `iyzico` | T-012'de hangi `PaymentPort` adapter'ının bağlanacağını belirler (`IyzicoPaymentAdapter` / `FakePaymentAdapter`, §7 Adapter+Port). `fake` seçiliyken `IYZICO_*` sırları istenmez — `docker compose up` dış hesap gerektirmez (§10). |
| `PHOTO_MAX_BYTES` | `10485760` | T-006 dosya boyutu üst sınırı (DDL CHECK ile aynı değer). |
| `PHOTO_MAX_PER_REPORT` | `30` | `PHOTO_LIMIT_REACHED` eşiği (architecture.md §5.3 maliyet korkuluğu). |
| `JWT_EXPIRES_IN` | `7d` | Erişim token'ı ömrü. |
| `PRESIGNED_URL_TTL_SECONDS` | `900` | Fotoğraf ön-imzalı okuma URL'si ömrü (15 dk). |
| `PUBLIC_APP_URL` | Mutlak `https` URL (yerel: `http://localhost:5173`) | Paylaşım linkinin (`ShareLink.url` → `<PUBLIC_APP_URL>/t/<token>`) ve `wa.me` metninin tabanı; e-posta gövdesinde de bu adres kullanılır. **Sır değildir**, ama koda gömülmesi yasaktır. |

Bu tabloda olmayan bir yapılandırma değerine ihtiyaç doğarsa dev **kendi env adını icat etmez** — devlog'a anayasa boşluğu yazar (§11).

---

## 6. Kütüphaneler

### 6.1 Kullanılacaklar (sürümler sabitlenir; minor güncelleme serbest, major yükseltme ayrı ticket)

**apps/api**
| Kütüphane | Sürüm | Amaç |
|---|---|---|
| `@nestjs/*` (common, core, platform-express, config, jwt, passport, throttler) | 11.x | Framework, DI, JWT, rate limit |
| `prisma` / `@prisma/client` | 6.x | ORM + migration + seed |
| `class-validator` / `class-transformer` | 0.14 / 0.5 | DTO doğrulama |
| `zod` | 3.x | Yalnızca env şeması |
| `bcrypt` | ^6.0.0 | Şifre hash (cost 10) |
| `pdfkit` | 0.15 | PDF üretimi |
| `sharp` | 0.33 | Görsel yeniden boyutlandırma/normalizasyon |
| `file-type` | 19.x | Sihirli bayt ile gerçek MIME doğrulama |
| `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` | 3.x | R2/MinIO erişimi, ön-imzalı URL |
| `resend` | 4.x | İşlemsel e-posta |
| `iyzipay` | 2.x | Ödeme sağlayıcısı |
| `nestjs-pino` / `pino` | 4.x / 9.x | Yapısal log |
| `helmet` | 8.x | Güvenlik başlıkları |

> **`bcrypt` pini 5.x → ^6.0.0 (T-003'te alınır ve T-003'te uygulanır).** 5.x,
> `@mapbox/node-pre-gyp` → `tar` zinciri üzerinden 2 high + 1 critical advisory taşıyor;
> bu §9'un `npm audit --audit-level=high` kapısıyla doğrudan çelişiyordu ve iki kural aynı
> anda sağlanamıyordu. 6.0 node-pre-gyp zincirini tamamen terk ettiği için sorunlu
> bağımlılık kökten kalkıyor; `hash`/`compare` API'si değişmedi ve proje Node 22'de.
> Alternatifler bilinçli olarak reddedildi: `tar` için npm `overrides` semptomu boyar ve
> native kurulum zincirine sessiz müdahale bazı platformlarda `npm install`'ı kırar; §9
> eşiğine istisna ise kapıyı ilk gerçek testinde alçaltır ve eşiği müzakere konusu yapar.
> Not: bu üç zafiyet kurulum anı yüzeyindedir (prebuilt binary açılırken), çalışma
> zamanında değil — ama kapı bunu ayırt edemez ve etmemelidir.
>
> **Bu bir yükseltme değil, giriş kararıdır.** `bcrypt` `main`'de yoktur; ürüne T-003 ile
> ilk kez girer. §6.1'in "major yükseltme AYRI TICKET" kuralı `main`'de yaşayan bir
> bağımlılığı yükseltmek içindir; kendi getirdiği bağımlılığın sürümünü seçmek ticket'ın
> kendi kapsamıdır. Ayrı bir yükseltme ticket'ı açmak, hiç var olmamış bir ara durumu
> (5.1.1) `main`'e sokup sonra temizlemek olurdu — ve o ticket, düzelteceği ticket'a
> bağımlı doğduğu için çözülemez bir kilit üretirdi.

**apps/web**
| Kütüphane | Sürüm | Amaç |
|---|---|---|
| `react` / `react-dom` | 19.x | UI |
| `vite` | 6.x | Build/dev |
| `vite-plugin-pwa` | 0.21 | Manifest + service worker (Workbox) |
| `react-router-dom` | 7.x | Yönlendirme |
| `@tanstack/react-query` | 5.x | Sunucu durumu, önbellek, yeniden deneme |
| `openapi-typescript` | 7.x | `api-contract.yaml` → tipler (dev bağımlılığı) |

**Test/araç:** `jest` 29, `ts-jest`, `supertest` 7, `@playwright/test` 1.4x, `eslint` 9 + `typescript-eslint` 8, `prettier` 3, `husky` + `lint-staged`.

### 6.2 Bilinçli KULLANILMAYACAKLAR
| Kütüphane/teknoloji | Neden yok |
|---|---|
| Redis | Tek instance; rate limit bellek içinde doğru çalışır, cache ihtiyacı yok (architecture.md §4) |
| Kafka / RabbitMQ / BullMQ | Backlog'da asenkron iş yok; PDF ve e-posta kabul kriterleri **senkron** yanıt zorunlu kılıyor |
| Elasticsearch / Meilisearch | Arama = başlık/not içinde terim; `pg_trgm` yeterli |
| Puppeteer / headless Chromium | PDF sabit düzenli; 4 GB VPS'te ~400 MB RAM ve büyük güvenlik yüzeyi kabul edilmez |
| Next.js / SSR | SEO ihtiyacı yok; statik SPA + Caddy daha az hareketli parça |
| Redux / MobX / Zustand | Durum neredeyse tümüyle sunucu durumu; React Query + yerel state yeterli |
| TypeORM / Sequelize / ham SQL katmanı | Prisma seçildi; iki ORM aynı projede bulunmaz |
| Lodash / Moment.js | Modern JS + `Intl`/`Date` yeterli; bundle bütçesi (≤250 KB gz) korunur |
| WhatsApp Business API | T-008 yalnızca `wa.me` URL üretimi istiyor; Meta onay süreci kapsam dışı |
| Stripe | Türkiye'de yerleşik satıcı için standart değil; iyzico seçildi |
| Bir UI kit'in tamamı (MUI/Ant) | Ekran sayısı az, mobil öncelikli özel düzen; ağır kit bundle bütçesini yer |

Listede olmayan bir kütüphaneyi eklemek isteyen dev, ticket'ın devlog'unda **tek cümlelik gerekçe + neden mevcut araçlarla yapılamadığı** açıklamasını yazar; aksi halde eklemez.

---

## 7. Desen Sözlüğü (bu üründe standart olan desenler)

| Problem sınıfı | Desen | Ne zaman kullan / KULLANMA |
|---|---|---|
| Dış sistem entegrasyonu (obje depolama, e-posta, ödeme) | **Adapter + Port** | Kod dışarıya (R2, Resend, iyzico) çıkıyorsa: `infra/<x>/<x>.port.ts` arayüzü + gerçek adapter + testler için `Fake<X>Adapter`. **KULLANMA:** kendi veritabanımız için (Prisma zaten soyutlama), saf hesaplama için. |
| Aynı iş için birden fazla gerçek davranış varyantı | **Strategy** | Ancak aynı anda **≥2 gerçek** varyant kodda varsa (bu MVP'de: yok — tek ödeme sağlayıcısı, tek e-posta sağlayıcısı, tek PDF düzeni). **KULLANMA:** "ileride ikinci sağlayıcı gelirse" gerekçesiyle. |
| Çok parçalı, adım adım kurulan nesne | **Builder** | PDF belgesinin bölüm bölüm kurulması (`ReportPdfBuilder`: başlık → şablon → not → fotoğraflar → onay bloğu) ve `wa.me` URL kurulumu. **KULLANMA:** 3-4 alanlı DTO'lar için — nesne değişmezi (literal) yeter. |
| Servisler arası olay / gecikmeli iş | **Outbox/Observer** | **Bu MVP'de KULLANILMAZ** — tek servis, asenkron iş yok (merdiven kuralı, architecture.md §4). İhtiyaç doğarsa anayasa boşluğu olarak raporlanır. |
| Tek noktadan nesne üretimi | **Factory** | Yalnızca test verisi fabrikalarında (`test/factories/*`) ve token üretiminde (`ShareTokenGenerator`) — gerçek çeşitlilik veya rastgelelik içeren üretimde. **KULLANMA:** tek implementasyonlu servis örneği üretmek için (Nest DI zaten yapıyor). |
| Tekrarlı **oluşturma** isteği (T-008 aynı tutanak için ikinci çağrıda aynı token dönmeli; T-012 `subscriptions` satırı kullanıcı başına tek olmalı) | **Unique kısıt + get-or-create** | Birincil garanti **DB unique index**'tir (`share_links_report_id_key`, `subscriptions_user_id_key`): önce `INSERT` denenir, `23505` (unique violation) yakalanınca mevcut kayıt okunup döndürülür — böylece "önce oku sonra yaz" yarışı yapısal olarak imkânsızdır. **KULLANMA:** uygulama içi kilit/mutex, `SELECT` sonrası `INSERT` kontrolü; ayrıca **webhook işleme için kullanma** (satır zaten vardır — bir alttaki satır geçerlidir). |
| Tekrarlı **bildirim** işleme / dış olayın bir kez etki etmesi (T-012: aynı `providerReference` ile gelen ikinci `succeeded` dönemi ikinci kez uzatmamalı) | **Koşullu UPDATE (işlenmişlik damgası)** | Satır zaten var olduğu için idempotansı unique index **sağlamaz**: `UPDATE … WHERE provider_reference = $1 AND processed_at IS NULL` ile işlenir, etkilenen satır sayısı kontrol edilir; 0 ise durum değişmeden `200` dönülür (tam kural §3.13). **KULLANMA:** `INSERT` + `23505` yakalama (her seferinde çakışır), `SELECT`-sonra-`UPDATE`, uygulama içi kilit. |
| Kaynak erişim kuralı (sahiplik) | **Guard Clause** | Servis metodunun başında `assertOwnership(...)` ile erken çık; iç içe `if` ağacı kurma. |
| Veri katmanı sınırı | **Repository** | Modül başına `*.repository.ts`; Prisma tipleri servis sınırının dışına sızmaz. **KULLANMA:** repository üzerine ikinci bir "data service" katmanı ekleme. |
| Dış → iç tip dönüşümü | **Mapper (saf fonksiyon)** | `mappers/*.mapper.ts` içinde entity ↔ DTO. Sınıf/DI gerekmez, saf fonksiyon yeterlidir. |

### 7.1 Desen Yasağı (bu MVP'de bilinçli olarak yapılmayacaklar)
- **Tek implementasyonlu factory/strategy/arayüz.** Bir arayüzün tek gerçek implementasyonu varsa ve test sahtesi gerekmiyorsa arayüz yazılmaz.
- **İki seviyeli soyutlama zinciri.** `Controller → Service → Repository → Prisma` dört katman yeterlidir; araya "facade", "manager", "handler", "use-case" katmanı eklenmez.
- **Genel amaçlı "BaseService/BaseController" kalıtım ağaçları.** Ortaklık gerekirse kalıtım değil, saf yardımcı fonksiyon.
- **Olay veri yolu (in-memory event bus), CQRS, mediator.** Tek servis, senkron akış — çözdükleri problem burada yok.
- **Erken genelleştirme:** "şablonlar dinamik alanlar da destekleyebilsin", "ikinci sektör de eklenebilsin" tarzı genişletme noktaları PRD kapsam dışıdır ve kodlanmaz.

**İlke:** Desen süs değildir. Çözdüğü problem kodda **fiilen** varsa yerini hak eder. Sözlükte olmayan bir desen ihtiyacı doğarsa dev icat etmez — devlog'a **anayasa boşluğu** olarak yazar.

---

## 8. Test Kuralları

**8.1 Neye birim test ŞART** (Jest, `*.spec.ts`, dosyanın yanında):
- Servislerdeki iş kuralları: sahiplik kontrolü, taslak/onaylı durum geçişleri, mükerrer onay reddi, "fotoğrafsız tutanak PDF olamaz", paylaşım linki idempotansı.
- Saf fonksiyonlar: mapper'lar, `wa.me` URL kurucu, token üreteci (uzunluk/alfabe/benzersizlik), dosya tipi doğrulama.
- Adapter'ların **sahte** karşılıkları ile çalışan servis testleri (gerçek ağ çağrısı asla birim testte yapılmaz).

**8.2 Neye entegrasyon/e2e testi ŞART** (`*.e2e-spec.ts`, gerçek Postgres + Supertest, `FakeStorage/FakeEmail/FakePayment` ile):
- Her HTTP endpoint'inin mutlu yolu + kimlik doğrulama (401) + yetki (403) + doğrulama (400) davranışı.
- DB kısıtları: benzersiz e-posta (409), FK reddi, `captured_at`/`approved_at` immutability trigger'ı, `approvals` unique index'i.
- **İdempotans senaryoları (zorunlu):** (a) aynı tutanak için ikinci `POST /reports/{id}/share-link` → **aynı token**; (b) aynı `providerReference` ile **iki kez** gönderilen `succeeded` webhook'u → ikisinde de `200`, `current_period_end` **değişmez** (§3.13); (c) **tanınmayan** `providerReference` → `200`, hiçbir abonelik alanı değişmez; (d) şemada **olmayan ek alanlar** taşıyan, imzası geçerli bir bildirim → `200` (ek alan `400` **üretmez**, §3.7 istisna 2).
- **Multipart yok sayma davranışı (T-006 kriter 3, zorunlu):** `POST /reports/{reportId}/photos` gövdesine `capturedAt` gibi ek bir alan eklenmiş istek **201** döner ve dönen damga **sunucu saatindedir** (400 dönmez, §3.7 + §8.5 clock skew kuralı).
- Migration + rollback + seed'in temiz bir veritabanında çalışması (T-002).

**8.3 Playwright E2E** (yalnızca kritik akış, 4 senaryo):
1. Kayıt → giriş → şablon seç → taslak oluştur.
2. Fotoğraf ekle (dosya girişi ile) → PDF indir.
3. Paylaşım linki üret → oturumsuz görüntüle → uyarı metnini gör → onayla → ikinci onay reddedilir.
4. Mobil viewport'ta PWA yüklenir, service worker kayıtlıdır ve fotoğraf girişi `capture` özniteliği ile kamerayı açar (T-006 manuel/E2E kriteri).

**8.4 Test verisi fabrikaları** `apps/api/test/factories/` altında, **dosya başına bir varlık** (`user.factory.ts` → `createUser()`). `test/db.ts` yalnızca bağlantı/SQL/SQLSTATE yardımcılarını barındırır; entity **oluşturmaz**. *(Bilgi tabanı dersi: `testing/test-fabrika-yerlesimi.md` — bu ihlal önceki üründe bir review iade turuna mal oldu.)*

**8.5 Zaman damgası testleri — clock skew kuralı.** DB'nin ürettiği bir damgayı host saatiyle karşılaştıran her test **iki taraflı**, adlandırılmış tolerans penceresi kullanır:
```
const CLOCK_SKEW_TOLERANCE_MS = 5000; // container saati host'tan kayabilir
expect(ts).toBeGreaterThanOrEqual(before - CLOCK_SKEW_TOLERANCE_MS);
expect(ts).toBeLessThanOrEqual(after + CLOCK_SKEW_TOLERANCE_MS);
```
Tek taraflı karşılaştırma (yalnız alt sınır) **yasaktır**: hem flaky'dir hem sabit/gelecek tarih regresyonunu kaçırır. *(Ders: `testing/clock-skew-toleransi.md`.)*

**8.6 Test isimlendirme.** `describe('ReportsService.createDraft')` → `it('başlık boşsa ValidationError fırlatır')`. Kalıp: **koşul → beklenen davranış**. "works", "test1" gibi adlar reddedilir.

**8.7 Coverage beklentisi.** `apps/api/src/modules/**` satır kapsamı **≥ %80** (CI eşiği, altına düşerse build kırmızı); repo geneli ≥ %70. DTO, config, `main.ts`, üretilmiş dosyalar kapsam dışıdır. **Kapsamı test kalitesi yerine koymak yasak** — her kabul kriterinin en az bir testte karşılığı olmalı; ticket'ta kabul kriteri → test eşlemesi devlog'a yazılır.

**8.8 Flaky test.** `it.skip`/`test.only` commit edilmez. Rastgele başarısız olan test düzeltilir veya kaldırılır, "yeniden dene" ile gizlenmez.

---

## 9. Linter ve Statik Analiz

| Araç | Yapılandırma | Zorunluluk |
|---|---|---|
| TypeScript | `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`; `npm run typecheck` = `tsc --noEmit` | CI'da hata = kırmızı |
| ESLint 9 + `typescript-eslint` (strict-type-checked) | `no-explicit-any`, `no-floating-promises`, `await-thenable`, `consistent-type-imports`, `no-console` (log yerine pino) | **Uyarı sayısı 0** ile CI geçer (`--max-warnings=0`) |
| Prettier 3 | Tek format kaynağı; ESLint biçim kurallarıyla çakışmaz | `npm run format:check` CI'da |
| `eslint-plugin-react-hooks` + `jsx-a11y` | Web tarafı | CI |
| `npm audit --audit-level=high` | Bağımlılık zafiyeti | CI'da yüksek/kritik bulgu = kırmızı |
| Prisma | `prisma validate` + `prisma migrate diff` (şema-migration tutarlılığı) | CI |
| husky + lint-staged | Commit öncesi lint + format | Yerel |

**Uyarı bastırma gerekçe ister.** `eslint-disable`, `@ts-expect-error`, `@ts-ignore` (bu sonuncusu tamamen yasak — `@ts-expect-error` kullanılır) yalnızca **aynı satırda tek cümlelik gerekçe** ile kullanılabilir:
```
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- iyzipay v2 tip tanımı sunmuyor, yanıt zod ile doğrulanıyor
```
Gerekçesiz bastırma code-reviewer tarafından **blokleyici** işaretlenir. Dev kodu **temiz** bırakır (0 uyarı), code-reviewer doğrular, devops CI'a bağlar.

---

## 10. Yerel Çalıştırma

Hedef: **tek komut**.
```
cp .env.example .env      # varsayılan yerel değerler çalışır durumdadır
docker compose up
```
Bu komut şunları ayağa kaldırır: `db` (Postgres 16), `minio` (S3 uyumlu yerel obje depolama), `mailpit` (giden e-postayı yakalayan yerel SMTP/UI), `api` (Nest, watch modunda, açılışta `prisma migrate deploy` + `seed`), `web` (Vite dev sunucusu). Ödeme sağlayıcısı yerelde `FakePaymentAdapter` ile çalışır (`PAYMENT_PROVIDER=fake`); sandbox testi yalnızca T-012 QA'sında açılır.

Kabul: temiz bir makinede `docker compose up` sonrası `http://localhost:5173` açılır, kayıt olunur ve tutanak oluşturulabilir — **hiçbir dış hesap/anahtar gerekmeden**.

Diğer komutlar (workspace kökünden): `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run build`, `npm run gen:api-types`.

---

## 11. Kapsam Disiplini (dev ajanı için son kural)

- PRD/backlog'da karşılığı olmayan hiçbir şey kodlanmaz: rol/yetki sistemi, hatırlatma zamanlayıcı, şablon editörü, karşılaştırma ekranı, analitik, soft delete, çoklu dil altyapısı — hepsi **v2+**.
- Bir ticket'ın kabul kriterini karşılamak için anayasayı esnetmek gerekiyorsa: esnetme, **rapor et**.
- `factory/04-architecture/*` dosyaları dev ajanı tarafından **değiştirilmez**; bunlar architect-agent'ın çıktısıdır.
