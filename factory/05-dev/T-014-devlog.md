# Devlog — T-014

> Uretici: dev-agent | Branch: ticket/T-014 | Tarih: 2026-08-13
> Durum: kabul kriterlerinin tamami kod + test ile karsilandi; ayrica canli API uzerinde
> uretim varsayilanlariyla (5 istek/dk) dogrulandi.

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu, kosum sonrasi dogrulandi)

| Kabul kriteri | Karsilayan kod | Karsilayan test (hepsi YESIL) |
|---|---|---|
| `@nestjs/throttler` kurulu ve global yapilandirilmis | `apps/api/package.json` (`@nestjs/throttler ^6.5.0`), `app.module.ts`: `ThrottlerModule.forRootAsync` (env'den) + `APP_GUARD` olarak `ThrottlerGuard`, `common/guards/rate-limit.factory.ts` | birim: `rate-limit.factory.spec.ts` (5 test); e2e: `auth-rate-limit.e2e-spec.ts` — guard'in **global** oldugu, `/auth/*` disindaki korumali uc (`GET /me`) uzerinden gosterildi |
| `/auth/login` limit asildiginda 429 | `auth.controller.ts` `login` uzerinde `@StrictRateLimit()` + global guard | e2e: `POST /auth/login: limit icindeki denemeler normal yanit verir, limit asilinca 429 doner` (basarili giris 200 -> hatali parola 401 -> ucuncu istek 429; basarisiz deneme de sayaci tuketir) |
| 429 standart hata zarfi + `code = RATE_LIMIT_EXCEEDED` | mevcut `AllExceptionsFilter` (429 -> `RATE_LIMIT_EXCEEDED` eslemesi hazirdi) + `rate-limit.factory.ts`'teki Turkce `errorMessage` | e2e: register 429 testinde `code` / `message` / `traceId` dogrulanir, `details` **gonderilmez** (§4.2.3), mesajda framework metni (`Throttler`, `Too Many`) yoktur; birim: Turkce mesaj testi |
| `/auth/register` icin ayni davranis | `auth.controller.ts` `register` uzerinde `@StrictRateLimit()` | e2e: `POST /auth/register: limit icindeki istekler 201 doner, limit asilinca 429 ...` + `limit asildiktan sonra kayit yeni kullanici OLUSTURMAZ` |
| Limit altinda kalan istekler etkilenmez (regresyon) | limitler env'den gelir; varsayilanlar architecture.md §7 tablosu (`/auth/*` 5/dk, digerleri 300/dk) | e2e regresyon: `auth.e2e-spec.ts` (20 test), `templates.e2e-spec.ts`, `health.e2e-spec.ts`, `migration.e2e-spec.ts` — **44/44 yesil**; ayrica yeni testlerin limit ici istekleri 201/200/401 doner |
| Limitler env uzerinden yapilandirilabilir; `.env.example` + `env.schema.ts` guncel | `config/env.schema.ts` (`RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_MAX_REQUESTS`), `.env.example` | birim: `env.schema.spec.ts` "hiz siniri anahtarlari" (6 test: varsayilanlar, metin->sayi cevirimi, 0 / negatif / sayi-olmayan / ondalikli deger reddi); `tools/rate-limit-config.spec.ts` (3 test: `.env.example` <-> `env.schema.ts` senkronu ve varsayilan degerler) |

## Alinan Kararlar ve Gerekceler
- **Guard sirasi kodla sabit, testle korunuyor.** `APP_GUARD` saglayicilari `ThrottlerGuard` -> `JwtAuthGuard` sirasinda; ticket'in teknik notu boyle istiyor. Sirayi yorum degil **test** koruyor: token'siz `GET /me` istekleri limit dolana kadar 401, limit asilinca **429** donuyor — throttler auth'tan sonra kosuyor olsa bu test 401 gorurdu.
- **Tek throttler tanimi + route'a gore cozulen limit.** Iki ayri named throttler yerine tek tanim kullanildi; sayac anahtari throttler'da zaten endpoint + IP basina uretildigi icin (`ClassName-handlerName-throttlerName-ip`) tek tanim yeterli: `@StrictRateLimit()` isaretli route'lar `AUTH_RATE_LIMIT_MAX_REQUESTS`, digerleri `RATE_LIMIT_MAX_REQUESTS` limitini alir (throttler'in `Resolvable<number>` limit destegi). Iki named throttler her route'ta **ikisi birden** islerdi ve auth disindaki her controller'a `@SkipThrottle()` eklemek gerekirdi — bu, kapsam disi dosyalara dokunmak olurdu.
- **`@StrictRateLimit()` dekoratoru, path esleme degil.** Sikilastirilmis limitin hangi route'lara uygulanacagi metadata ile isaretlendi (mevcut `@Public()` deseninin birebir esi). Alternatif olan "istek yolunu `/api/v1/auth/` ile karsilastir" cozumu global on ek bilgisini `main.ts` disinda ikinci kez tanimlar ve route yeniden adlandirilinca sessizce korumasiz kalirdi. Limit **degeri** dekoratore yazilmadi (yapilandirmadan gelir, §5.1).
- **Genel limitin (300/dk) de kurulmasi bilinclidir, kapsam kaymasi degil:** architecture.md §7 tablosu "diger tum endpoint'ler 300 istek/dk" diyor ve `api-contract.yaml` basligi "TUM endpoint'ler 429 dondurebilir" diye yaziyor. Ticket'in kapsam disi maddesi endpoint'e **ozel** siki limitleri (fotograf 60/kullanici, genel gorunum 60, webhook 60) disarida birakiyor; onlarin endpoint'leri henuz yok, bu ticket'ta hicbir ozel limit yazilmadi.
- **429 mesaji yapilandirmadan degil sabitten, ama Turkce:** `errorMessage` throttler kok secenegi ile veriliyor; aksi halde istemciye `ThrottlerException: Too Many Requests` (Ingilizce framework metni) sizardi (§4.3). Mesaj kullanici metni oldugu icin env'e tasinmadi.
- **`Retry-After` / `X-RateLimit-*` basliklari framework varsayilaninda birakildi** (429'da `Retry-After: 60` gorulmustur). Sozlesme bu basliklari yasaklamiyor, istemciye dogru davranisi ogretiyor.
- **Sayac bellek icinde** (throttler varsayilan storage): architecture.md §4 tek instance karari, §6.2 Redis yasagi. Redis/dagitik sayac icin kod yazilmadi.
- **Desen disiplini:** yeni desen icat edilmedi. Kullanilanlar sozlukte/kod tabaninda hazirdi: metadata + Reflector isaretlemesi (`@Public()` ile ayni), yapilandirma fabrikasi (`validation-pipe.factory.ts` ile ayni rol ve isimlendirme).
- **Verimlilik oz-kontrolu:** sicak yol tek `Map` artirma islemidir (O(1)); ic ice dongu, dongu icinde DB/HTTP cagrisi, sayfalamasiz cekis yok. Limit asan istek **handler'a hic girmez** — testle de gosterildi (429'dan sonra kullanici satiri olusmuyor), yani DB/bcrypt maliyeti odenmez. `Reflector` cagrisi istek basina 1 metadata okumasidir.

## Varsayimlar
- Sayac penceresi her iki limit icin **ayni** (`RATE_LIMIT_WINDOW_SECONDS`): architecture.md §7 tablosundaki tum satirlar "dakika" basinadir, iki ayri pencere anahtari gereksiz yapilandirma yuzeyi olurdu.
- Kimlik uclarinda izleyici (tracker) **IP**'dir; kimlikli uclarda da IP kullanilir (asagida sinirlama olarak yazildi).
- `/health` altyapi ucu de genel limite tabidir (sozlesme 429'u tum uclar icin acik biraktigi icin ihlal degil); 300/dk saglik yoklamasi icin fazlasiyla yeterlidir.

## Anayasa (CLAUDE.md) Bosluklari
- **[BOSLUK] Yeni env anahtar adlari.** §5.1 tablosunda hiz siniri anahtari yok, ama ticket kriteri env'den yapilandirma istiyor. §5.1 "kendi env adini icat etme" diyor; kriteri karsilamak icin uc anahtar eklendi ve isimler architecture.md §7 terminolojisinden turetildi: `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX_REQUESTS`, `AUTH_RATE_LIMIT_MAX_REQUESTS`. Architect'in §5.1 tablosuna bu uc satiri eklemesi gerekir (dev `04-architecture/*` dosyalarina dokunmaz — §11).
- **[BOSLUK] `@nestjs/throttler` surum satiri.** §6.1 tum `@nestjs/*` paketlerini "11.x" olarak listeliyor, ama throttler'in kendi surum serisi ayridir; Nest 11 ile uyumlu surum **6.5.0**'dir (11.x diye bir surumu yok). `^6.5.0` kuruldu, `npm audit --audit-level=high` cikisi 0. §6.1'de bu satirin ayrilmasi gerekiyor.
- **[BOSLUK] `common/guards/` altinda guard olmayan dosya.** §1 agacinda throttler yapilandirmasinin yeri tanimli degil. `common/pipes/validation-pipe.factory.ts` ornek alinarak `common/guards/rate-limit.factory.ts` secildi (yapilandirdigi guard'in yaninda).

## Bilinen Sinirlamalar
- **Kimlikli uclarda izleyici kullanici degil IP.** architecture.md §7 "kimlikli: kullanici basina" diyor; ancak throttler bilincli olarak `JwtAuthGuard`'dan **once** kosuyor, yani sayim aninda `req.user` henuz yok. Bu ticket'in kapsami `/auth/*` oldugu icin degistirilmedi: kullanici basina sayim, diger uclarin limitlerini ele alacak ticket'in isi (orada cozum, kimlikli uclar icin ikinci bir named throttler olabilir).
- **NAT arkasindaki paylasimli IP.** Ayni ofisten cikan farkli kullanicilar ayni sayaci paylasir; `/auth/*` icin 5/dk gercek kullanici akisinda (kayit + giris) yeterlidir, ama toplu bir ortamda yanlis pozitif mumkundur. IP reputation/CAPTCHA kapsam disi (PRD'de yok).
- **Bellek ici sayac process'e baglidir**: API yeniden baslarsa sayaclar sifirlanir ve ikinci replikada limit replika basina isler (architecture.md §4 terfi tetikleyicisi: 1'den fazla replika).
- **Web tarafinda 429 gosterimi yok**: `apps/web/src/api/client.ts` henuz yok (T-003 API tarafinda kaldi); zarf `code`'u hazir oldugu icin istemci eklendiginde §4.5 ile dogal olarak baglanir.
- `auth.e2e-spec.ts` limitleri env ile yukseltir (1000): o dosya limit **altindaki** davranisin regresyon testidir, limit asimi ayri dosyada kucuk limitlerle test edilir. Uretim varsayilani (5/dk) ayrica canli API'de dogrulandi (asagi).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `api-contract.yaml` `/health` ucunu tanimlamiyor (uygulama `/health` olarak on ek disinda servis ediyor); sozlesme-kod farki, T-014 kapsaminda degil.
- Kosum sirasinda baska bir worktree'nin Postgres container'i (`t-005-db-1`) 5432'yi tutuyordu ve calisma ortasinda kaldirildi; e2e kosumu icin bu worktree'de `docker compose up -d db` ile kendi container'i ayaga kaldirildi (kod degisikligi degil).

## Test Kosum Ciktisi (ozet)
```
npm run lint          -> 0 hata / 0 uyari (eslint --max-warnings=0)
npm run format:check  -> All matched files use Prettier code style!
npm run typecheck     -> temiz (kok + api + web)
npm run build         -> temiz (api tsc + web vite/pwa)
npm audit --audit-level=high -> found 0 vulnerabilities (cikis 0)

npm test              -> kok/tools: 25/25 (yeni: rate-limit-config 3)
                         api birim: 71/71 (yeni: rate-limit.factory 5, env.schema hiz siniri 6)
                         web: 10/10
                         kapsam esikleri gecti; rate-limit.factory.ts + strict-rate-limit.decorator.ts %100

npm run test:e2e      -> 5 suite / 44 test yesil
  test/auth-rate-limit.e2e-spec.ts  5 test (YENI)
  test/auth.e2e-spec.ts            20 test (regresyon, limit alti)
  test/templates.e2e-spec.ts, test/health.e2e-spec.ts, test/migration.e2e-spec.ts (regresyon)

Canli dogrulama (uretim varsayilanlari, hicbir RATE_LIMIT_* env verilmedi):
  POST /api/v1/auth/register x5 -> 201 201 201 201 201
  6. ve 7. istek                -> 429 {"error":{"code":"RATE_LIMIT_EXCEEDED",
                                   "message":"Cok fazla istek gonderildi. Lutfen bir sure sonra tekrar deneyin.",
                                   "traceId":"..."}}
  429 basliklari                -> HTTP/1.1 429 Too Many Requests + Retry-After: 60
  POST /api/v1/auth/login       -> 200 (ayri sayac; register limiti login'i kesmiyor)
```
