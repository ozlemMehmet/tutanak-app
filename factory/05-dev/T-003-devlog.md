# Devlog — T-003

> Uretici: dev-agent | Branch: ticket/T-003 | Tarih: 2026-08-13
> Durum: kabul kriterlerinin tamami kod + test ile karsilandi (ayrinti asagida).

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu, kosum sonrasi dogrulandi)

| Kabul kriteri | Karsilayan kod | Karsilayan test (hepsi YESIL) |
|---|---|---|
| Gecerli e-posta + sifre ile kayit 201 + kullanici DB'de olusur | `modules/auth/auth.controller.ts` (`POST /auth/register`), `auth.service.ts`, `modules/users/users.repository.ts`, `mappers/user.mapper.ts` | e2e: `gecerli e-posta ve parola ile 201 doner ve kullaniciyi veritabaninda olusturur` (yanit + DB satiri + §8.5 iki tarafli zaman toleransi) |
| Sifre duz metin saklanmaz | `auth.service.ts` → `bcrypt.hash(password, 10)` (§6.1) | e2e: `parolayi veritabaninda duz metin saklamaz, bcrypt hash'i olarak saklar`; birim: `parolayi bcrypt ile hash'ler ve duz metni deposuna yazmaz` |
| Kayitli e-posta ile tekrar kayit → 409 + alan bazli mesaj | `users.repository.ts`: INSERT → Prisma `P2002` yakalanir → `ConflictError('EMAIL_ALREADY_REGISTERED', details:[{field:'email'}])` (§4.2.3, §7 unique kisit deseni) | e2e: `kayitli e-posta ile ikinci kayit 409 ... alan bazli hata doner` + `ayni e-postanin farkli harf buyuklugu ile ... (citext)`; birim: `benzersiz e-posta kisiti ihlalinde alan bazli ConflictError firlatir` |
| Gecerli kimlik bilgisi ile giris 200 + erisim tokeni | `auth.service.login()` + `@nestjs/jwt` (`JWT_SECRET`, `JWT_EXPIRES_IN`) | e2e: `gecerli kimlik bilgileriyle 200 ve erisim tokeni doner` (+ `expiresIn = 604800`); birim: `dogru parola ile erisim tokeni, gecerlilik suresi ve kullaniciyi doner` |
| Hatali sifre ile giris → 401 | `auth.service.login()` → `UnauthenticatedError('INVALID_CREDENTIALS')` | e2e: `hatali parola ile 401 INVALID_CREDENTIALS doner` + `kayitli olmayan e-posta ile de ayni 401 ...`; birim: 2 test |
| Token olmadan korumali endpoint → 401 | `common/guards/jwt-auth.guard.ts` (global, APP_GUARD) + `@Public()`, `modules/auth/jwt.strategy.ts`, `GET /me` | e2e: `token olmadan 401 UNAUTHENTICATED doner`, `bozuk token ile 401`, `baska bir anahtarla imzalanmis token ile 401`, `gecerli token ile 200 ve profil bilgisi doner` |

Ek olarak sozlesme geregi kapsanan davranislar: 400 VALIDATION_ERROR alan detaylari, beyaz liste disi
alan reddi (§3.7), `GET /me` abonelik satiri OLUSTURMAZ (§3.11).

## Alinan Kararlar ve Gerekceler
- **Kimlik dogrulama varsayilan KAPALI:** `JwtAuthGuard` global (`APP_GUARD`), istisnalar `@Public()`. Sozlesme "/public/* disindaki her endpoint bearerAuth ister" diyor; beyaz liste yerine kara liste kullanmak yeni endpoint'lerde sessiz acik birakirdi. Bunun zorunlu sonucu: T-001'in `GET /health` controller'ina `@Public()` eklendi (tek satir; aksi halde T-001 davranisi bozulurdu).
- **409 cevirimi repository'de:** Prisma `P2002` → `ConflictError` donusumu `users.repository.ts` icinde yapiliyor; boylece `PrismaClientKnownRequestError` servis sinirinin disina sizmiyor (§3.4). Once-oku-sonra-yaz yarisi yok (§7).
- **Kullanici sizdirmama:** "kullanici yok" ile "parola yanlis" ayni `401 INVALID_CREDENTIALS` yanitini doner.
- **`expiresIn` token'dan hesaplanir** (`exp - iat`); `JWT_EXPIRES_IN` metnini ('7d') elle ayristirmak yerine imzalanan token'in kendi iddialarindan okunur — yapilandirma degisirse yanit kendiliginden dogru kalir.
- **`GET /me` abonelik alani:** §3.11 geregi satir yoksa varsayilan `inactive` nesnesi donuyor; satir VARSA okunup donuyor (T-012 satiri yazacak). Alternatif olan "her zaman inactive don" sozlesmeye aykiri bir sahte yanit olurdu.
- **Env dogrulamasi acilista (zod):** yalnizca bu ticket'in ihtiyac duydugu 4 anahtar (`DATABASE_URL`, `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUBSCRIPTION_CURRENCY`) semada; kalan anahtarlari simdiden zorunlu kilmak, henuz kullanilmayan sirlari (R2/Resend/iyzico) her kosumda dayatirdi. Sonraki ticketlar kendi anahtarlarini ekler.
- **Hata hiyerarsisinden yalnizca kullanilan 3 sinif yazildi** (`ValidationError`, `UnauthenticatedError`, `ConflictError`). §4.2'nin tamamini bugun yazmak olu kod olurdu; `ErrorCode` union'i sozlesmedeki enum'un tamamini icerir, yani sonraki ticketlar kod uydurmadan sinif ekler.
- **Desen kullanimi:** yalnizca sozlukte karsiligi olanlar — Repository (§7), Mapper (saf fonksiyon), Guard Clause, unique kisit + kisit ihlali cevirimi. Adapter+Port kullanilmadi (kendi veritabanimiz icin yasak), Strategy/Factory eklenmedi (problem yok).
- **Verimlilik oz-kontrolu:** sicak yollarda ic ice dongu, dongu icinde DB/HTTP cagrisi ve sayfalamasiz tam-tablo cekisi YOK. Kayit 1 INSERT, giris 1 indeksli SELECT (`users_email_key`) + 1 bcrypt, `/me` 1 SELECT (+ include ile tek join). bcrypt cost 10 bilincli CPU maliyetidir (§6.1).

## Varsayimlar
- `POST /auth/login` icin `LoginRequest` sozlesmesi `password` icin `minLength: 8` diyor; bu nedenle giris DTO'su da 8 karakter dogruluyor (8'den kisa parolayla giris denemesi 401 degil 400 doner). Sozlesme boyle yaziyor, DTO ondan turetildi.
- Token gecerli ama kullanici silinmisse `/me` 401 doner (sozlesmede `/me` icin tanimli tek hata yaniti 401'dir).
- e2e testleri yerelde `docker compose up -d db` ile ayaga kalkan Postgres'e karsi kosuldu.

## Anayasa (CLAUDE.md) Bosluklari / Celiskileri
- **[CELISKI — karar architect'in] §6.1 (bcrypt 5.x pinlenmis) vs §9 (`npm audit --audit-level=high` temiz olmali).** `bcrypt@5.1.1` → `@mapbox/node-pre-gyp@1.0.11` → `tar@<=7.5.20` zinciri 2 high + 1 critical advisory uretiyor; `npm audit` bu yuzden kirmizi. Tek resmi cozum `bcrypt@6.0.0`, yani §6.1'in "major yukseltme AYRI TICKET" kuralina giren bir surum atlamasi. Anayasayi tek basima esnetmedim: 5.1.1'de kaldim ve durumu raporluyorum. Karar secenekleri: (a) bcrypt 6.x'e gecis ticket'i, (b) `@mapbox/node-pre-gyp` altinda `tar` icin npm `overrides` (native kurulum zincirini sessizce degistirir, bu yuzden kendiligimden uygulamadim), (c) §9 esiginin bilincli istisnasi.
- **[BOSLUK] `/me` controller'inin yeri.** §1 agacinda `modules/users/` altinda controller listelenmemis, ayri bir `me` modulu de yok. `users.controller.ts` icine kondu (oturum sahibinin kaynagi = user).
- **[BOSLUK] Yapilandirma DI token'i.** `SUBSCRIPTION_CURRENCY` degerinin servise nasil verilecegi tanimli degil; `config/config.tokens.ts` (yan etkisiz) uzerinden `@Inject` token'i secildi.
- **[BOSLUK] pino kurulumu henuz yok.** §4.4 pino istiyor ama log altyapisini kuran bir ticket bugune kadar cikmadi; filtre 5xx'leri Nest'in yerlesik `Logger`'i ile logluyor (`no-console` ihlali yok). pino'ya gecis bir log ticket'inda yapilmali; hata zarfi `traceId` uretimi zaten filtrede.
- **[BOSLUK] Hiz siniri (`429 RATE_LIMIT_EXCEEDED`).** Sozlesme `/auth/*` icin 429 tanimliyor, `@nestjs/throttler` §6.1'de listeli, ama T-003 kabul kriterlerinde yok ve throttler'i kuran bir ticket da yok. Kodlanmadi; `ErrorCode` union'inda kod hazir.

## Bilinen Sinirlamalar
- Giris akisinda kullanici bulunamadiginda bcrypt karsilastirmasi yapilmadigi icin teorik bir **zamanlama** farki var (kullanici numaralandirma); yanit govdesi/kodu ayni. Sabit-zamanli sahte hash karsilastirmasi eklenmedi (kriter degil, ayri bir guvenlik ticket'i konusu).
- Token iptali/refresh yok (kapsam disi); token omru `JWT_EXPIRES_IN` ile sinirli.
- `docker compose up` icin `api` servisine `env_file: .env (required: false)` eklendi — `JWT_SECRET` container'a baska turlu ulasmiyordu ve uygulama sirsiz ACILMAZ (§5). README'ye e2e kosumunda `JWT_SECRET` gerektigi not edildi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `apps/api/coverage/`, `apps/api/dist/`, `apps/web/coverage|dist` uretilmis ciktilar calisma agacinda duruyor (izlenmiyorlar).
- `factory/01-intake`, `02-prd`, `03-backlog`, `04-architecture` klasorleri calisma agacinda **izlenmiyor** (untracked) gorunuyor; bu control-plane'in ilgi alani, dokunulmadi.

## Test Kosum Ciktisi (ozet)
```
npm run lint          -> 0 hata / 0 uyari (eslint --max-warnings=0)
npm run format:check  -> All matched files use Prettier code style!
npm run typecheck     -> temiz (kok + api + web)
npm test              -> api: 47/47, web: 10/10, kok: 15/15  (kapsam esikleri gecti:
                         modules/** satir >= %80, global >= %70)
npm run test:e2e      -> 3 suite / 30 test PASS
                         (auth.e2e-spec 16, migration.e2e-spec 12, health.e2e-spec 2)
npm audit --audit-level=high -> 2 high + 1 critical (bcrypt 5.x -> node-pre-gyp -> tar)
                         ayrinti ve karar secenekleri: "Anayasa Celiskileri" bolumu
```

## Iade Turu 1 (dev-agent → control-plane, dal tazeleme)
- Onceki turda is BLOKE idi: dal, T-002'nin merge'ini (`45317d8`) icermeyen bayat bir main uzerindeydi; T-002'nin prisma semasi/migration'lari/test altyapisi agacta yoktu ve tek satir urun kodu yazilmadi.
- Bu turda dal `45317d8` uzerine tazelenmis olarak geldi (`git log`: `f74a3bf` → `45317d8` → `e125a33`); T-002 ciktilari dogrulandi (`apps/api/prisma/schema.prisma` User modeli + `users_email_key`, `migrations/20260812000000_init/**`, `test/db.ts`, `test/factories/user.factory.ts`).
- Onceki devlog'daki plan aynen uygulandi; "Bloke Nedeni" bolumu gercek kosum sonuclariyla degistirildi.
- Kosum sirasinda cikan iki gerileme sistematik olarak cozuldu (tahminle deneme yapilmadi):
  1. `auth.e2e-spec` teardown'u `57P01` ile patladi. Hipotez: testin `process.env.DATABASE_URL`'i izole test DB'sine cevirmesi, `test/db.ts::dropDatabase`'in yonetim baglantisini da ayni DB'ye tasiyor ve `pg_terminate_backend` kendi baglantisini dusuruyor. Dogrulama: `requireDatabaseUrl()` gercekten `process.env`'den okuyor. Duzeltme: temel adres saklanip teardown oncesi geri yukleniyor.
  2. `health.e2e-spec` acilamadi. Hipotez: env dogrulamasi `ConfigModule.forRoot()` ile MODUL YUKLENIRKEN calisiyor, bu yuzden `beforeAll` icinde env atamak gec kaliyor (statik import hoisting). Dogrulama: yigin izi `config.module.ts` import zincirini gosterdi. Duzeltme: env atamasindan sonra `main` dinamik import ediliyor (auth e2e ile ayni desen) + README'de e2e env gereksinimi belgelendi.
