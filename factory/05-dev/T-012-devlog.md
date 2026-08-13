# Devlog — T-012

> Uretici: dev-agent | Branch: ticket/T-012 | Tarih: 2026-08-13
> Durum: kabul kriterlerinin tamami kod + test ile karsilandi (kosum ciktisi asagida).

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu, kosum sonrasi dogrulandi)

| Kabul kriteri | Karsilayan kod | Karsilayan test (hepsi YESIL) |
|---|---|---|
| 1. Giris yapmis kullanicinin odeme baslatma istegi 200/201 + islem referansi/yonlendirme bilgisi doner | `modules/billing/billing.controller.ts` (`POST /billing/checkout`, 201), `billing.service.ts::startCheckout`, `billing.repository.ts` (get-or-create abonelik + odeme satiri), `infra/payment/*` | e2e: `giris yapmis kullanicida 201 + islem referansi ve yonlendirme adresi doner`, `abonelik satirini olusturup pending yapar ve odeme satirini initiated yazar`, `ikinci kez cagrildiginda ayni abonelik satirini kullanir...`; birim: `billing.service.spec` (4 test) + `billing.repository.spec` (get-or-create 3 test) |
| 2. Basarili bildirimde abonelik "aktif" olur | `billing.controller.ts` (`POST /billing/webhook`), `billing.service.ts::handleNotification`, `billing.repository.ts::applyNotification` (kosullu UPDATE + ayni transaction'da abonelik gecisi) | e2e: `succeeded bildiriminde abonelik aktif olur ve donem sonu sunucuda hesaplanir`, `odeme satirini succeeded olarak damgalar (yeni satir YAZMAZ)`, `ayni bildirim ikinci kez geldiginde ... donem sonu DEGISMEZ`; birim: servis + repository testleri |
| 3. Basarisiz/reddedilen bildirimde abonelik "aktif"e gecmez ve durum acikca belirtilir | `billing.service.ts` failed dali (varsayilan Turkce neden), `applyNotification` `skipWhenActive` kosulu, `ConflictError('SUBSCRIPTION_ALREADY_ACTIVE')` | e2e: `failed bildiriminde abonelik aktife GECMEZ, /me pasif doner`, `reddedilme nedenini odeme satirina yazar`, `saglayici neden bildirmediginde sabit varsayilan neden yazilir`, `abonelik aktifken gelen failed bildirimi durumu DUSURMEZ`; birim: 3 servis + 1 repository testi |
| 4. `GET /me` guncel abonelik durumunu doner | Mevcut `modules/users` (T-003) — T-012 satiri yazdigi icin ek kod gerekmedi | e2e: checkout sonrasi `pending`, succeeded sonrasi `active` + `currentPeriodEnd`, failed sonrasi `inactive` (toplam 8 testte `/me` uzerinden dogrulaniyor) |
| 5. Kimliksiz istek `POST /billing/checkout`'ta 401 | Global `JwtAuthGuard` (T-003); bu route'ta `@Public()` YOKTUR | e2e: `tokensiz istek 401 UNAUTHENTICATED doner`, `bozuk token ile 401 doner` |

Sozlesme geregi ek olarak kapsanan davranislar: imzasiz bildirim -> `401 INVALID_WEBHOOK_SIGNATURE`
(+ durum degismez), zorunlu alan eksik -> `400`, taninmayan `providerReference` -> `200` + degisiklik yok,
sema disi ek alanlar -> `200` (CLAUDE.md §3.7 istisna 2), abonelik aktifken checkout -> `409`.

**Testlerin gercekten koruyor olmasi mutasyonla dogrulandi:** `processed_at IS NULL` kosulu ve
`skipWhenActive` kosulu gecici olarak kaldirildiginda tam olarak ilgili iki e2e testi KIRMIZI oldu
(`...donem sonu DEGISMEZ (idempotans)` ve `...failed bildirimi durumu DUSURMEZ`), sonra geri alindi.

## Iade turu 1 (code-reviewer CHANGES_REQUESTED — 2 madde, ikisi de ele alindi)

**BLOKLAYICI 1 — CI'da `templates.e2e-spec.ts` bootstrap'i patliyordu.** Sistematik hata ayiklama:
- *(1) Izole et:* CI kosulu birebir taklit edildi — `env -i` ile SADECE `DATABASE_URL` tanimlanip
  `npx jest --config test/jest-e2e.config.mjs --runInBand` kosuldu. Hata bileseni dogrulandi:
  `config.module.ts` (zod semasi) -> `main.ts` bootstrap, mesaj
  "Ortam degiskenleri gecersiz: SUBSCRIPTION_PRICE_AMOUNT (Required), PUBLIC_APP_URL (Required)".
- *(2) Hipotez (tek, test edilebilir):* Hata testin mantiginda degil, ENV KURULUMUNDA; T-012 bu iki
  anahtari varsayilansiz zorunlu yapti (`env.schema.ts`), `auth`/`health`/`billing` suite'lerinin
  `beforeAll`'u guncellendi ama `templates` suite'i atlandi. Yerelde gorulmemesinin nedeni: gelistirici
  kabuğunda `.env` degerleri yukluyken kosulmasi (CI'da `cp .env.example .env` adimi YOK).
- *(3) Test et:* En kucuk degisiklik — `templates.e2e-spec.ts` `beforeAll`'una `auth.e2e-spec.ts:57-58`
  ile ayni iki satir eklendi. Test mantigina, kurgusuna veya beklentilerine DOKUNULMADI (test zayiflatma
  yok; eksik olan yalnizca uygulama yapilandirmasiydi).
- *(4) Dogrula + regresyon:* Ayni CI-taklidi komut (`env -i` + yalnizca `DATABASE_URL`) artik
  **5 suite / 57 test PASS**. Bu kosum bicimi regresyon korumasinin ta kendisidir: suite'lerden biri
  gerekli env'i kurmayi unutursa yalnizca `DATABASE_URL` ile kosum kirmizi olur (CI'in gordugu kosul).
  Onceki turdaki "4 suite / 48 test" rakami bu suite'in kosumdan dusmus olmasindandi; dogru sayi 5/57.
- Not: CI is akisi (`ci.yml`) DEGISTIRILMEDI — kirilma testin env kurulumundan geliyordu ve is akisina
  env eklemek gercek eksigi maskelerdi; ayrica `ci.yml` bu ticket'in kapsaminda degil.

**BULGU 2 — olu kod.** `config.tokens.ts` icindeki `IYZICO_CONFIG` token'i ve `IyzicoConfig` arayuzu
SILINDI (grep ile tek referanslarinin kendi tanimlari oldugu dogrulandi). Sirlar zaten
`payment.module.ts`'te `ConfigService`'ten okunup adapter'a `IyzicoAdapterOptions` olarak veriliyor;
ikinci bir DI token'i karsiligi olmayan soyutlamaydi (CLAUDE.md §7.1). Kullanimda olan `BILLING_CONFIG`
ve `SUBSCRIPTION_CURRENCY` token'larina DOKUNULMADI.

**Iade turu dogrulamasi:** `npm run lint` (0 uyari), `npm run typecheck`, `npm run format:check`,
`npm test` (kok 22 + api 118 + web 10), `npm run build` ve CI-taklidi e2e (5 suite / 57 test) — hepsi yesil.

## Alinan Kararlar ve Gerekceler
- **Kapsam = API.** Ticket'in bes kabul kriteri de HTTP seviyesindedir; `apps/web` bu ticket'ta
  degistirilmedi. Gerekce: web tarafinda henuz router, `api/client.ts` ve React Query altyapisi YOK
  (T-001 yalnizca PWA iskeletini kurdu) ve bu altyapiyi T-012 icinde kurmak kapsam kaymasi olurdu.
  `architecture.md` §10 T-012 satirinda "apps/web abonelik ekrani" da anilir — bu ekran icin
  gereken tasarim sartnamesi (`design.md` SubscriptionPage) hazir; ekran, web altyapisini kuran
  ticket ile birlikte yapilmali. Backlog'da bunun ticket'i yok (asagida "ticket disi" notu).
- **Adapter + Port (§7).** `PaymentPort` + `IyzicoPaymentAdapter` + `FakePaymentAdapter`; hangisinin
  baglanacagini `PAYMENT_PROVIDER` belirler (`infra/payment/payment.module.ts`). `modules/billing`
  saglayiciya ozgu hicbir alan adi bilmez; imza dogrulama + normalizasyon tek port metodundadir
  (`verifyAndParseNotification`, architecture.md §8.5).
- **Idempotans mekanizmasi kosullu UPDATE'tir (§3.13, §7).** `updateMany({ where: { providerReference,
  processedAt: null } })` + `count` kontrolu; 0 ise abonelik tablosuna DOKUNULMAZ ve endpoint yine 200
  doner. `INSERT`+23505, `SELECT`-sonra-`UPDATE` ve uygulama ici kilit KULLANILMADI.
- **"Aktif abonelik failed ile dusurulmez" kurali kosula gomuldu.** Karar servistedir
  (`skipWhenActive: true`), SQL karsiligi repository'de `where: { status: { not: 'active' } }` olarak
  uygulanir — "oku, karar ver, yaz" yarisi bu sayede olusmaz.
- **Webhook govdesi icin DTO TANIMLANMADI.** Boylece `forbidNonWhitelisted` bu route'ta yapisal olarak
  devre disi kalir (CLAUDE.md §3.7 istisna 2 birebir): ek alanlar 400 uretmez, ham govde `rawBody`
  uzerinden port'a gider.
- **Hata hiyerarsisine yalnizca ihtiyac duyulan sinif eklendi:** `ExternalServiceError` (502,
  `PAYMENT_PROVIDER_ERROR`/`STORAGE_UNAVAILABLE`). Yeni hata KODU uydurulmadi (§4.2 kapsam kurali).
- **Para hicbir yerde float'a cevrilmedi.** `SUBSCRIPTION_PRICE_AMOUNT` env'den METIN olarak gelir,
  `numeric(12,2)` sutunlarina ve `CheckoutResponse.amount`'a birebir metin olarak yazilir; zod semasi
  `/^\d+\.\d{2}$/` ile bicimi acilista dogrular.
- **Donus adresi yapilandirmadan gelir** (ticket'taki sozlesme boslugu maddesi): `PUBLIC_APP_URL` +
  `/subscription?checkout=return` — `design.md` SubscriptionPage'in varsaydigi konvansiyonun aynisi,
  yeni env anahtari ICAT EDILMEDI. Origin koda gomulu degildir (sandbox/uretim farkli origin kullanir).
- **`SUBSCRIPTION_PERIOD_DAYS`/`PAYMENT_PROVIDER` icin §5.1'deki varsayilanlar semaya kondu**, ama
  `SUBSCRIPTION_PRICE_AMOUNT` ve `PUBLIC_APP_URL` icin varsayilan YOK (fiyat ve genel adres uydurulamaz).
  Bu ikisi zorunlu oldugu icin mevcut e2e testlerinin env kurulumuna eklendi (yalnizca env atamasi;
  test mantigi degistirilmedi) ve README'deki e2e notu guncellendi.
- **`z.string().url()` yetersizdi:** `localhost:5173` gibi protokolsuz degerleri gecirdigi icin
  `PUBLIC_APP_URL`'e http/https sarti eklendi — donus adresi bundan turedigi icin bicim hatasi
  acilista yakalanmali (test: `PUBLIC_APP_URL mutlak bir adres degilse reddeder`).
- **Verimlilik oz-kontrolu:** sicak yollarda ic ice dongu, dongu icinde DB/HTTP cagrisi ve sayfalamasiz
  tam-tablo cekisi YOK. checkout = 1 INSERT (veya 1 INSERT + 1 indeksli SELECT) + 1 saglayici HTTP
  cagrisi + 2 ifadelik transaction; webhook = 1 kosullu UPDATE (+ 1 indeksli SELECT + 1 UPDATE, yalnizca
  etkilenen satir 1 iken). Tum erisimler unique index uzerinden (`payment_transactions_provider_ref_key`,
  `subscriptions_user_id_key`).

## Varsayimlar
- **Idempotans anahtari = saglayicinin checkout form token'i.** `checkoutFormInitialize` yanitindaki
  `token` hem `CheckoutResponse.transactionReference` hem `payment_transactions.provider_reference`
  olarak kullanilir; iyzico bildirimindeki `token` alani da bununla eslesir.
- **Bildirim imzasi = ham govdenin HMAC-SHA256'si** (`IYZICO_WEBHOOK_SECRET`, hex, sabit zamanli
  karsilastirma). architecture.md §7 "imza/HMAC dogrulamasi ham govde uzerinde" diyor; iyzico'nun
  gercek baslik adi/algoritmasi sandbox'ta DOGRULANMALIDIR (QA notu, asagida).
- **Saglayici durum eslemesi:** `SUCCESS` -> `succeeded`, `FAILURE` -> `failed`; bunlar disindaki
  degerler (ornegin ara durumlar) zorunlu alan hatasi sayilir ve 400 doner — sessizce "failed"
  varsaymak abonelik durumunu yanlis yonde degistirebilirdi.
- **Kriter 3'teki "acikca belirtir"** su uc gozlemle karsilanir: `GET /me` -> `inactive`,
  `payment_transactions.status = failed` + `failure_reason` dolu, ve abonelik aktifken checkout ->
  `409 SUBSCRIPTION_ALREADY_ACTIVE`. Webhook yaniti sozlesmede govdesizdir (200); saglayiciya donen
  yanita "acikca belirtme" amaciyla sema disi bir govde EKLENMEDI.
- `FakePaymentAdapter` imzanin yalnizca VARLIGINI arar (yerelde dogrulanacak HMAC sirri yoktur;
  `IYZICO_*` yalnizca `PAYMENT_PROVIDER=iyzico` iken zorunludur). Uretimde bu adapter kullanilmaz.

## Anayasa (CLAUDE.md) Bosluklari
- **[BOSLUK — QA'yi etkiler] iyzico sandbox adresi icin env anahtari yok.** §5.1 tablosunda
  `IYZICO_*` sirlari var ama sandbox/production **taban adresi** (`uri`) icin anahtar YOK; dev kendi
  anahtarini icat etmeyecegi icin `payment.module.ts` icinde uretim adresi (`https://api.iyzipay.com`)
  sabit tutuldu ve yorumla isaretlendi. **Ticket'in QA modu "komsulu" oldugu icin sandbox kosumu bu
  anahtar eklenmeden yapilamaz** — onerilen anahtar: `IYZICO_BASE_URI` (§5.1 tablosuna satir).
  QA yerelde `PAYMENT_PROVIDER=fake` ile tum kriterleri kosabilir.
- **[CELISKI] §6.1 "zod yalnizca env semasi" vs §9 ornegi "iyzipay yaniti zod ile dogrulanir".**
  §6.1'e uyuldu: saglayici yaniti zod ile degil, el ile tip daraltmayla (`readString`) dogrulaniyor.
- **[BOSLUK] Saglayici yanit tipleri.** `iyzipay` v2 TS tipi sunmuyor; `any` sizmasin diye urunun
  fiilen kullandigi dar yuzey `src/infra/payment/iyzipay.d.ts` icinde bildirildi (`eslint-disable`
  gerekmedi, `--max-warnings=0` temiz).
- **[BOSLUK] pino henuz yok** (T-003'te de raporlanmisti): `warn`/`info` kayitlari Nest `Logger` ile
  yazildi (`no-console` ihlali yok).
- **[TASARIM/SOZLESME BOSLUGU] iyzico zorunlu alici alanlari.** Saglayici ad/soyad/TCKN/adres/IP
  zorunlu tutuyor; urun bu verileri TOPLAMIYOR (`design.md` §6.2 "kullanici goruntu adi yok").
  `IyzicoPaymentAdapter` icinde kimlik iddiasi tasimayan sabit yer tutucular tek bir blokta toplandi
  ve yorumla isaretlendi; sema genisletilirse tek noktadan degistirilir.

## Bilinen Sinirlamalar
- `IyzicoPaymentAdapter` yalnizca sahte istemciyle birim test edildi; **gercek/sandbox iyzico cagrisi
  bu ticket'ta kosulmadi** (anahtar + sandbox adresi anahtari yok). Alan adlari (`token`, `status`,
  `errorMessage`), imza basligi ve HMAC girdisi sandbox'ta dogrulanmali.
- `iyzipay` bagimliligi 4 **moderate** advisory getiriyor (`qs`, `uuid` — `postman-request` zinciri).
  §9 kapisi `--audit-level=high` oldugu icin `npm audit` cikis kodu **0**; yine de takip edilmeli
  (surum yukseltmesi ayri ticket konusudur).
- Terk edilmis checkout suresiz `pending` kalir (architecture.md §8.4 bilincli karari; zaman asimi isi
  YAZILMADI).
- Abonelik durumu hicbir yerde erisimi kisitlamaz (paywall kapsam disi).
- Hiz siniri (`429`) hala yok — webhook sozlesmede 60 istek/dk/IP diyor; throttler'i kuran ticket
  T-014'tur, bu ticket'in kriterlerinde yok.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- **Backlog eksigi:** `apps/web` icin sayfa/istemci altyapisini (router, `api/client.ts`, React Query)
  kuran bir ticket yok; `architecture.md` §10 birden fazla ticket'ta "apps/web ... ekrani" diyor.
  SubscriptionPage dahil tum ekranlar bu altyapiya bagli.
- `.env.example` icindeki `IYZICO_*` degerleri bos; `PAYMENT_PROVIDER=iyzico` secilirse uygulama
  acilmaz (bu bilincli/dogru davranis, yalnizca not).
- Calisma agacinda uretilmis ciktilar (`dist/`, `coverage/`) duruyor; izlenmiyorlar.

## Test Kosum Ciktisi (ozet)
```
npm run lint          -> 0 hata / 0 uyari (eslint --max-warnings=0)
npm run format:check  -> All matched files use Prettier code style!
npm run typecheck     -> temiz (kok + api + web)
npm test              -> kok 22/22, api 105/105, web 10/10
                         (kapsam: modules/billing %100 satir, infra/payment %96.3;
                          esikler: modules/** >= %80, global >= %70 — gecti)
npm run test:e2e      -> 5 suite / 57 test PASS
                         (billing.e2e 18, auth.e2e 16, migration.e2e 12, templates.e2e 9, health.e2e 2)
                         Iade turu 1: yalnizca DATABASE_URL tanimliyken (CI kosulu taklidi) de 5/57 PASS
npm audit --audit-level=high -> cikis kodu 0 (4 moderate, 0 high/critical)
npm run build         -> api + web derlendi
Mutasyon kontrolu     -> idempotans/aktif-koruma kosullari kaldirildiginda ilgili 2 e2e testi
                         KIRMIZI, geri alindiktan sonra YESIL
```
