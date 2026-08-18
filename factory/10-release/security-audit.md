# Guvenlik Denetim Raporu

> Uretici: security-auditor-agent | Branch: main | Tarih: 2026-08-18 (7. tur — release-prep,
> H-001..H-004 hotfix'leri sonrasi tam denetim)

## SONUC: FINDINGS

**ACIK CRITICAL/HIGH BULGU YOKTUR — GATE3 GUVENLIK ACISINDAN BLOKLANMIYOR.** Kalan
4 MEDIUM + 10 LOW bulgunun hicbiri release'i bloklamaz.

Denetim `main` (HEAD `5f86403`, "H-002: factory ticket (#35)") uzerinde URUNUN BUTUNU icin
BAGIMSIZ kosuldu; onceki turun sonuclarina guvenilmedi — endpoint envanteri yeniden koddan
cikarildi, tum PoC'ler (token sahteciligi, IDOR, dosya yukleme, hiz siniri, obje depolama,
log taramasi, git gecmisi, istemci paketi) SIFIRDAN yeniden uretildi. Onceki tur `374cce9`
(T-028) uzerinde kapanmisti; aradaki 6 commit (`43eddb7`, `98c05de`, `5b7662f`/H-001,
`34a5190`/H-003, `5abc3bc`/H-004, `5f86403`/H-002) tek tek incelendi (§0).
**Bu turda YENI bulgu cikmadi; onceki turun bulgu kumesi aynen gecerlidir.**

Dogrulama ortami: `docker compose -p secaudit7 up --build -d` ile URETIM imajlari
(`apps/api` `runtime` hedefi + `apps/web` Caddy imaji) **`NODE_ENV=production` ve
`PAYMENT_PROVIDER=iyzico`** ile ayaga kaldirildi (HTTP 8099), tum testler bu yigina karsi
kosuldu, sonrasinda `down -v` ile kaldirildi (dogrulandi: `secaudit7` adiyla container,
volume ve network kalmadi). Yalnizca YEREL ortam tarandi; hicbir 3. taraf/uretim hedefine
istek gonderilmedi. **Hicbir kaynak dosyaya dokunulmadi** — calisma agacina yazilan tek
dosya bu rapordur; compose kopyasi, `.env` ve tum gecici ciktilar `/tmp/secaudit7` altinda
uretildi (deponun `.env`'ine dokunulmadi).

## Bulgular

| ID | Siddet (CRITICAL/HIGH/MEDIUM/LOW) | Yer | Bulgu | Somuru senaryosu | Onerilen duzeltme |
|---|---|---|---|---|---|
| S-08 | MEDIUM | `.env.example:8` + `apps/api/src/config/env.schema.ts:7,78` (`MIN_JWT_SECRET_LENGTH = 16`, `JWT_SECRET: z.string().min(16)`) | Depoda **calisir haldeki** zayif varsayilan duruyor ve sema bunu URETIMDE de kabul ediyor: `JWT_SECRET=degistirin-yerel-gelistirme-anahtari` (36 karakter, `min(16)`'yi geciyor). `superRefine` blogu (`env.schema.ts:169-192`) yalnizca `PAYMENT_PROVIDER` icin fail-closed; `JWT_SECRET` icin uretim kosulu YOK. Bu tur CANLI iki adimda yeniden kanitlandi: (a) uretim imaji `NODE_ENV=production` + bu sirla **sorunsuz acildi** (`api` healthy, `/health` 200); (b) gercek bir tokenin payload'i (`{sub,email,iat,exp}`) alinip ayni sirla HS256 ile yeniden imzalandi → `GET /api/v1/me` **200** (tam hesap ele gecirme). `alg: none` → **401** (dogru davranis). | Operator uretim `.env`'ini ornekten kopyalar veya `JWT_SECRET`'i degistirmeyi unutursa, saldirgan istedigi `sub` ile token uretip HER hesabin verisine erisir. Olasilik dusuk (runbook §1 `.env`'i `touch` ile BOS acar, §2 tablosu satir 224 `openssl rand -base64 48` sart kosar — bu tur yeniden dogrulandi), etki azami. | `PAYMENT_PROVIDER`'daki (S-03) fail-closed desenini `JWT_SECRET`'e de uygulayin: `NODE_ENV=production` iken (a) `.env.example`'daki sabit degeri ve (b) 32 karakterden kisa degerleri sema duzeyinde REDDEDIN. Ek: `.env.example`'daki degeri semayi GECMEYEN bir yer tutucuya cevirin. |
| S-14 | MEDIUM | `apps/api/src/common/decorators/strict-rate-limit.decorator.ts` kullanimlari (yalnizca `auth.controller.ts:19,27`); `common/guards/rate-limit.factory.ts:21-40` | architecture.md §7 hiz siniri tablosunun **6 satirindan 4'u uygulanmamis**: onay ucu (5/dk/IP+token), genel goruntuleme (60/dk/IP), fotograf yukleme (60/dk/kullanici) ve webhook (60/dk/IP). Canli kanit (bu tur): `POST /reports/{id}/photos`, `GET /reports/{id}/pdf`, `POST /billing/webhook`, `GET /api/v1/me` yanitlarinin tamami `X-Ratelimit-Limit: 300`. `@StrictRateLimit()` grep'i tum uretim kodunda yalnizca 2 kullanim gosteriyor (ikisi de `auth.controller.ts`). PDF her istekte yeniden uretiliyor (onbellek yok) ve H-001 ile artik her belgeye ~1,4 MB gomulu font yaziliyor. | Ucretsiz kayit olan (e-posta dogrulamasi yok) bir saldirgan cok fotografli bir tutanak olusturur ve tek IP'den dakikada 300 kez `/pdf` cagirir; ayni sekilde webhook ucunda dakikada 300 HMAC dogrulamasi tetiklenir. Hedef donanim 2 vCPU tek instance'tir (architecture.md §5.1, otomatik olcekleme yok); CPU/bant genisligi doyar, erisilebilirlik butcesi (%99,5) coker. Veri gizliligi etkisi yok → MEDIUM. | architecture.md §7 tablosunu birebir uygulayan ikinci bir esik ekleyin (en az: `/pdf` ve fotograf yukleme icin kullanici basina 60/dk; onay ve webhook uclari icin tablodaki degerler). Ek: uretilen PDF'i `updated_at` + fotograf sayisina bagli olarak onbellege alin. |
| S-11 | MEDIUM | `apps/api/src/modules/sharing/sharing.controller.ts:33` + `share-link.service.ts:66-90` | `POST /reports/{id}/share-link/email` ISTEGE BAGLI bir alici adresine e-posta gonderiyor; kullanici/hesap basina gonderim kotasi YOK, e-posta dogrulama akisi YOK, kayit ucretsiz, uc genel 300/dk sinirinda. Canli kanit (bu tur yeniden): `recipientEmail: kurban@baskasinin-alani.test` → `202` + teslim kaydi (yerelde `RESEND_API_KEY` bos oldugu icin `status: "failed"`; uretimde anahtar gecerlidir). | Saldirgan dogrulanmamis hesap acar, icerigini kendi yazdigi bir tutanak + paylasim linki uretir ve bu ucu istedigi adres listesine dakikada 300 istekle kosar. Hedefe URUNUN dogrulanmis gonderen alan adindan, saldirganin yazdigi sayfaya goturen link ulasir → oltalama/spam kanali + gonderen alan adinin kara liste riski. Dogrudan veri sizmasi yok. | (a) Kullanici/tutanak basina gunluk paylasim e-postasi kotasi (`share_deliveries` sayimi) + bu uca sikilastirilmis hiz siniri; (b) kayit sonrasi e-posta dogrulama; (c) Resend tarafinda hacim uyari esigi. |
| S-04 | MEDIUM | `npm audit` (kok workspace): `iyzipay` → `postman-request` → `qs`, `uuid` | Bu tur yeniden kosuldu: `{critical: 0, high: 0, moderate: 4, low: 0}`. `qs` GHSA-q8mj-m7cp-5q26 (DoS, `6.11.1 - 6.15.1`), `uuid` GHSA-w5hq-g745-h8pq (`<11.1.1`). Tek kaynak `iyzipay`. `98c05de` ile eklenen `overrides: {deepmerge-ts: ^8.0.1}` yalnizca gelistirme zincirini ilgilendiriyor, bu iki paketi kapsamiyor. | Iki zafiyet de yalnizca giden saglayici cagrisindaki kod yollarinda; `qs.stringify` bizim kodumuzdan cagrilmiyor, `uuid` `buf` argumaniyla kullanilmiyor. Saldirgan kontrolunde bir giris bulunamadi. | `iyzipay`'in `postman-request` bagimliligini birakan surumunu izleyin; ara cozum `overrides` ile `qs@^6.15.2` + `uuid@^11.1.1` sabitleyip iyzico akisini duman testinden gecirmek. Release'i bloklamaz. |
| S-01 | ~~HIGH~~ **KAPALI** (T-024) | `apps/api/src/main.ts:21,32`, `common/guards/client-ip-throttler.guard.ts` | Hiz siniri sayaci istemci basina; sahte `X-Forwarded-For` sayaci sifirlamiyor. Canli yeniden dogrulandi (§0). | — (kapali) | — |
| S-02 | ~~MEDIUM~~ **KAPALI** (T-024) | `apps/web/Dockerfile` (Caddyfile `header`) | SPA kokeni CSP + HSTS + nosniff + `Referrer-Policy` tasiyor; `frame-ancestors 'none'`; `/t/*` icin `X-Robots-Tag: noindex`. Canli yeniden dogrulandi (§0, §5). | — (kapali) | — |
| S-03 | ~~MEDIUM~~ **KAPALI** (T-024) | `apps/api/src/config/env.schema.ts:110,169-192` | `PAYMENT_PROVIDER` zorunlu, varsayilani yok; `NODE_ENV=production` iken `fake` reddediliyor (fail-closed). Bu tur yigin bilerek `production` + `iyzico` ile kaldirildi; sema karari statik olarak da dogrulandi. | — (kapali) | — |
| S-13 | ~~HIGH~~ **KAPALI** (622be61) | `.github/workflows/cd.yml:24-28` | `publish` isi tetikleyen kosumun DEPO kimligini ve olay turunu dogruluyor. Statik dogrulama bu turda yeniden yapildi (§3). | — (kapali) | — |
| S-05 | LOW | `apps/web/vite.config.ts:36` (`build.sourcemap: true`) | Uretim imaji source map yayinliyor. Canli kanit (bu turun uretim imaji): `GET /assets/index-N0fA6yCz.js.map` → `200`, 1.694.997 bayt; `GET /sw.js.map` → `200`. | Tum istemci TypeScript kaynagi (dosya adlari, is kurallari, uc listesi) herkese acilir; kesif kolaylasir. Paketlenmis sir YOK (bundle taramasi: `VITE_*`/`import.meta.env`/saglayici anahtari deseni **0 eslesme**), dogrudan kimlik bilgisi sizmasi yok. | `sourcemap: false` ya da `'hidden'` (map uretilir, `/srv`'ye kopyalanmaz). |
| S-06 | LOW | `apps/api/Dockerfile` (`runtime`), `apps/web/Dockerfile` (`runtime`) — `USER` yok | Iki uretim imaji da root ile calisiyor. Canli kanit (bu tur): `docker run --rm --entrypoint id secaudit7-api` ve `...-web` → `uid=0(root)`. Ek: API `runtime` imaji `devDependencies` dahil tum `node_modules`'u tasiyor (gerekcelendirilmis bilinen sinirlama). | Uygulama icinde RCE'ye varan bir zafiyet olusursa container icinde ayricalik yukseltmeye gerek kalmaz. Tek basina somurulebilir degil. | `USER node` (api) ve Caddy imajinin root olmayan kullanicisi; migration/seed'i ayri bir baslatma adimina alip `npm prune --omit=dev` uygulanabilir hale getirmek. |
| S-07 | LOW | `apps/api/src/modules/auth/jwt.strategy.ts`, `apps/web/src/api/access-token.ts`, `main.tsx:22` | Sunucu tarafinda oturum sonlandirma yok: cikis yalnizca `localStorage`'daki tokeni siler; imzali token `JWT_EXPIRES_IN=7d` boyunca gecerli (`jti`/deny-list yok, `validate()` DB'ye hic gitmiyor). Canli dogrulandi: payload `{sub, email, iat, exp}`, `exp - iat = 604800` sn. architecture.md §7'de bilincli MVP karari. | Token bir kez sizarsa (paylasilan cihaz, sizmis yedek/log) hicbir islem — parola degisikligi dahil — onu iptal edemez; pencere 7 gun. | MVP kapsaminda kabul; sonraki turda kisa omurlu access + refresh ya da `jti` deny-list. Ara onlem: uretimde `JWT_EXPIRES_IN` kisaltmak. |
| S-09 | LOW | `factory/10-release/runbook.md §5` (satir 297-322), `factory/04-architecture/data-model.sql` | KVKK: gecelik `pg_dump \| gzip` yedekleri kisisel veri (kullanici e-postasi, `approvals.approver_email:286`, `share_deliveries.recipient_email:264`, serbest metin baslik/not) iceriyor, R2'ye SIFRELENMEDEN yaziliyor (runbook satir 304-322: `gzip` + `aws s3 cp`, hicbir `gpg`/SSE adimi yok) ve bu dosyalar kisisel veri olarak isaretlenmiyor. Urunde silme/imha akisi yok — kodda **hicbir `@Delete` yok** (canli: `PUT/PATCH/DELETE /reports/{id}` ve `DELETE /me` → `404`). | Yedek kovasina erisen (calinmis R2 anahtari) taraf tum e-postalara ve tutanak metinlerine ulasir; KVKK silme talebi uygulama uzerinden karsilanamaz, elle SQL gerekir. | Yedeklere sifreleme (`gpg --symmetric` ya da R2 SSE-C) + runbook'a "bu dosyalar kisisel veri icerir" notu; saklama suresi PRD acik sorusu kapaninca `ON DELETE CASCADE` uzerine kurulu hesap/tutanak silme ticket'i (R2'deki fotograf objeleri cascade ile SILINMEZ, ayrica temizlenmeli). |
| S-10 | LOW | `apps/api/src/main.ts:21` (`TRUSTED_PROXY_HOP_COUNT = 1`) | S-01'in cozumu bir TOPOLOJI DEGISMEZINE bagli: "istemci ile API arasinda tam olarak bir guvenilen hop var ve API dogrudan erisilebilir degil". Bu tur iki yerde yeniden dogrulandi: (a) uretim provasi compose'unda `api` port YAYINLAMAZ (`docker compose ps` → `api: 3000/tcp`, yalnizca `web` 8099→80); (b) runbook §1'deki URETIM compose sablonunda da `api` servisinde `ports:` yok (yalnizca `web: ports: ['80:80','443:443']`). | Uretimde somurulebilir DEGIL. Risk gelecekte: (a) sorun giderme icin `api` portu gecici acilirsa, (b) Caddy onune ikinci bir vekil (Cloudflare vb.) konur ve hop sayisi 1'de kalirsa hiz siniri sessizce kaybolur. | Degismezi otomasyonla sabitleyin ("uretim compose'unda `api` port yayinlamaz" regresyon testi) + runbook §1'e "Caddy onune baska bir vekil eklenirse `TRUSTED_PROXY_HOP_COUNT` artirilmalidir" uyarisi. |
| S-12 | LOW | `apps/api/src/modules/auth/auth.controller.ts:18-20` → `EMAIL_ALREADY_REGISTERED` | Kayit ucu hesabin varligini sizdiriyor (sozlesmede 409 tanimli davranis). Giris ucu sizdirmiyor: `auth.service.ts:40,64-75` dummy-hash acilista uretiliyor ve `bcrypt.compare` her iki dalda kosulsuz calisiyor; bilinmeyen kullanici ile yanlis parola AYNI `401` doner (canli: bilinmeyen e-posta → `401`). | Saldirgan e-posta listesini kayit ucuna vererek hangi adreslerin hesabi oldugunu ogrenir. Hiz siniri 5/dk/IP oldugu icin olcek dusuk. | Kabul edilebilir MVP takasi; sikilastirilirsa kayit yanitini her durumda 202 yapip varligi e-posta kanalindan bildirmek (S-11'in e-posta dogrulama onerisiyle ayni ticket). |
| S-15 | LOW | Kimlik dogrulamali tum API yanitlari + `/public/*` (`apps/api/src/main.ts` — global `Cache-Control` yok) | Kisisel veri tasiyan yanitlarda `Cache-Control: no-store` YOK. Canli kanit (bu tur): `GET /api/v1/me`, `GET /reports/{id}/pdf` (`Content-Disposition: attachment`) ve `GET /public/reports/{token}` yanitlarinin hicbirinde `Cache-Control`/`Expires`/`Pragma` yok. | Paylasilan bir cihazda (urunun asli senaryosu: ofis tableti, kiracinin telefonu) tarayici disk onbelleginde tutanak metni, e-posta adresi ve PDF kopyasi kalabilir; oturum kapatildiktan sonra da diskte durur. Fiziksel/yerel erisim gerektirdigi icin LOW. | Kimlikli ve `/public/*` yanitlarina global bir interceptor ile `Cache-Control: no-store` (PDF icin ayrica `Pragma: no-cache`) ekleyin. |
| S-16 | LOW | `.github/workflows/factory-deploy.yml:22-27` | `workflow_dispatch` girdileri (`inputs.sha`, `inputs.artifact_sha`) `run:` blogunda dogrudan `${{ }}` ile enterpole ediliyor — kabuk enjeksiyonu deseni. Is su an fail-closed (`exit 1`), gercek bir deploy yapmiyor. | Depoya yazma yetkisi olan biri `sha` girdisine kabuk metakarakteri koyarak runner'da komut calistirabilir; yetki zaten yuksek oldugu icin ayricalik kazanci sinirli. Saglayici baglandiginda risk buyur. | Girdileri `env:` uzerinden gecirip `run:` icinde `"$SHA"` seklinde tirnakli kullanin (GitHub'in onerdigi desen). |
| S-17 | LOW | `apps/api/src/modules/sharing/*`, `modules/approvals/mappers/approval.mapper.ts`, `data-model.sql:234-241` | Paylasim linki SURESIZ ve iptal edilemez (`share_links` tablosunda `expires_at` sutunu YOK; sona erdirme/silme ucu yok) ve link sahibi olan HERKES onaylayanin e-posta adresini gorur. Canli kanit (bu tur): onay sonrasi kimliksiz `GET /public/reports/{token}` → `approval: {id, approverEmail: "onaylayan@ornek.test", approvedAt}`. | Link WhatsApp/e-posta ile ileri gonderildiginde (urunun tasarlandigi kullanim) tutanagin fotograflari, notu ve onaylayanin e-postasi zincirdeki herkese acik kalir; tutanak sahibinin linki geri alma yolu yoktur. Token tahmin edilemez (32 bayt `randomBytes`, canli olculen uzunluk 43 karakter base64url), bu yuzden kitlesel erisim degil hedefli sizinti. | v2 icin: paylasim linkine son kullanma tarihi + iptal (revoke) ucu; onay bilgisini genel goruntulemede maskeleyerek gostermek (`o***@ornek.com`). MVP'de sozlesme geregi mevcut davranis kabul. |
| S-18 | LOW | `tools/` (11 spec dosyasi; `cd.yml` gecen **sifir** eslesme) | S-13'un duzeltmesi **hicbir regresyon testiyle kilitlenmemis**. Kanit (bu tur yeniden): `tools/` altinda `cd.yml`, `workflow_run` ya da `head_repository` gecen sifir eslesme; `ci-workflow.spec.ts` yalnizca `ci.yml`'i dogruluyor. Diger guvenlik degismezleri kilitli (`dependency-install-scripts.spec.ts`, `rate-limit-config.spec.ts`, `bcrypt-hash-literal.spec.ts`, yeni `pdf-font-asset.spec.ts`), bu bir tutarsizlik. | Ileride bir refactor ya da "CD'yi elle tetikleyebilelim" talebi `if:` kosulundaki `head_repository`/`event` kontrolunu sessizce kaldirabilir; CI yesil kalir ve S-13 (HIGH, tedarik zinciri) fark edilmeden geri doner. Bugun somurulebilir DEGIL. | `tools/cd-workflow.spec.ts` ekleyin: `cd.yml` YAML'ini cozup `publish.if` ifadesinin hem `head_repository.full_name == github.repository` hem `workflow_run.event == 'push'` icerdigini dogrulayin (yorum satiri kanit sayilmamali). Ayni testte S-10'un "uretim compose'unda `api` port yayinlamaz" degismezi de kilitlenebilir. |

## Denetim Kapsami ve Kanitlar

### 0. Onceki Turdan Bu Yana Gelen Commit'ler + Kapali Bulgularin Yeniden Dogrulanmasi

Onceki tur `374cce9`'da kapanmisti. `374cce9..HEAD` arasindaki 6 commit'in tamami
incelendi (`git diff` ile, dosya dosya):

| Commit | Icerik | Guvenlik degerlendirmesi |
|---|---|---|
| `43eddb7` | CHANGELOG/README metni | Etkisiz |
| `98c05de` | `package.json` → `overrides: {deepmerge-ts: ^8.0.1}` | Yalnizca gelistirme zinciri; `npm audit` bu turda yine 0 critical/0 high (§4). Uretim bagimlilik agacinda degisiklik yok. |
| `5b7662f` (H-001) | PDF'e Unicode font GOMME: `report-pdf.builder.ts` artik `readFileSync(join(__dirname,'fonts'), ...)` ile 2 TTF okuyup `registerFont` ediyor; `apps/api/scripts/copy-pdf-fonts.mjs` + `tools/pdf-font-asset.spec.ts` | Yol **koda gomulu sabit**, istek/kullanici girdisi ICERMEZ → path traversal yuzeyi yok. Baytlar modul yuklenirken BIR kez okunuyor (istek basina G/C yok). Uretim imajinda fontlar mevcut: canli `GET /reports/{id}/pdf` → `200 application/pdf`. Yeni girdi/yetki yuzeyi yok. |
| `34a5190` (H-003) | `useSubscriptionAutoRefresh.ts` — `pending` abonelikte artan aralikli yoklama | Yalnizca istemci. Aralik dizisi SABIT ve SONLU (`[3,5,8,12,15,20,25] sn`, toplam ~88 sn), `pending` bitince duruyor → sunucuya donuk sinirsiz cagri yok. Cagrilan tek uc `GET /me` (kendi verisi). |
| `5abc3bc` (H-004) | `apps/web/src/styles/app.css` + duzen testleri | Yalnizca CSS/duzen; sink veya veri akisi degisimi yok. |
| `5f86403` (H-002) | Kullaniciya donuk metinlerin duzgun Turkce'ye cevrilmesi (API hata mesajlari, DTO mesajlari, iyzico sepet kalemi adi) | Metin degisikligi; hata KODLARI (`VALIDATION_ERROR`, `FORBIDDEN`, `INVALID_WEBHOOK_SIGNATURE`, ...), HTTP durumlari ve dallanma mantigi degismemis. `all-exceptions.filter.ts` 5xx'te hala sabit mesaj + `traceId` donuyor, framework metni sizmiyor. Yeni mesajlarin hicbiri girdi yankilamiyor (canli hata zarflari incelendi). |

Kapali bloklayan bulgular yine de SIFIRDAN yeniden kanitlandi:

**S-01 (HIGH) — KAPALI.** Caddy uzerinden, her istekte farkli sahte
`X-Forwarded-For: 9.9.9.N` ile `POST /api/v1/auth/login` (8 istek):

```
401 401 401 429 429 429 429 429
```

(Bu IP'den daha once 2 gercek giris yapildigi icin 5'lik strict butcenin 3'u kalmisti;
sahte XFF sayaci SIFIRLAMIYOR.)

**S-02 (MEDIUM) — KAPALI.** Uretim web imajindan canli baslik ciktisi (`GET /`):

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
  base-uri 'self'; frame-ancestors 'none'; form-action 'self';
  img-src 'self' data: blob: http://localhost:9000; connect-src 'self' http://localhost:9000
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```

`/t/<token>` ayrica `X-Robots-Tag: noindex` tasiyor (canli). CSP'de `unsafe-inline` YOK →
`localStorage` token karari icin architecture.md §7'nin sart kostugu "kati CSP" telafi
kontrolu FIILEN mevcut.

**S-03 (MEDIUM) — KAPALI.** Yigin bu turda bilincli olarak `NODE_ENV=production` +
`PAYMENT_PROVIDER=iyzico` ile kaldirildi ve acildi; sema `superRefine` blogu
(`env.schema.ts:169-192`) uretimde `fake` degerini reddediyor (kod duzeyinde dogrulandi,
onceki turda ayrica canli kanitlanmisti).

**S-13 (HIGH) — KAPALI.** `.github/workflows/cd.yml:24-28` kosulu yerinde:
`conclusion == 'success' && head_repository.full_name == github.repository &&
workflow_run.event == 'push'`. Statik akil yurutme (canli GitHub tetiklemesi YAPILMADI —
yasak): catal PR'inin CI kosumu `workflow_run.event == 'pull_request'` uretir ve ikinci
kosul eler; catal deposunun kosumunda `head_repository.full_name` taban depodan farklidir
ve birinci kosul eler. `permissions` daraltilmis (`contents: read`, `packages: write`),
kalici sir yok (`secrets.GITHUB_TOKEN`). Kalan artik risk: kosul testle kilitlenmemis →
S-18 (LOW).

### 1. Kimlik ve Yetki Butunu

Envanter KODDAN cikarildi (`@Controller/@Get/@Post/@Put/@Patch/@Delete/@Public/
@StrictRateLimit/@UseGuards/@UseInterceptors` taramasi, spec'ler haric), sozlesmeden degil.
Global varsayilan KAPALI (`app.module.ts:43-51` → once `APP_GUARD: ClientIpThrottlerGuard`,
sonra `JwtAuthGuard`), istisnalar yalnizca `@Public()`. **`@Put/@Patch/@Delete` HIC YOK**
(canli: `PUT/PATCH/DELETE /reports/{id}` ve `DELETE /me` → `404`; silme akisinin yoklugu
icin bkz. S-09). Rol modeli yok (PRD kapsam disi) — "rol kontrolu eksik uc" kavrami
uygulanabilir degil.

| # | Endpoint | Auth | Obje-seviyesi yetki / kanit |
|---|---|---|---|
| 1 | `GET /health` (onek disi) | Public (bilincli) | `health.controller.ts:16-17`; govde yalnizca `{"status":"ok"}` |
| 2 | `POST /api/v1/auth/register` | Public + StrictRateLimit | `auth.controller.ts:18-20`; varlik sizintisi → S-12 |
| 3 | `POST /api/v1/auth/login` | Public + StrictRateLimit | `auth.controller.ts:26-28`; kullanici yoksa da bcrypt maliyeti odenir (`auth.service.ts:64-75`) |
| 4 | `GET /api/v1/me` | JWT | yalnizca `user.userId` ile okur; kimliksiz → `401` |
| 5-6 | `GET /api/v1/templates`, `/templates/{id}` | JWT | sabit sablon listesi, kullanici verisi yok; kimliksiz → `401` |
| 7 | `POST /api/v1/reports` | JWT | sahiplik token'dan (`reports.service.ts:32-34`); istemci `ownerId`/`status` gonderemez (canli mass-assignment testi) |
| 8 | `GET /api/v1/reports` | JWT | `buildOwnerFilter` her zaman `{ownerId}` ekler (`reports.repository.ts:170-181`) |
| 9-10 | `GET /api/v1/reports/{id}`, `/{id}/pdf` | JWT + IDOR guard | `assertOwnership` PDF uretiminden ONCE (`reports.service.ts:71,87,115-124`) |
| 11-12 | `POST/GET /api/v1/reports/{id}/photos` | JWT + IDOR guard | `photos.service.ts:52,91,126-132` |
| 13-15 | `POST/GET /reports/{id}/share-link`, `POST .../share-link/email` | JWT + IDOR guard | `share-link.service.ts:46,52,71,93-99` — her metodun ILK isi |
| 16 | `POST /api/v1/billing/checkout` | JWT | kimlik yalnizca token'dan (`billing.controller.ts:25`); canli kimliksiz → `401` |
| 17 | `POST /api/v1/billing/webhook` | Public + HMAC imza | `iyzico-payment.adapter.ts:104-122`: HMAC-SHA256 HAM govde uzerinde, uzunluk kontrolu + `timingSafeEqual`; govde imzadan ONCE ayristirilmiyor. Canli: imzasiz → `401 INVALID_WEBHOOK_SIGNATURE`, uydurma imza → `401` |
| 18-19 | `GET /public/reports/{shareToken}`, `POST .../approval` | Public (yetenek token'i) | 32 bayt `randomBytes` → base64url (`share-token.generator.ts`), canli token uzunlugu 43; yanitta sahip kimligi TASINMIYOR |

Canli regresyon (gercek iki hesapla, uretim imaji uzerinde):

```
Kimliksiz: /me 401 | /reports 401 | /templates 401 | /reports/{id} 401
           /reports/{id}/pdf 401 | /photos 401 | /share-link 401
           POST /billing/checkout 401
Yontem: PUT 404 | PATCH 404 | DELETE 404 | DELETE /me 404
IDOR (B kullanicisi, A'nin tutanagi a861fa10-...):
  GET /reports/{id} 403 | /pdf 403 | /photos 403 | GET share-link 403
  POST share-link 403 | POST share-link/email 403
Mass assignment (ownerId+status govdede): 400 VALIDATION_ERROR
  details: ["property ownerId should not exist","property status should not exist"]
Token sahteciligi: alg:none -> 401 | zayif .env.example sirriyla HS256 -> 200 (S-08)
Genel uc alanlari = [approval, createdAt, disclaimer, isApproved, note, photos, status,
  templateName, title] — sahip e-postasi/id'si YOK; gecersiz token -> 404
Onay: 201 -> mukerrer onay 409 | onayli tutanaga fotograf -> 409 (kanit dondurma)
```

Korunmasiz kalmis endpoint YOK; sahiplik kurali tum kaynak modullerinde (reports, photos,
sharing) AYNI `assertOwnership` desenini kullaniyor — tutarsizlik bulunamadi.

### 2. Girdi Isleme

- **SQL enjeksiyonu:** uretim kodunda `$queryRaw*`/`$executeRaw*`/`Unsafe` **yok** (grep;
  tum eslesmeler `apps/api/test/` altinda). Tum sorgular Prisma parametreli; sahiplik
  filtresi her zaman ekleniyor (`reports.repository.ts:170-181`). Arama terimi
  `MaxLength(100)` + `trim` ile kirpiliyor, sayfa boyutu `Max(50)` (kaynak tuketimi siniri).
- **Komut/path enjeksiyonu:** uretim kodunda `child_process`/`spawn(`/`eval(`/`new Function`
  **yok**; tek `exec` eslesmesi `RegExp.exec` (`access-token-ttl.parser.ts:49`). H-001 ile
  gelen `readFileSync(join(__dirname,'fonts'), ...)` yolu SABIT, kullanici girdisi almiyor.
  Depolama anahtari SUNUCUDA uretiliyor: `reports/{reportId}/{randomUUID}.{uzanti}`.
- **Dosya yukleme (canli, uretim imaji):**
  ```
  PHP govdeli .jpg (Content-Type: image/jpeg beyaniyla) -> 400 UNSUPPORTED_MEDIA_FORMAT
  12 MB dosya                                            -> 400 FILE_TOO_LARGE
  filename=../../../etc/passwd.png (gecerli PNG) + capturedAt=1999-01-01 + sortOrder=99
     -> 201; anahtar: reports/a861fa10-.../3e70c4ed-....png (kullanici dosya adi HIC kullanilmiyor)
        capturedAt yaniti 2026-08-18T08:26:59Z = SUNUCU damgasi (istemci degeri yok sayildi)
  ```
  Boyut siniri multer'da AKIS sirasinda uygulaniyor (`photos.module.ts:18-21`
  `limits: {fileSize: PHOTO_MAX_BYTES}`) — govde bellekte sinirsiz buyuyemez; 413
  sozlesmedeki 400 `FILE_TOO_LARGE`'a ceviriliyor. Tip beyandan degil ICERIKTEN (`sharp`
  metadata) belirleniyor; goruntu yeniden kodlanip kucultuluyor (EXIF/gomulu yuk temizlenir).
- **Servis edilme:** fotograflar yalnizca on-imzali GET URL'i ile
  (`X-Amz-Algorithm=AWS4-HMAC-SHA256`, `X-Amz-Expires=900` — canli olculdu). Kova genel
  DEGIL: compose agindan imzasiz obje istegi `403`, kova listeleme `403`.
- **Depolanan XSS provasi:** `title` alanina `<img src=x onerror=alert(1)>` yazildi; API ham
  metin olarak saklayip JSON'da donduruyor (dogru), istemcide React kacisi + CSP
  (`script-src 'self'`, inline yok) ile calistirilamaz; istemci kodunda hicbir HTML sink'i
  yok (§7).
- **Statik sunucu (Caddy) yol guvenligi:** `/.env`, `/.git/config`, `/assets/../.env`,
  `/assets/` (dizin listeleme) → hepsi **SPA index.html fallback'i** (200, `text/html`);
  hicbir dosya sizmiyor, dizin listeleme yok. `TRACE`/`OPTIONS` → `405`.
- **Webhook:** imza dogrulanmadan govde ayristirilmiyor; ham govde loga/yanita cikmiyor.
- **Hata zarfi:** `all-exceptions.filter.ts` — 5xx'te framework mesaji istemciye
  gonderilmiyor, sabit Turkce mesaj + `traceId` (H-002 sonrasi da ayni).

### 3. Secrets ve Konfig (git gecmisi dahil)

- `git log --all -p` (package-lock ve TTF haric, 100.076 satir diff) uzerinde desen taramasi
  (`AKIA[0-9A-Z]{16}`, `ghp_`, `gho_`, `re_`, `sk_live_`, `xox*`, PEM ozel anahtar,
  `eyJhbGciOi`) → **gercek sir bulunmadi**. Tek `eyJhbGciOi` eslesmesi
  `'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'` = imzasiz JWT baslik literali (test fixture'i).
  Atama bicimli tarama (`(SECRET|API_KEY|PASSWORD|TOKEN|PRIVATE_KEY|ACCESS_KEY)...`) yalnizca
  test fixture'lari dondurdu (`'api-anahtari'`, `'webhook-sirri'`, `'cok-gizli-8'`,
  `'gizli-parola-123'`, `'re_anahtar'`, `'minioadmin'`, sabit bcrypt hash'i —
  `tools/bcrypt-hash-literal.spec.ts` ile kilitli).
- `.env` HIC commit edilmemis (`git log --all -- .env` bos); `.gitignore` `.env` + `.env.*`
  disliyor (`!.env.example` haric).
- **Zayif calisir varsayilan** `JWT_SECRET=degistirin-yerel-gelistirme-anahtari`
  `.env.example`'da duruyor; sema (`min(16)`) bunu URETIMDE de kabul ediyor — bu tur
  `NODE_ENV=production` uretim imajinin bu sirla actigi ve token'in sahtelenebildigi CANLI
  gosterildi → **S-08**.
- Loglama: 87 satirlik tam `docker compose logs api` ciktisi tarandi — test kullanicisinin
  e-postasi, parolasi, onaylayan/alici e-postasi, bearer token (`eyJhbGciOi`),
  `password|authorization|jwt_secret|minioadmin|X-Amz-Signature` kelimelerinin tamami
  **0 kez** geciyor. E-posta adresleri saglayici adapterinde maskeleniyor (canli ornek:
  `to=k***@baskasinin-alani.test`). TC kimlik no toplanmiyor.
- **`.github/workflows/cd.yml`:** kalici sir kullanmiyor, izinler daraltilmis, catal
  kaynakli tetikleme eleniyor (§0) → S-13 KAPALI, kalan S-18 (LOW).
- `ci.yml` `pull_request` (`_target` DEGIL) ile kosuyor ve hicbir sir okumuyor → catal PR'i
  ayricalikli baglam kazanamaz. `factory-deploy.yml` fail-closed ama girdi enterpolasyonu
  tasiyor → **S-16 (LOW)**.
- **Uretim yolunda `.env.example` KOPYALANMIYOR:** runbook §1 satir 110-116 `touch .env` +
  `chmod 600`, §2 satir 224 `JWT_SECRET` icin `openssl rand -base64 48` sart kosuyor.
  S-08'in MEDIUM kalmasinin (HIGH'a cikmamasinin) gerekcesi budur.
- `docker-compose.e2e.yml`'deki `POSTGRES_PASSWORD: tutanak` bilincli bir duman testi
  fixture'idir (host'a port acmayan, `down -v` ile silinen yigin); uretim compose'u
  (runbook §1) sifreyi `${POSTGRES_PASSWORD}` ile ortamdan alir — dogrulandi.

### 4. Bagimliliklar (arac ciktisi)

`npm audit` (kok, tum workspace'ler) bu turda kosuldu:

```
{'info': 0, 'low': 0, 'moderate': 4, 'high': 0, 'critical': 0, 'total': 4}
iyzipay >=2.0.68 -> postman-request -> qs   (GHSA-q8mj-m7cp-5q26, DoS, 6.11.1-6.15.1)
                                     -> uuid (GHSA-w5hq-g745-h8pq, <11.1.1)
```

**0 critical / 0 high.** Detay ve surum onerisi **S-04**. Web tarafinda zafiyetli paket yok.
Uretim API imajinin `devDependencies`'i de tasidigi not edildi → S-06 onerisine baglandi.
`npm ci --ignore-scripts` iki Dockerfile'da da devrede (kurulum aninda calisan bagimlilik
script'leri kapali; telafi adimlari `npm rebuild bcrypt sharp` + `prisma generate` acikca
yazili, `tools/dependency-install-scripts.spec.ts` ile kilitli) — imaj bu turda da sagliklı
ayaga kalkti ve `sharp`/`bcrypt` yollari canli testlerde calisti.

### 5. Web Katmani (basliklar / CORS / cookie / rate limit provasi)

- **API basliklari (helmet, canli `/health`):** CSP, `Strict-Transport-Security:
  max-age=31536000; includeSubDomains`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: no-referrer`, `X-Frame-Options: SAMEORIGIN`,
  `Cross-Origin-Opener/Resource-Policy: same-origin`,
  `X-Permitted-Cross-Domain-Policies: none`, `X-DNS-Prefetch-Control: off`,
  `Origin-Agent-Cluster: ?1`.
- **SPA kokeni (Caddy):** tam set mevcut → §0 / S-02 kanitlari.
- **CORS:** `enableCors` cagrilmiyor. Canli kanit: `Origin: https://evil.example` ile
  istekte `Access-Control-Allow-*` basligi sayisi **0**; preflight `OPTIONS /reports` →
  `404`. Web ve API ayni kokende (Caddy `/api/*` → `api:3000`); **joker + credentials
  hatasi YOK**.
- **Cookie:** urun cookie kullanmiyor — `POST /auth/login` yanitinda `Set-Cookie` sayisi
  **0** (token `Authorization: Bearer`). Cookie bayragi bulgusu uygulanabilir degil;
  bedeli §7 / S-07.
- **Rate limiting FIILEN AKTIF:** `X-Ratelimit-Limit`, `X-Ratelimit-Remaining`,
  `X-Ratelimit-Reset: 60` her yanitta; kimlik uclarinda 5/dk ve 429 canli uretildi (§0).
  ANCAK architecture.md §7 tablosundaki dort ozel sinir uygulanmamis → **S-14 (MEDIUM)**.
- **Cache basliklari:** kimlikli ve genel yanitlarda `Cache-Control` yok → **S-15 (LOW)**.

### 6. Veri Koruma (KVKK)

Kisisel veri tasiyan tablolar (`data-model.sql`): `users:88` (e-posta `citext`, bcrypt
hash), `reports:147` (`title`/`note` serbest metin — kiraci/mulk bilgisi icerebilir),
`report_photos:187` (R2'de fotograf), `share_deliveries.recipient_email:264`,
`approvals.approver_email:286` (+ tanimli ama kodun HIC doldurmadigi
`ip_address:289`/`user_agent:290` — gereksiz kisisel veri toplanmiyor),
`payment_transactions:362` (saglayici referansi, kimlik degil).

- Parola bcrypt cost 10 (`auth.service.ts:15,56`); duz metin hicbir yerde
  saklanmiyor/loglanmiyor (§3 log taramasi).
- Fotograflar genel olmayan kovada; erisim yalnizca 900 sn omurlu on-imzali URL ile
  (canli: imzasiz obje erisimi `403`, kova listeleme `403`). T-028 ile EXIF/GPS cihazda
  dusuruluyor.
- Uygulama seviyesinde ek alan sifrelemesi bu veri hacmi/tehdit modeli icin gerekli
  gorulmedi; **yedekler** icin gerekli → S-09.
- Silme akisi: `ON DELETE CASCADE` zinciri DDL'de dogru kurulu (`reports:149`,
  `report_photos:189`, `share_links:236`, `share_deliveries:260`, `approvals:284-285`,
  `subscriptions:320`, `payment_transactions:364`) ama tetikleyen endpoint/prosedur YOK
  (kodda hic `@Delete` yok; canli 404) ve R2 objeleri cascade ile silinmez → S-09.
- Yetenek linki suresiz + onaylayan e-postasi link sahibine acik → S-17.
- Istemci tarafinda kalinti: tarayici disk onbellegi → S-15; SW cache'inde kisisel
  veri YOK (§7).

### 7. Istemci Katmani (repo.type: web-react, PWA)

- **XSS sink envanteri:** `dangerouslySetInnerHTML`, `.innerHTML`, `insertAdjacentHTML`,
  `document.write`, `eval(`, `new Function` → `apps/web/src` altinda (spec'ler haric)
  **sifir kullanim**; tek eslesme `api/access-token.ts:3` icindeki aciklama YORUMU.
  Kullanici metinleri React'in varsayilan kacisiyla basiliyor. `atob(` tek kullanimi
  `downscale-photo.ts:43` — girdisi koda gomulu sabit bir yoklama goruntusu.
  **Acik yonlendirme kontrolu:** `features/auth/redirect-target.ts` `redirectTo` degerini
  dogruluyor (`//host` ve `/\host` reddediliyor) → open redirect yok.
  API istemcisi tek sarmalayici (`api/client.ts`) ve `Authorization` basligini yalnizca
  ayni kokendeki `/api/v1` tabanina ekliyor; on-imzali obje URL'lerine token gitmiyor.
- **Token/oturum saklama:** access token `localStorage`
  (`api/access-token.ts` — `ACCESS_TOKEN_STORAGE_KEY = 'tutanak.accessToken'`,
  `main.tsx:22` `createSessionStore(window.localStorage)`); refresh token yok, httpOnly
  cookie kullanilmiyor. Gerekce architecture.md §7'de mevcut ve "kati CSP" sartina
  baglanmis; o sart FIILEN karsilaniyor (CSP `script-src 'self'`, `unsafe-inline` yok, sink
  yok). Kalan bedel: iptal edilemezlik → S-07.
- **PWA service worker cache denetimi (ZORUNLU):** uretim imajindan indirilen `/sw.js`
  (1.312 bayt) tumuyle incelendi — yalnizca `precacheAndRoute([...])` (manifest,
  index.html, 3 ikon, `assets/index-BcB16psi.css`, `assets/index-N0fA6yCz.js`) +
  `cleanupOutdatedCaches()` + tek
  `registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")))`.
  `runtimeCaching`/`NetworkFirst`/`StaleWhileRevalidate`/`CacheFirst`/`/api/` desenleri →
  **sifir eslesme** (grep ile olculdu). Kimlik dogrulamali HICBIR API yaniti cache'lenmiyor;
  paylasilan cihazda SW cache'inde kisisel veri kalmiyor, bu yuzden logout'ta SW cache
  temizligi gerekmiyor. Fotograflar on-imzali URL ile gelir, precache kapsaminda degil.
  `sw.js` `Cache-Control: no-cache` ile servis ediliyor. **SW kaynakli bulgu yok**
  (tarayicinin HTTP disk onbellegi ayri konu → S-15).
- **Uretim bundle sizintilari:** source map yayini → S-05. Uygulama kaynaginda `console.*`
  cagrisi **YOK** (grep, spec'ler haric: 0 eslesme; paketteki 7 eslesme saticinin kendi
  kodundandir). Yayinlanan bundle (`index-N0fA6yCz.js`, 313.640 bayt) tarandi:
  `VITE_[A-Z_]+` / `import.meta.env` / `IYZICO*` / `RESEND*` / `R2_*` / `JWT_SECRET` /
  `minioadmin` / `sk_live` / `AKIA...` → **0 eslesme**. API taban adresi ayni kokenden
  `/api/v1`.

## GATE3 Etkisi

**BLOKLAYAN BULGU YOK — GATE3 GUVENLIK ACISINDAN GECILEBILIR.** Bu turda acilan hotfix
ticket'i YOKTUR (CRITICAL/HIGH acik bulgu bulunmadigi icin).

CRITICAL bulgu yoktur; acik HIGH bulgu yoktur. Onceki turlarin HIGH (S-01, S-13) ve
MEDIUM (S-02, S-03) bulgulari uretim imajlari uzerinde bu turda yeniden dogrulandi ve
KAPALI kaldi. H-001..H-004 hotfix'leri yetki/girdi/istemci duzleminde regresyon yaratmadi
(§0, §2, §7).

**BLOKLAMAYAN (release sonrasi backlog), onerilen sira:**

1. `S-08` (MEDIUM) — `JWT_SECRET` icin S-03'un fail-closed deseni; yanlis kopyalanan tek
   bir `.env` tam hesap ele gecirmesi demektir (canli PoC §1, §3).
2. `S-14` (MEDIUM) — architecture.md §7 hiz siniri tablosunun uygulanmayan 4 satiri;
   ozellikle `/pdf`, fotograf yukleme ve webhook uclari (H-001 sonrasi PDF maliyeti artti).
3. `S-11` (MEDIUM) — paylasim e-postasi kotasi + e-posta dogrulama (gonderen alan adi
   itibari).
4. `S-04` (MEDIUM) — `iyzipay` bagimlilik zinciri; somuru yolu bulunamadi, izlenmeli.
5. `S-18` (LOW) — `cd.yml` guvenlik kosulunu regresyon testiyle kilitleyin (S-13'un geri
   donmesini engeller); ayni testte S-10'un topoloji degismezi de sabitlenebilir.
6. `S-05`, `S-06`, `S-15`, `S-16` (LOW) — tek satirlik sertlestirmeler
   (`sourcemap: 'hidden'`, `USER node`, `Cache-Control: no-store`, `env:` ile girdi gecirme).
7. `S-09`, `S-17` (LOW) — yedek sifreleme + KVKK silme akisi + link omru/iptali (PRD acik
   sorusu kapaninca tek ticket).
8. `S-07`, `S-10`, `S-12` (LOW) — oturum iptali, topoloji degismezi, kayit ucundaki varlik
   sizintisi; ucu de bilincli MVP takasi.
