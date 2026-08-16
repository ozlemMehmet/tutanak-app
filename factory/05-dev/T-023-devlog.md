# Devlog — T-023

> Uretici: dev-agent | Branch: ticket/T-023 | Tarih: 2026-08-16

Karar: **(b) mailpit kaldirildi.** Gerekce asagida ("Alinan Kararlar").

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Yerel e-posta davranisi TEK anlatimla belgelenir; `README.md` + `docker-compose.yml` celismez | `README.md` "Yerelde e-posta" bolumu (servis listesinden mailpit cikti) + `docker-compose.yml` bas yorumu | `tools/local-email-path.spec.ts` -> "README yerel e-posta anlatimi" describe'i (mailpit/8025 gecmez; "e-posta GONDERILMEZ" + `status: "failed"` + paylasim linki cumleleri) |
| 3. (b) secildi: `mailpit` servisi ve portlari kalmaz; `docker compose config` ciktisinda gorunmez | `docker-compose.yml`'den `mailpit` blogu silindi | `tools/local-email-path.spec.ts` -> compose YAML olarak COZULUP servis adi/imaji/1025/8025 host portlari yoklugu dogrulanir; ayrica elle `docker compose config` kosuldu (asagida) |
| 4. `RESEND_API_KEY` bosken uygulama ACILIR; paylasim linki uretimi etkilenmez | Kod DEGISMEDI (T-008 davranisi korunuyor) | Mevcut `apps/api/src/config/env.schema.spec.ts` (bos/eksik anahtar -> `undefined`, sema gecer) + `sharing.e2e-spec.ts` link uretimi testleri; yeni: `.env.example` `RESEND_API_KEY=` bos satiri korunuyor testi |
| 5. Mevcut e2e paketi (`sharing.e2e-spec.ts` dahil) DEGISTIRILMEDEN gecer | Kod/test dosyasi degistirilmedi | Tam e2e kosumu: 13 suite / 196 test PASS (asagida) |
| 2. (a) kriteri | Uygulanmadi — (b) secildi | — |

## Alinan Kararlar ve Gerekceler
- **(b) mailpit kaldirildi, (a) reddedildi.** (a) icin bir SMTP istemcisi (nodemailer vb.)
  gerekiyordu; §6.1 kutuphane listesinde SMTP istemcisi YOK ve SMTP host/port icin §5.1
  tablosunda anahtar YOK. Ticket, saglayici secim anahtari uydurmayi zaten yasakliyor;
  §5.1 son cumlesi de env adi icat etmeyi yasakliyor. Yani (a) tek bir ticket'ta ancak
  anayasa disina cikarak yazilabilirdi. (b) ise sifir icat gerektiriyor ve §4.2.2 ile
  ("e-posta hatasi istisna DEGILDIR, `202 + status: failed` beklenen yanittir") birebir
  ortusuyor. Ayrica `email.module.ts` bas yorumu bu karari zaten T-008'de vermisti.
- **Kod dokunulmadi.** Ticket'in teknik notu: "(b) ise degisiklik yalnizca compose +
  dokumantasyondur". `EmailModule`/`ResendEmailAdapter`/`sharing` modulu aynen kaldi.
- **Test, compose'u metin olarak degil YAML olarak cozer** (T-001/T-002'de kurulan kalip;
  yorum satirlari yanlis pozitif uretmesin diye). Yeni test `tools/` altinda, cunku repo
  koku artefaktlarini (compose, README, .env.example) dogruluyor — `tools/readme.spec.ts`
  ve `tools/docker-build-context.spec.ts` ile ayni sinif.
- **Testte "komsu servisler korunur" korkulugu** var: kaldirma islemi db/minio/minio-init/
  api/web servislerini de silmis olmasin diye.
- **README'de "mailpit" kelimesi hic gecmiyor** (test bunu zorluyor): servisi aciklamak
  icin bile ansak, ilerideki bir okuyucu yine `:8025`'i aramaya kalkar. Silinme gerekcesi
  `docker-compose.yml` bas yorumunda duruyor (dosyayi acan kisi orada goruyor).
- Verimlilik: sicak yol yok — degisiklik yapilandirma/dokumantasyon; yeni testler dosya
  okumasi (O(1) dosya, satir sayisi kadar tarama).

## Varsayimlar
- Yerelde e-posta ICERIGINI gormek isteyen gelistirici `.env`'e gercek bir
  `RESEND_API_KEY` yazar (README'de belirtildi). Yerel yakalayici artik yok.
- `docker compose config` ciktisinda servis gorunmemesi kriteri, compose dosyasindaki
  servis tanimlarinin YOKLUGU ile karsilanir (baska compose projelerinde ayni isimde
  konteyner calisiyor olmasi bu repo'nun kapsami disi).

## Anayasa (CLAUDE.md) Bosluklari
- **§1, §10, §5.1 mailpit'ten bahsediyor ve bu ticket'tan sonra GUNCEL DEGIL.** Somut satirlar:
  - §1 klasor agaci: "`docker-compose.yml` # yerel: api, web, db, minio, mailpit"
  - §10: "Bu komut sunlari ayaga kaldirir: `db`, `minio`, `mailpit` (giden e-postayi yakalayan yerel SMTP/UI), `api`, `web`"
  - §5.1 `EMAIL_FROM` satiri: "Yerelde mailpit her adresi kabul ettigi icin `.env.example`'daki varsayilan calisir durumdadir."
  - `architecture.md` §7 tablosu (Resend satiri, "Yerel karsilik" sutunu): "Mailpit container, `FakeEmailAdapter`"

  Bu dosyalar `factory/04-architecture/*` altindadir ve **§11 geregi dev ajani tarafindan
  degistirilmez**; ayrica bu depoda versiyon kontrolunde de degiller (worktree'de
  bulunmuyorlar), yani commit'lenebilir bir degisiklik da degiller. **Architect'e devir:**
  yukaridaki 4 satirdan mailpit ibaresi kaldirilmali, §10 kabul cumlesine "yerelde e-posta
  gonderilmez; `RESEND_API_KEY` bosken paylasim e-postasi `202 + status: failed` doner"
  eklenmelidir. `EMAIL_FROM` varsayilaninin gecerliligi bu karardan etkilenmiyor (adres
  yalnizca `from` alani olarak kullaniliyor, dogrulanmiyor).
- Ayni sekilde `factory/09-docs/SETUP.md` (satir 25 ve 41), `factory/09-docs/README.md`
  (68, 75-76) ve `factory/09-docs/ARCHITECTURE.md` (131, 146-152) mailpit'ten bahsediyor;
  bunlar docs-agent ciktisidir ve versiyon kontrolunde degildir — **docs asamasina devir**:
  "mailpit calisir ama e-posta almaz" anlatimi "yerelde e-posta gonderilmez, SMTP
  yakalayici yoktur" olarak sadelesmelidir. `FOUND-ISSUES.md` madde 2 bu ticket ile kapandi.

## Bilinen Sinirlamalar
- Yerelde e-posta govdesini gozle dogrulamanin yolu kalmadi (gercek anahtar yazmak veya
  birim testlerdeki `FakeEmailAdapter` ciktisina bakmak disinda). Bu, karar (b)'nin
  bilincli bedeli: var olmayan bir yetenegin sahtesini calistirmaktansa yoklugu
  belgelemek tercih edildi.
- `docker compose up` ile tam yigin **bu oturumda ayaga kaldirilmadi**: bu makinede baska
  bir compose projesi (`tutanak-main-tree2`) 3000/5173/5432/9000 portlarini tutuyor ve
  baskasinin yigitini durdurmak kapsam disi. Yerine `docker compose config` ile dosya
  gecerliligi + servis listesi dogrulandi (cikti asagida) ve api/web servis tanimlarina
  dokunulmadi (mailpit'e hicbir servisin `depends_on`'u yoktu — kaldirma yalnizca kendi
  blogunu etkiliyor). Tam `up` dogrulamasi QA'nin izole ortamina birakildi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `FOUND-ISSUES.md` madde 1 (README'deki `set -a && . ./.env` komutu `EMAIL_FROM` satiri
  yuzunden bash/zsh'de parse hatasi veriyor) hala acik; ilgili komut README'nin su anki
  halinde zaten onerilmiyor ama `.env.example`'daki tirnaksiz `EMAIL_FROM=Tutanak
  <noreply@localhost>` degeri duruyor. Ayri ticket konusu.
- `docker-compose.yml`'deki `web` servisi her acilista `npm ci` kosuyor (yavas acilis);
  kapsam disi, dokunulmadi.

## Test Kosum Ciktisi (ozet)
```
# Kirmizi -> yesil (yeni test once yazildi ve calistirildi):
$ npx jest --config jest.config.mjs tools/local-email-path.spec.ts
Tests: 6 failed, 2 passed, 8 total        # (kod/dokuman degismeden ONCE)

# Kok araclar (degisiklikten sonra)
$ npm run test  ->  3 paket:
Test Suites: 6 passed, 6 total     Tests: 33 passed  (kok/tools)
Test Suites: 55 passed, 55 total   Tests: 360 passed (apps/api)
Test Suites: 53 passed, 53 total   Tests: 390 passed (apps/web)

# e2e (CI paritesi: yalnizca DATABASE_URL disaridan)
$ DATABASE_URL='postgresql://tutanak:tutanak@localhost:5432/tutanak' npm run test:e2e
PASS test/sharing.e2e-spec.ts ... Test Suites: 13 passed, 13 total   Tests: 196 passed

# Statik analiz
$ npm run lint          -> 0 uyari
$ npm run format:check  -> All matched files use Prettier code style!
$ npm run typecheck     -> temiz

# Compose dogrulamasi (kabul kriteri 3)
$ docker compose config --services   -> db, minio, api, minio-init, web   (mailpit YOK)
$ docker compose config | grep -c -E 'mailpit|1025|8025'   -> 0
```
