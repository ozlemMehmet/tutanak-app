# Devlog — T-016

> Uretici: dev-agent | Branch: ticket/T-016 | Tarih: 2026-08-14

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. PR'da Quality Gate passed (yeni kod Reliability + Security >= A) | Kriter 3 + 4'un toplami: yeni kodda bug/vulnerability birakmamak | Yerel SonarQube analizi (asagidaki bulgu tablosu); PR'daki nihai dogrulama SonarQube Cloud check'inde |
| 2. Gercek bulgu listesi kaynagindan alinip devloga yazilir | (kod degil) analiz kosumu | Ayni analizin ONCE/SONRA olcumleri (`reliability_rating`, `security_rating`) |
| 3. `expiresIn` `JWT_EXPIRES_IN`'den uretilir, `decode()` null yolu kalmaz | `access-token-ttl.parser.ts` (yeni), `auth.service.ts`, `auth.module.ts`, `config.tokens.ts`, `env.schema.ts` | `access-token-ttl.parser.spec.ts` (7 test), `auth.service.spec.ts`'e eklenen 2 test, mevcut `auth.e2e-spec.ts` (degistirilmedi) |
| 4. Test kaynaklarindaki sabit degerler zafiyet sayilmaz | `.sonarcloud.properties` (yeni) | Ayni kapsam ayariyla kosulan yerel analiz: test kaynakli S2068/S2871 bulgulari 0'a dusuyor |
| 5. `lint`, `typecheck`, `test`, `test:e2e` temiz | — | Asagidaki kosum ciktisi |

## Bulgu Listesi (kaynagindan; tahmin degil)

**Nasil alindi:** proje SonarQube Cloud'da OZEL; kimliksiz Web API `Project doesn't exist`
donuyor (`/api/components/show`, `/api/issues/search` -> total 0) ve repoda `SONAR_TOKEN`
secret'i tanimli degil (`gh secret list` bos). PR #3'un check-run ciktisi yalnizca iki
kosulun derecesini veriyor, bulgulari vermiyor. Bu yuzden bulgular **ayni analizoru yerelde
kosarak** alindi: gecici `sonarqube:community` (26.8) konteyneri + `sonar-scanner-cli`,
repo koku uzerinde uc kosum (HEAD oncesi hali / duzeltilmis hali / kapsam ayarli hali).
Kosum tamamen gecicidir: repoya hicbir sey eklemedi, konteynerler is bitince silindi.

**Kapiyi dusuren iki kosulun gercek kaynagi (ikisi de TEST dosyalarinda):**

| Kural | Tip / Severity | Dosya : satir | Ne yapildi |
|---|---|---|---|
| `typescript:S2871` "Provide a compare function ... to reliably sort" | BUG / **CRITICAL** -> Reliability **D** | `apps/api/test/auth.e2e-spec.ts:81,160,283` (T-003 merge commit'indeki satirlar; bugunku dosyada 95,174,297). Ayni kural sonraki ticketlarin e2e dosyalarinda da var: `billing`, `photos`, `reports`, `reports-list`, `templates` | Analiz kapsamindan cikarildi (`.sonarcloud.properties`) — assertion icindeki `Object.keys(body).sort()` cagrilari |
| `typescript:S2068` "Review this potentially hard-coded password" | VULNERABILITY / **MAJOR** -> Security **C** | `apps/api/test/auth.e2e-spec.ts:17` (`const PASSWORD`), ayrica `auth-rate-limit:18,129`, `billing:16`, `photos:30`, `report-pdf:23`, `reports-list:16`, `reports:16`, `templates:16` | Analiz kapsamindan cikarildi (`.sonarcloud.properties`) |

Derece esleslemesi birebir tutuyor: Sonar'da CRITICAL bug = Reliability D, MAJOR
vulnerability = Security C — PR #3'te dusen tam olarak bu iki kosuldu.

**Ticket'taki iki "aday" bulgunun dogrulanan durumu:**
- *Reliability adayi yanlisti.* `auth.service.ts` uzerinde (duzeltme ONCESI hali ile kosulan
  `tutanak-app-pre` projesinde) **hic bulgu yok** — ne S2259 null dereference, ne baskasi.
  `decode()` cagrisini Sonar isaretlememis. Duzeltme yine de yapildi: kriter 3 bunu acikca
  istiyor ve kod yolu zaten dolambacli.
- *Security adayi kismen dogruydu.* Sorun test dosyalarindaydi ama isaretlenen sey
  `TEST_JWT_SECRET` **degil**, `const PASSWORD` satirlariydi. `src/**/*.spec.ts` icindeki
  sabit parolalar (`auth.service.spec.ts:8`) bu kosumda isaretlenmedi.

**Kapsam ayarinin olculen etkisi (ayni kod, iki kosum):**

| Olcum | Kapsam ayari YOK | Test kaynaklari kapsam disi |
|---|---|---|
| `bugs` | 9 | **0** |
| `reliability_rating` | 4.0 (**D**) | **1.0 (A)** |
| `vulnerabilities` | 14 | 3 |
| Test kaynakli S2068/S2871 | 11 | **0** |

## Alinan Kararlar ve Gerekceler

- **`sonar-project.properties` DEGIL, `.sonarcloud.properties`.** SonarQube Cloud dokumani
  (Automatic Analysis) net: otomatik analiz `sonar-project.properties` dosyasini **yok
  sayar**; ek yapilandirma yalnizca `.sonarcloud.properties` ile ve yalnizca **varsayilan
  daldaki** kopyasiyla okunur. Desteklenen anahtarlar: `sonar.sources`, `sonar.exclusions`,
  `sonar.inclusions`, `sonar.tests`, `sonar.test.exclusions`, `sonar.test.inclusions`,
  `sonar.sourceEncoding`, `sonar.cpd.exclusions`. Ticket'in onerdigi `sonar.test.inclusions`
  yolu tek basina yetmezdi: unit spec'ler `src/` altinda kaynaklarla ic ice duruyor ve
  `sonar.tests` dizin listesi ister (joker kabul etmez).
- **Yontem: `sonar.exclusions` ile test kaynaklarini analiz disinda birakmak** (kriter 4'un
  izin verdigi iki yoldan ilki). Gerekce: test kodu uretime gitmez, disariya yuzey acmaz ve
  icindeki "parola"lar tanim geregi sahte girdilerdir; kalite kapisi urun kodunu olcmelidir.
  Alternatif olan "sabit degerleri kaldirmak/uretmek" testleri sirlarla ilgilenir hale
  getirirdi ve ticket'ta acikca kapsam disi. Kural bazinda susturma
  (`sonar.issue.ignore.multicriteria`) tercih edilmedi: otomatik analizin desteklenen
  anahtar listesinde yok.
- **`expiresIn` tek kaynaktan turer.** Deger artik `JWT_EXPIRES_IN` yapilandirmasindan
  (CLAUDE.md §5.1) hesaplanir; token imzalandiktan sonra geri decode EDILMEZ, dolayisiyla
  `decode()` -> `null` kod yolu tamamen kalkti. Ayni env degeri hem
  `JwtModule.signOptions.expiresIn` hem de yanittaki `expiresIn` icin kullanildigi icin iki
  deger yapisal olarak ayni kalir.
- **Birim ZORUNLU (`7d` gibi), birimsiz sayi reddedilir.** Gerekce: imzalayici
  (jsonwebtoken/`ms`) birimsiz metni **milisaniye** sayar (`'604800'` -> 10 dakika); ayni
  metinden saniye turetmek sessiz bir yanlis yorum olurdu. Bicim bozuksa hata acilista
  firlar ve uygulama acilmaz (CLAUDE.md §5 fail-fast). Desteklenen birimler: s, m, h, d, w, y.
- **Cevirme isi ayri bir saf fonksiyonda** (`access-token-ttl.parser.ts`): kod tabanindaki
  mevcut `*.parser.ts` / `*.validator.ts` / `*.formatter.ts` yerlesimiyle ayni (CLAUDE.md §2,
  §7 "Mapper/saf fonksiyon"). Yeni kutuphane (`ms`) EKLENMEDI — §6.1 listesinde yok ve
  ihtiyac 15 satirlik saf fonksiyonla karsilaniyor.
- **DI: `ACCESS_TOKEN_TTL_SECONDS` deger token'i**, `PHOTO_MAX_PER_REPORT` ile birebir ayni
  desen (`config/config.tokens.ts` + modulde `useFactory`).
- **Ucuncu constructor parametresi VARSAYILANLI.** Kriter 3 "mevcut auth birim testleri
  degistirilmeden gecer" diyor; mevcut spec `new AuthService(repo, jwt)` ile iki argumanla
  kuruyor, zorunlu ucuncu parametre derlemeyi kirardi. Varsayilan deger sabit sayi degil,
  env semasindan disari acilan `DEFAULT_JWT_EXPIRES_IN` ('7d') uzerinden hesaplanir — tek
  dogruluk kaynagi korunur. Uygulamada deger her zaman DI saglayicisindan gelir.

## Varsayimlar

- Yerel SonarQube 26.8 CE'nin `Sonar way` profili ile SonarQube Cloud'un profili, S2068 ve
  S2871 gibi eski/kararli kurallarda ayni davranir. Iki dereceyi (D ve C) birebir uretmesi
  bu varsayimi destekliyor; yeni numarali kurallar (S77xx/S87xx) urunler arasi farklilik
  gosterebilir ama kapiyi dusuren kosullarla ilgileri yok.
- `.sonarcloud.properties` varsayilan dalda etkin olur; bu ticket'in PR'inda dosya henuz
  varsayilan dalda olmadigi icin PR analizi eski kapsamla kosabilir. Bu PR'in **yeni kodu**
  (auth modulu + config + yeni parser) yerel analizde **sifir bulgu** urettigi icin PR'in
  kendi Quality Gate'i yine de yesil beklenir; kalici etki merge sonrasi devreye girer.

## Anayasa (CLAUDE.md) Bosluklari

- Anayasa "analiz kapsami yapilandirmasi" (Sonar/`.sonarcloud.properties`) diye bir dosyayi
  §1 klasor agacinda tanimlamiyor; kok dizine konuldu (aracin zorunlu kildigi konum).
- §9 statik analiz tablosunda SonarQube Cloud yok (ESLint/tsc/audit/prisma var). Kapinin
  zorunlu check olup olmayacagi ticket'ta acikca kapsam disi; not olarak birakiliyor.

## Bilinen Sinirlamalar

- Kriter 1'in nihai kaniti (PR check'inde "Quality Gate passed") bu oturumda uretilemez:
  PR henuz yok ve ozel projenin bulgularina kimliksiz erisilemiyor. Yerel analiz, kapiyi
  dusuren iki kosulun kaynagini ve kapsam ayarinin bunlari sifirladigini kanitliyor;
  PR'daki yesil check QA/review turunda dogrulanmalidir.
- Test kodu artik Sonar tarafindan hic analiz edilmiyor: test dosyalarindaki gercek bir hata
  (or. yanlis `sort`) statik analizle yakalanmayacak. ESLint + `--max-warnings=0` test
  dosyalarini kapsamaya devam ediyor.
- Parser `ms` kutuphanesinin kabul ettigi bazi bicimleri (`'2 days'`, `'100ms'`) reddeder.
  `.env.example` ve §5.1 varsayilani `7d` oldugu icin pratik etkisi yok; degeri elle
  degistiren kisi acilista net bir hata gorur.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- `docker-compose.yml:65` — `secrets:S6698` **BLOCKER** vulnerability (Postgres parolasi
  kodda). Yerelde bilincli bir varsayilan; ama T-003'ten once var oldugu icin PR #3'te "yeni
  kod" sayilmadi. Bu dosyaya dokunan **ilk PR** Security derecesini E'ye dusurur.
- `apps/api/Dockerfile:15` — `docker:S6470` CRITICAL (`COPY . .` hassas veri tasiyabilir),
  `Dockerfile:2` — `docker:S6471` MINOR (root kullanici). Ayni tuzak: Dockerfile'a dokunan
  PR bunlari yeni kod olarak alir.
- `apps/web/src/**` — 6 adet `typescript:S6759` (props read-only olmali) + 1 `S6772`; hepsi
  CODE_SMELL, kapiyi dusuren kosullarla ilgisi yok.
- SonarQube Cloud check'i hala **zorunlu degil** (branch protection'da yok). Ticket bunu
  acikca kapsam disi birakiyor; ama artik yesile cekildigi icin zorunlu yapma karari
  alinabilir (once merge, sonra branch protection — sirasi onemli, T-002 dersi).

## Test Kosum Ciktisi (ozet)

```
npm run lint            -> temiz (eslint . --max-warnings=0)
npm run format:check    -> All matched files use Prettier code style!
npm run typecheck       -> temiz (api + web)
npm test                -> tools: 5 suite / 25 test PASS
                           api:   40 suite / 265 test PASS (coverage esikleri saglandi)
                           web:   11 suite / 53 test PASS
npm run test:e2e        -> 10 suite / 138 test PASS (gercek Postgres)
npm run build           -> basarili (api + web/PWA)
```

Yeni testler:
- `access-token-ttl.parser.spec.ts`: 7 test (birimler, birimsiz sayi reddi, taninmayan birim,
  bozuk bicim, sifir omur, hata mesajinda deger tasinmamasi).
- `auth.service.spec.ts` (+2, mevcut testler DEGISTIRILMEDI): "expiresIn yapilandirilan
  omurden uretilir, token decode EDILMEZ" ve "omur verilmediginde varsayilan 7d".
- Regresyon korumasi: `auth.e2e-spec.ts` degistirilmeden `expiresIn === 604800` bekliyor ve
  geciyor — deger artik decode'dan degil yapilandirmadan geliyor.
