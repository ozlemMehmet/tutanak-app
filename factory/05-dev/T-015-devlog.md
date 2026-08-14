# Devlog — T-015

> Uretici: dev-agent | Branch: ticket/T-015 | Tarih: 2026-08-14

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| Kullanici bulunamayan dalda da `bcrypt.compare` cagrilir | `auth.service.ts` `login()`: `user?.passwordHash ?? DUMMY_PASSWORD_HASH` ile compare her iki dalda kosulsuz calisir | `auth.service.spec.ts`: `bcrypt.compare` spy'i ile "kayitli olmayan e-postada da bcrypt.compare cagrilir" + "kayitli kullanicida bcrypt.compare cagrilir" |
| Iki basarisizlik dali AYNI 401 + AYNI hata kodunu doner (regresyon) | Mevcut `UnauthenticatedError('INVALID_CREDENTIALS', ...)` davranisi korunur | Mevcut birim testleri (`hatali parolada ...`, `kayitli olmayan e-postada ...`) + mevcut e2e (`auth.e2e-spec.ts` 401 testleri) degistirilmeden gecer |
| Dummy hash kaynak kodda sabittir ve gercek kullanici sifresinden turetilmemistir | `DUMMY_PASSWORD_HASH` sabiti: bir defalik uretilen rastgele bayt dizisinin cost-10 bcrypt hash'i; kaynak degeri saklanmadi/atildi (kod yorumunda belirtilir) | `auth.service.spec.ts`: sabitin `$2b$10$` onekiyle (cost 10) basladigi ve dummy compare sonucunun atildigi (yanlis parola yine 401) dogrulanir |
| Mevcut auth birim ve e2e testleri gecer | Davranis degisikligi yok (yalnizca zamanlama esitlenir) | Tum birim paketi + auth e2e paketi kosulur, cikti asagida |

## Alinan Kararlar ve Gerekceler
- Dummy hash, `node -e` ile `crypto.randomBytes(32)` girdisinden cost 10 bcrypt ile bir defalik uretildi; girdi atildi. Boylece sabit hicbir gercek/kullanilabilir sifreye karsilik gelmez (kriter 3) ve cost, gercek dogrulamayla ayni oldugu icin maliyet esitlenir (teknik not).
- `bcrypt.compare` her iki dalda tek bir kod yolundan (`user?.passwordHash ?? DUMMY_PASSWORD_HASH`) kosulsuz cagrilir; `if` dallarina ayri compare yazilmadi — dallar arasi kod yolu farki en aza iner.
- `DUMMY_PASSWORD_HASH` sabiti test edilebilirlik icin export edildi (SCREAMING_SNAKE_CASE, §2); sir degildir — bilinen bir sifrenin hash'i olmadigi icin ifsa riski tasimaz.
- Testte `jest.spyOn(bcrypt, 'compare')` calismadi (`TypeError: Cannot redefine property` — bcrypt native modul ozellikleri configurable degil). Cozum: `jest.mock('bcrypt')` ile gercek implementasyonu saran `jest.fn` — mevcut testler gercek bcrypt davranisini korur, yeni testler cagriyi gozlemler. `bcrypt.compare` overload'lu oldugu icin mock tipi promise overload'ina acikca sabitlendi (lint `consistent-type-imports` / `no-misused-promises` temiz).
- Commit mesaji anayasa §2 formatinda (`fix(auth): T-015 ...`) — emsal: T-005 (`feat(reports): T-005 ...`).

## Varsayimlar
- yok

## Anayasa (CLAUDE.md) Bosluklari
- yok

## Bilinen Sinirlamalar
- Ticket kapsam DISI'nda belirtildigi gibi tam sabit-zamanlilik hedeflenmedi; DB sorgu suresi ve ag jitter'i farklari kalir. Hedeflenen, bcrypt maliyet farkinin kapatilmasidir.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- 

## Test Kosum Ciktisi (ozet)
```
Birim (workspace koku, npm run test):
  kok:      Test Suites: 5 passed  | Tests: 25 passed
  apps/api: Test Suites: 35 passed | Tests: 230 passed  (auth.service.spec: 10/10, 4'u T-015 yeni)
  apps/web: Test Suites: 11 passed | Tests: 53 passed

E2E (gercek Postgres 16, prisma migrate deploy sonrasi):
  Test Suites: 9 passed | Tests: 130 passed
  (auth.e2e-spec dahil: "hatali parola ile 401 INVALID_CREDENTIALS" +
   "kayitli olmayan e-posta ile de ayni 401 INVALID_CREDENTIALS" — regresyon yesil)

Lint: eslint --max-warnings=0 temiz | Typecheck: tsc --noEmit temiz
```
