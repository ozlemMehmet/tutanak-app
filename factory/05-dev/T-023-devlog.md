# Devlog — T-023

> Uretici: dev-agent | Branch: ticket/T-023 | Tarih: 2026-08-16

Karar: **(b) mailpit kaldirildi.** Gerekce asagida ("Alinan Kararlar").

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu; iade turu 1'de guncel ticket metnine gore yeniden numaralandi)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Yerel e-posta davranisi dev-agent'in YAZABILDIGI dosyalarda tek anlatimla belgelenir; kok `README.md` + `docker-compose.yml` celismez | `README.md` "Yerelde e-posta" bolumu (servis listesinden mailpit cikti) + `docker-compose.yml` bas yorumu | `tools/local-email-path.spec.ts` -> "README yerel e-posta anlatimi" describe'i (mailpit/8025 gecmez; "e-posta GONDERILMEZ" + `status: "failed"` + paylasim linki cumleleri) + compose describe'i |
| 2. `factory/` altindaki turev dokuman celiskileri devlog'un "Ticket Disi Fark Edilen Sorunlar" bolumunde dosya+satir olarak RAPORLANIR (duzeltmek bu ticket'in isi DEGIL) | Kod yok — devlog raporu (asagidaki "A) `factory/` turev dokumanlarinda kalan mailpit celiskileri" maddesi) | Otomatik test yok: rapor edilen dosyalar dev-agent'in yazma izni disinda ve versiyon kontrolunde degil; dogrulama `rg -n mailpit <dosya>` ile elle yapildi (cikti asagida) |
| 3. (a) kriteri (mailpit gercekten kullanilsin) | Uygulanmadi — (b) secildi, gerekce asagida | — |
| 4. (b) secildi: `mailpit` servisi ve portlari kalmaz; `docker compose config` ciktisinda gorunmez | `docker-compose.yml`'den `mailpit` blogu silindi | `tools/local-email-path.spec.ts` -> compose YAML olarak COZULUP servis adi/imaji/1025/8025 host portlari yoklugu dogrulanir; ayrica elle `docker compose config` kosuldu (asagida) |
| 5. `RESEND_API_KEY` bosken uygulama ACILIR; paylasim linki uretimi etkilenmez | Kod DEGISMEDI (T-008 davranisi korunuyor) | Mevcut `apps/api/src/config/env.schema.spec.ts` (bos/eksik anahtar -> `undefined`, sema gecer) + `sharing.e2e-spec.ts` link uretimi testleri; yeni: `.env.example` `RESEND_API_KEY=` bos satiri korunuyor testi |
| 6. Mevcut e2e paketi (`sharing.e2e-spec.ts` dahil) DEGISTIRILMEDEN gecer | Kod/test dosyasi degistirilmedi | Tam e2e kosumu: 13 suite / 196 test PASS (asagida) |

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

  Bu dosyalar `factory/04-architecture/*` altindadir ve **dev ajani tarafindan
  degistirilmez** (mutasyon guard'i `factory/` altinda yalnizca `05-dev/` izni verir);
  ayrica bu depoda versiyon kontrolunde de degiller (worktree'de bulunmuyorlar), yani
  commit'lenebilir bir degisiklik da degiller. **Architect'e devir:** yukaridaki satirlardan
  mailpit ibaresi kaldirilmali, §10 kabul cumlesine "yerelde e-posta gonderilmez;
  `RESEND_API_KEY` bosken paylasim e-postasi `202 + status: failed` doner" eklenmelidir.
  `EMAIL_FROM` varsayilaninin gecerliligi bu karardan etkilenmiyor (adres yalnizca `from`
  alani olarak kullaniliyor, dogrulanmiyor).
- Turev dokumanlarda (`04-architecture/architecture.md`, `09-docs/*`) kalan somut
  celiskiler kabul kriteri 2 geregi asagida **"Ticket Disi Fark Edilen Sorunlar"**
  bolumunde dosya+satir olarak raporlandi.

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

### A) `factory/` turev dokumanlarinda kalan mailpit celiskileri (kabul kriteri 2 raporu)
Bu ticket'ten sonra asagidaki satirlar mailpit'i **yerelde calisan bir servis** gibi
anlatiyor ve kok `README.md` + `docker-compose.yml` ile celisiyor. **DUZELTILMEDI** —
mutasyon guard'i dev ajanina `factory/` altinda yalnizca `05-dev/` izni verir; bu dosyalar
mimari/dokumantasyon asamalarinin ciktisidir ve bu turdan sonra yeniden kosacaktir. Ayrica
hicbiri versiyon kontrolunde degil (`git ls-files` bos doner, worktree'de bulunmuyorlar).
Satir numaralari 2026-08-16 tarihli calisma kopyasina goredir (`rg -n "mailpit|8025|1025" <dosya>`).

| Dosya | Satir | Kalan yanlis anlatim | Onerilen duzeltme |
|---|---|---|---|
| `factory/04-architecture/architecture.md` | 121 | §7 dis bagimlilik tablosu, Resend satiri "Yerel karsilik" sutunu: "Mailpit container, `FakeEmailAdapter`" | "Yerel karsilik yok — gonderim denenir ve `RESEND_API_KEY` bosken `202 + status: failed` doner; birim testlerde `FakeEmailAdapter`" |
| `factory/04-architecture/architecture.md` | 339 | T-001 satiri: "`docker-compose.yml` (api, db, minio, mailpit)" | "`docker-compose.yml` (api, web, db, minio)" |
| `factory/09-docs/SETUP.md` | 25 | Ayaga kalkan servisler listesinde "`mailpit` (SMTP yakalayici, ...)" | Servis listesinden cikarilmali |
| `factory/09-docs/SETUP.md` | 41 | Tabloda "Mailpit arayuzu \| http://localhost:8025" satiri | Satir tumuyle kaldirilmali |
| `factory/09-docs/README.md` | 68 | Dagitim hedefi: "(`db`, `minio`, `mailpit`, `api`, `web`)" | mailpit cikarilmali |
| `factory/09-docs/README.md` | 75-76 | "bir `mailpit` servisi calistirir ama uygulama e-postayi ona yonlendirmez ... yerelde gonderilen e-postalar mailpit arayuzunde" | "Yerelde e-posta gonderilmez ve yakalanmaz; SMTP yakalayici konteyner yoktur" |
| `factory/09-docs/ARCHITECTURE.md` | 131 | Compose servis listesi: "... `mailpit`, `api` ..." | mailpit cikarilmali |
| `factory/09-docs/ARCHITECTURE.md` | 146-152 | "§7.1 E-posta: Mailpit fiilen bagli degil" bolumu, `:8025` arayuzunden bahsediyor | Bolum "yerelde e-posta gonderilmez/yakalanmaz; `RESEND_API_KEY` bosken paylasim e-postasi `202 + status: failed` doner, paylasim linki gecerli kalir" olarak sadelestirilmeli (celiski artik yok, bu yuzden "bilinen celiski" kaydi olarak degil davranis tarifi olarak kalmali) |

`FOUND-ISSUES.md` madde 2 (mailpit fiilen bagli degil) bu ticket'in urun tarafi (compose +
kok README) ile kapandi; kalan is yalnizca yukaridaki turev dokumanlarin senkronu.

### B) Diger
- `FOUND-ISSUES.md` madde 1 (README'deki `set -a && . ./.env` komutu `EMAIL_FROM` satiri
  yuzunden bash/zsh'de parse hatasi veriyor) hala acik; ilgili komut README'nin su anki
  halinde zaten onerilmiyor ama `.env.example`'daki tirnaksiz `EMAIL_FROM=Tutanak
  <noreply@localhost>` degeri duruyor. Ayri ticket konusu.
- `docker-compose.yml`'deki `web` servisi her acilista `npm ci` kosuyor (yavas acilis);
  kapsam disi, dokunulmadi.
- e2e paketi tek bir paylasimli veritabanina karsi izole DEGIL: `apps/api/test/jest-e2e.config.mjs`
  worker basina ayri sema/DB kullanmiyor, bu yuzden ayni `localhost:5432`'yi kullanan baska
  bir compose yigini (veya paralel kosum) varken suite'ler birbirini bozabiliyor (iade turu
  1'de gozlendi, detay asagida). CI'da her kosum kendi DB servisiyle geldigi icin orada
  gorunmuyor. Ayri ticket konusu; dokunulmadi.

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

# Compose dogrulamasi (kabul kriteri 4)
$ docker compose config --services   -> db, minio, api, minio-init, web   (mailpit YOK)
$ docker compose config | grep -c -E 'mailpit|1025|8025'   -> 0
```

## Iade turu 1 (qa-agent CHANGES; `T-023-review-feedback.md`)

**Bulgu:** QA, kriter 1'i "`architecture.md`, kok `README.md`, `SETUP.md` ve
`docker-compose.yml` birbiriyle celismez" seklinde okudu ve `factory/04-architecture/
architecture.md` + `factory/09-docs/*` hala mailpit'i yerelde calisan servis gibi anlattigi
icin FAIL verdi. Diger tum kriterler QA'da PASS (izole compose, smoke + regresyon + 22
sharing e2e testi).

**Sistematik teshis:**
1. *Izole et:* Bulgunun urun kodu/compose ile ilgisi yok — QA'nin kendi raporunda kriter
   3/4/5 PASS. Fark tam olarak dev ajaninin YAZAMADIGI dosyalarda: `git ls-files
   factory/04-architecture/architecture.md factory/09-docs/*` bos doner (versiyon
   kontrolunde degiller) ve worktree'de fiziksel olarak da yoklar (`ls` -> "FILE MISSING"),
   yani bu daldan degistirilmeleri teknik olarak da mumkun degil.
2. *Hipotez:* Kok neden kodda degil, kriter metninin kapsam sinirinda: kriter, dev'in
   mutasyon guard'i geregi dokunamayacagi turev dokumanlari da kapsiyor gibi okunabiliyordu.
   Dogru cozum bu dosyalari zorla degistirmek DEGIL, celiskiyi devlog'da dosya+satir olarak
   raporlayip mimari/docs asamasina devretmek.
3. *Test et:* Ticket'in guncel metni bu hipotezi dogruluyor — kriter 1 artik acikca
   "dev-agent'in YAZABILDIGI dosyalarda" (kok `README.md` + `docker-compose.yml`) diyor,
   kriter 2 ise turev dokuman celiskilerinin devlog'un "Ticket Disi Fark Edilen Sorunlar"
   bolumunde dosya+satir olarak RAPORLANMASINI sart kosuyor ve duzeltmenin bu ticket'in isi
   olmadigini yaziyor.
4. *Dogrula:* Kriter 2 icin eksik olan tek sey raporun DOGRU BOLUMDE ve dosya+satir
   duzeyinde olmasiydi (onceki turda "Anayasa Bosluklari" altinda, kismen ve satir
   numaralari eskiydi). Bu turda:
   - Turev dokuman celiskileri "Ticket Disi Fark Edilen Sorunlar > A)" altinda tablo olarak,
     guncel satir numaralari ve onerilen duzeltme metniyle raporlandi. Satirlar
     `rg -n "mailpit|8025|1025" <dosya>` ile bu turda yeniden dogrulandi (ornegin
     `architecture.md:121` onceki turda kacirilmisti, eklendi; `ARCHITECTURE.md` araligi
     146-152 -> 146-152 olarak teyit edildi).
   - Kriter -> plan tablosu ticket'in guncel 6 maddelik numaralandirmasina hizalandi.
   - Regresyon: urun tarafinda hicbir sey degistirilmedi (bu tur yalnizca devlog dokunuldu);
     `tools/local-email-path.spec.ts` 8/8 PASS, kok `npm run test` 33+360+390 PASS,
     lint/typecheck/format temiz, tam e2e 196/196 PASS.

**Kod/compose/README degisikligi yok** — QA'nin PASS verdigi urun davranisi aynen korundu.

### Bu turdaki dogrulama ciktilari
```
$ npx jest --config jest.config.mjs tools/local-email-path.spec.ts
Test Suites: 1 passed   Tests: 8 passed

$ npm run test
Test Suites: 6 passed (kok/tools) | 55 passed (apps/api) | 53 passed (apps/web)
Tests:       33 passed            | 360 passed           | 390 passed

$ npm run lint -> 0 uyari   |   npm run typecheck -> temiz
$ npm run format:check -> All matched files use Prettier code style!

$ DATABASE_URL=postgresql://tutanak:tutanak@localhost:5432/tutanak npm run test:e2e
Test Suites: 13 passed, 13 total   Tests: 196 passed, 196 total   (hem varsayilan paralel
hem --runInBand kosumunda)
```

**Ortam notu (bulgu degil, olcum gurultusu):** bu turdaki ILK tam e2e kosumunda 5 suite /
75 test kirmizi geldi. Izolasyon: ayni suite'ler TEK BASINA kosuldugunda PASS
(`templates` 4/4, `reports-list` 25/25, `reports` 19/19), ardindan iki ardisik tam kosum
(once `--runInBand`, sonra varsayilan paralel) 196/196 PASS. Sebep, bu makinede ayni
`localhost:5432` veritabanini paylasan baska bir compose yigininin (`tutanak-main-tree2`)
o anda `migrate:deploy`/`seed` kosmasi; e2e paketi tek paylasimli DB'ye karsi izole degil.
T-023 kapsaminda hicbir kod/test dosyasi degismedigi icin bu bulgu bu ticket'e ait DEGIL;
"Ticket Disi Fark Edilen Sorunlar > B" altina ayri madde olarak not edildi.
