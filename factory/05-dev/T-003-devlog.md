# Devlog — T-003

> Uretici: dev-agent | Branch: ticket/T-003 | Tarih: 2026-08-13
> **Durum onerisi: `blocked`** — bagimli ticket T-002'nin ciktilari calisma agacinda YOK (ayrinti asagida).

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| Gecerli e-posta + sifre ile kayit 201 + kullanici DB'de olusur | `modules/auth/auth.controller.ts` (`POST /auth/register`), `auth.service.ts`, `modules/users/users.repository.ts` (Prisma `user.create`), `mappers/user.mapper.ts` | `test/auth.e2e-spec.ts` → `it('gecerli e-posta ve sifre ile kayit 201 doner ve kullaniciyi olusturur')` (DB'den satir okunarak dogrulanir) |
| Sifre duz metin saklanmaz (hash dogrulanabilir) | `auth.service.ts` icinde `bcrypt.hash(password, 10)` (CLAUDE.md §6.1 bcrypt 5.x, cost 10) | e2e: `it('kayit sonrasi password_hash duz metin degildir ve bcrypt.compare ile dogrulanir')` + birim test `auth.service.spec.ts` |
| Kayitli e-posta ile tekrar kayit → 409 + alan bazli mesaj | `users.repository.ts`: `INSERT` denenir, Prisma `P2002`/SQLSTATE `23505` yakalanir → `ConflictError('EMAIL_ALREADY_REGISTERED', details:[{field:'email',...}])` (§4.2, §4.2.3, §7 unique kisit deseni) | e2e: `it('kayitli e-posta ile ikinci kayit 409 EMAIL_ALREADY_REGISTERED ve email alan hatasi doner')` |
| Gecerli kimlik bilgisi ile giris 200 + erisim token'i | `auth.service.login()` + `@nestjs/jwt` (`JWT_SECRET`, `JWT_EXPIRES_IN` — §5, §5.1) | e2e: `it('dogru sifre ile giris 200 ve accessToken doner')` |
| Hatali sifre ile giris → 401 | `auth.service.login()` → `UnauthenticatedError('INVALID_CREDENTIALS')` (kullanici yok / sifre yanlis ayrimi sizdirilmez) | e2e: `it('hatali sifre ile giris 401 INVALID_CREDENTIALS doner')` + `it('kayitli olmayan e-posta ile giris 401 doner')` |
| Token olmadan korumali endpoint → 401 | `common/guards/jwt-auth.guard.ts` (global guard) + `@Public()` dekoratoru, `jwt.strategy.ts`, `GET /me` | e2e: `it('token olmadan GET /me 401 UNAUTHENTICATED doner')` + `it('gecersiz/bozuk token ile GET /me 401 doner')` |

Bu plan uygulanamadi; asagidaki bloke nedeni giderilmeden tek satir urun kodu yazmak, T-002'nin dosyalarini bu ticket'ta yeniden uretmek anlamina gelirdi (kapsam disi — Mutlak Kural 1).

## Bloke Nedeni (kanit ile)
`ticket/T-003` calisma agaci **guncel olmayan bir main uzerinden** hazirlanmis:

- `HEAD` = `e125a33` (T-001 merge'i). `git ls-remote origin refs/heads/main` = **`45317d8`** = pipeline.json'daki `T-002.merge_sha`. Yani T-002 uzakta main'e merge edilmis, bu dal ise merge'den **once**ki main'den ayrilmis (`git merge-base --is-ancestor 71194dd HEAD` → hayir).
- Sonuc olarak T-003'un ihtiyac duydugu T-002 ciktilarinin **hicbiri** agacta yok:
  - `apps/api/prisma/schema.prisma` (users modeli, `citext` e-posta, `users_email_key` unique index) — yok
  - `apps/api/prisma/migrations/20260812000000_init/**` — yok
  - `apps/api/package.json` icinde `@prisma/client` / `prisma` bagimliliklari ve `prisma:generate`, `migrate:deploy`, `seed` script'leri — yok
  - `apps/api/test/db.ts`, `apps/api/test/factories/user.factory.ts` (§8.4 zorunlu test altyapisi) — yok
- Bu haliyle: `PrismaService` yazilamaz, kayit/giris e2e testleri (kriter 1, 2, 3) hicbir sekilde kosturulamaz, `npm run typecheck` Prisma tipleri olmadan kirmizi olur.

Cozum control-plane'dedir: `ticket/T-003` dali guncel `origin/main` (`45317d8`) uzerinden yeniden olusturulmali (veya rebase edilmeli). Rol sozlesmesi geregi dal olusturma/degistirme/merge islemi dev-agent tarafindan yapilmadi.

## Alinan Kararlar ve Gerekceler
- Kod yazilmadi: eksik dosyalari bu ticket'ta yeniden uretmek (a) T-002'nin dosyalarinda calismak (Mutlak Kural 1 ihlali), (b) merge sirasinda ayni dosyalarin iki kez eklenmesi riski demekti.
- Testler kosturulmadi: kosturulacak bir sey yok; sahte gecis (kriterleri "yorumlayip" DB'siz in-memory kullanici deposu yazmak) Mutlak Kural 7 geregi yasak.

## Varsayimlar
- `origin/main` = `45317d8` gercekten T-002'yi iceriyor (pipeline.json `T-002.status = done, merged = true, merge_sha = 45317d8` ile tutarli).
- Yerelde Docker calisir durumda (`docker ps` yanit veriyor), yani dal tazelendikten sonra Postgres kaldirilip e2e testleri kosturulabilir.

## Anayasa (CLAUDE.md) Bosluklari
- Yok. (Plan asamasinda ihtiyac duyulan her sey anayasada tanimli: §3.5 mapper, §4.2 hata hiyerarsisi, §4.2.3 `details`, §5.1 `JWT_EXPIRES_IN`, §7 unique kisit + get-or-create deseni, §8.2 e2e zorunluluklari.)

## Bilinen Sinirlamalar
- Bu devlog yalnizca plan + bloke kaydidir; hicbir kabul kriteri karsilanmadi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- Yerel `main` ve `origin/main` remote-tracking ref'i bayat (`e125a33`); uzakta `45317d8`. Dal hazirlamadan once `git fetch` yapilmamis gorunuyor — sonraki ticketlarda ayni bagimlilik kaymasi tekrar edebilir.
- `apps/api/coverage/` ve `apps/api/dist/`, `apps/web/coverage|dist` uretilmis ciktilar calisma agacinda duruyor (izlenmiyorlar, sorun degil ama temizlenmemis).

## Test Kosum Ciktisi (ozet)
```
Kosturulmadi — bagimli T-002 ciktilari (prisma semasi/migration/test altyapisi) agacta olmadigi icin
T-003 icin anlamli bir test paketi yazilamadi. Ayrintili kanit: "Bloke Nedeni" bolumu.
```
