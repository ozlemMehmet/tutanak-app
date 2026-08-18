# Devlog — H-005

> Uretici: dev-agent | Branch: ticket/H-005 | Tarih: 2026-08-18

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Temiz kurulum sonrasi `GET /api/v1/templates` uc sablon icin Turkce ad doner | `apps/api/prisma/seed.ts` — 3 sablonun `name` alani | `test/templates.e2e-spec.ts` → `EXPECTED_TEMPLATE_NAMES` (izole DB'de `migrate:deploy` + `seed` + gercek HTTP) |
| 2. Onceden ASCII adlarla seed edilmis DB, seed yeniden kosunca duzelir | Kod degisikligi YOK — mevcut `upsert.update` dali | `test/migration.e2e-spec.ts` → *"onceden ASCII adlarla seed edilmis veritabaninda seed yeniden kosulunca adlar Turkce ye guncellenir"* (YENI test) |
| 3. `manifest.webmanifest` `name` + `description` Turkce | `apps/web/public/manifest.webmanifest` | Otomatik test yok — statik varlik; dogrulama: JSON parse + UTF-8 roundtrip (asagida) |
| 4. `index.html` `<title>` + `<meta name="description">` Turkce | `apps/web/index.html` | Otomatik test yok — statik varlik; dogrulama: gozle + UTF-8 kontrolu |
| 5. Regresyon: sablon adina referans veren e2e testler guncel Turkce dizelerle gecer | — | `templates.e2e-spec.ts` + `migration.e2e-spec.ts` sabitleri gercek Turkce harflerle guncellendi; ayrica `[şğıŞĞİ]` iceren dize kontrolu eklendi |
| 6. `test`, `test:e2e`, `lint`, `typecheck` temiz | — | Tam paket kosuldu (ozet asagida) |

## Alinan Kararlar ve Gerekceler
- **`migration.e2e-spec.ts`'te ad dogrulamasi `seed` adimindan SONRAYA tasindi.** Eski test
  adlari `migrate:deploy`'dan sonra, `seed` kosulmadan assert ediyordu ve yalnizca init
  migration'in INSERT blogu sayesinde geciyordu. Belgelenen acilis sirasi
  (`docker-compose.yml` + `apps/api/Dockerfile` CMD) `migrate:deploy && seed && start`
  oldugu icin sablon adlarinin tek yetkili kaynagi seed adimidir. Test artik dogrulamayi
  boru hattinin dogru noktasinda yapiyor; "migration sonrasi tam olarak 3 kayit bulunur"
  testi migrate-only asamasini kapsamaya devam ediyor (kapsam kaybi yok, iki yeni test ile
  net kapsam artisi var).
- **Init migration (`prisma/migrations/.../migration.sql`) DEGISTIRILMEDI.** ASCII adlari
  hala tasiyor ama kullaniciya ulasmiyor: seed her aciliste migration'dan sonra kosup
  `update` dali ile uzerine yaziyor. CLAUDE.md §1 migration dosyalarinin elle
  duzenlenmedigini soyluyor ve ticket kapsami uc dosya olarak tanimli. Ayrica bu blok
  mimari kaynagi `data-model.sql`'in birebir kopyasidir; onu duzeltmek architect isidir
  (asagida sozlesme boslugu olarak raporlandi).
- **Yalnizca diakritikler geri getirildi, kelime secimi degistirilmedi.** Ornegin aciklamada
  "foto" kelimesi "fotograf" yapilmadi — bu bir metin yazimi degisikligi olurdu ve ticket
  metin duzeltmesi degil, karakter duzeltmesi istiyor.
- **`apps/*/src` altindaki birim test fixture'larina DOKUNULMADI.** Bunlar elle uretilmis
  sahte sablon nesneleridir (seed edilmis veriyi okumazlar), ticket teknik notu bunlari
  "bilerek ASCII, degistirilmemeli" olarak isaretliyor ve kapsam disi bolumu `apps/*/src`'i
  aciken disliyor. Yalnizca gercek seed verisiyle karsilastiran iki e2e dosyasi guncellendi.
- **Assert'ler icin `[şğıŞĞİ]` kontrolu eklendi.** Bilgi tabani dersi
  (`testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi.md`) tam olarak bu urunde,
  hem kaynagin hem assert'in birlikte ASCII'ye katlanmasi yuzunden hatanin uc kapidan da
  gectigini kaydediyor. `ç ö ü` Latin-1'de var oldugu icin kismi calisma teshisi zorlastiriyor;
  bu yuzden kontrol ozellikle Latin-1'de BULUNMAYAN `ş ğ ı` harfleri uzerinden yapiliyor.

## Varsayimlar
- Ticket'in "Dogru degerler (PRD/data-model.sql ile birebir)" ifadesindeki baglayici kaynak
  ticket'in kendi listeledigi Turkce dizelerdir; `data-model.sql` fiilen ASCII karsiliklarini
  tasiyor (asagiya bakiniz), dolayisiyla "birebir" ifadesi niyeti anlatiyor, mevcut dosya
  icerigini degil.
- Uretim/staging veritabanlari da belgelenen `migrate:deploy && seed && start` sirasiyla
  aciliyor; kriter 2'nin kendiliginden duzelme davranisi bu sarta bagli.

## Anayasa (CLAUDE.md) Bosluklari
- **Sozlesme boslugu (§3.6 / §11):** `factory/04-architecture/data-model.sql` (satir 134-138)
  ve ondan turetilen init migration INSERT blogu (satir 347-352) sablon ad/aciklamalarini
  ASCII'ye katlanmis halde tutuyor. Bu ticket sonrasi `seed.ts` bu iki dosyadan SAPIYOR.
  Dev ajani `factory/04-architecture/*` dosyalarini degistiremez (§11), bu yuzden sapma
  duzeltilmedi, `seed.ts` basina yorum olarak islendi ve burada raporlaniyor. Architect'in
  `data-model.sql`'i (ve ardindan migration blogunu) Turkce degerlerle hizalamasi gerekiyor.

## Bilinen Sinirlamalar
- `manifest.webmanifest` ve `index.html` icin otomatik test YOK. Bunlar derleme oncesi statik
  varliklar; mevcut test altyapisinda (jsdom birim testleri Vite'in HTML'ini yuklemiyor)
  dogal bir kosum noktalari yok. Uygun kapi bir CI kontrolu olurdu — dev ajaninin
  `.github/workflows/**` yazma izni olmadigi icin ticket bunu raporlamayi istiyor (asagida).
- Init migration hala ASCII adlari yaziyor; `seed` KOSULMADAN yalin `migrate:deploy`
  yapilan bir ortam ASCII adlari gorur. Belgelenen hicbir akista bu durum olusmuyor.

## CI/lint onlemi ONERISI (ticket geregi uygulanmadi, raporlaniyor)
Ticket "Kapsam DISI" bolumu, kalici regresyon onlemini uygulamak yerine raporlamayi istiyor.
Onerilen kural: `apps/*/src` DISINDAKI kullaniciya donuk metin tasiyan dosyalarda ASCII'ye
katlanmis Turkce tespiti.
- Kapsanacak kaliplar: `apps/web/index.html`, `apps/web/public/*.webmanifest`,
  `apps/api/prisma/seed.ts`, `apps/*/public/**/*.{html,json,webmanifest}`.
- Kural: bu dosyalardaki kullaniciya donuk dize alanlari (`name`, `description`, `<title>`,
  `<meta name="description">`) icin `Tutanagi|Sayac|Demirbas|Kontrolu|olusturup|paylasmak`
  gibi katlanmis bicimler reddedilir; VEYA pozitif kural: bu alanlar en az bir `[şğıŞĞİ]`
  icermelidir.
- Not: bu bir CI is akisi degisikligi gerektirdiginden ayri ticket/insan karari konusudur.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- **Ticket'in kendi dogrulama komutu `.sql` dosyalarini disliyor.** Teknik notlardaki
  `grep -rl ... --include=*.ts --include=*.html --include=*.webmanifest --include=*.json`
  komutu `--include` filtreleri yuzunden `migration.sql` ve `data-model.sql`'i hic goremiyor.
  Bu, B-002/B-005'in kok nedeniyle AYNI aile: olcum dosya kalibina gore yapiliyor, dizenin
  kullaniciya ulasip ulasmadigina gore degil. Bu yuzden iki `.sql` yuzeyi ticket kapsamina
  hic girmemis.
- `apps/web/src/api/schema.d.ts` (satir 968) `Giris/Cikis Teslim Tutanagi` ornegini tasiyor.
  URETILMIS dosyadir (`openapi-typescript`, CLAUDE.md §3.6 elle duzenlenmez); kaynagi
  `api-contract.yaml`'daki `example` alanidir. Yalnizca tip yorumudur, calisma zamanina
  etkisi yoktur.

## Test Kosum Ciktisi (ozet)
```
# RED (kaynak duzeltilmeden once, migration.e2e-spec.ts)
✕ seed sonrasi sablon adlari PRD ile birebir (Turkce) eslesir
✕ onceden ASCII adlarla seed edilmis veritabaninda seed yeniden kosulunca adlar Turkce ye guncellenir
✕ seed script i ikinci kez kosuldugunda kayit sayisi 3 kalir (idempotent)
Tests: 3 failed, 10 passed, 13 total

# GREEN — birim (npm run test)
Test Suites: 11 passed, 11 total   Tests:  74 passed   (kok)
Test Suites: 56 passed, 56 total   Tests: 386 passed   (@tutanak/api)
Test Suites: 57 passed, 57 total   Tests: 448 passed   (@tutanak/web)

# GREEN — e2e (npm run test:e2e)
Test Suites: 13 passed, 13 total
Tests:       205 passed, 205 total

# Statik analiz
npm run lint          -> 0 uyari (--max-warnings=0)
npm run typecheck     -> temiz (kok + api + web)
npm run format:check  -> All matched files use Prettier code style!
```

Kriter 1 ve 2 ayrica gercek Postgres uzerinde elle dogrulandi:
```
# Kriter 1 — temiz DB + migrate:deploy + seed
Giriş/Çıkış Teslim Tutanağı / Sayaç/Demirbaş Tespiti / Periyodik Durum Kontrolü

# Kriter 2 — ASCII adlarla doldurulmus DB, ardindan migrate:deploy && seed
ONCE : Giris/Cikis Teslim Tutanagi | eski ascii
SONRA: Giriş/Çıkış Teslim Tutanağı | Kiracı giriş veya çıkış teslimi sırasında ...
kayit sayisi = 3 (yeni satir eklenmedi, mevcut satirlar guncellendi)
```

Ek dogrulama: `manifest.webmanifest` gecerli JSON ve UTF-8 roundtrip'i bozulmadan okunuyor
(`name = "Emlak Teslim Tutanağı"`).
