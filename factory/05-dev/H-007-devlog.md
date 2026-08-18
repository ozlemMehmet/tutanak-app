# Devlog — H-007

> Uretici: dev-agent | Branch: ticket/H-007 | Tarih: 2026-08-18

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Kosulabilir kontrol + mevcut test komutuna bagli | `tools/ascii-folded-turkish.spec.ts` kok jest kosumundadir (`npm test` -> `jest --config jest.config.mjs`); ayrica `package.json` -> `lint:tr` betigi | `npm betikleri` blogu: kok `test` betigi jest yapilandirmasini kosar + `lint:tr` betigi kontrolu isaret eder |
| 2. Sayilan tum yuzeyler taranir (`src/` ile sinirli DEGIL) | `SCAN_TARGETS` (web/src, api/src, prisma/seed.ts, manifest.webmanifest, index.html) + `.ts/.tsx/.html/.webmanifest/.json` ayristiricilari | `SCAN_TARGETS` kapsam testi, `isScannedFile` testi, `scanRepository` sentetik bozuk depo testi (5 yuzeyin BEPSINDE bulgu) |
| 3. Kanit: kontrol gercekten yakaliyor | Kalip listesi + AST tabanli dize cikarimi | `scanSource — kasten bozulmus ornekler` blogu (6 test) **ve** `gercek urun dosyalarinin katlanmis kopyasinda hata verir` testi: gercek `SubscriptionPage.tsx`, `seed.ts`, `manifest.webmanifest`, `index.html` ASCII'ye katlanip taranir -> bulgu sart |
| 4. Mevcut depoda temiz gecer | Yanlis pozitif kurallari (asagida) | `mevcut depoda temiz gecer` (gercek depo koku taranir, `formatFindings` bos olmali) |
| 5. Yanlis pozitif yonetimi gerekceli | `isTechnicalValue`, `NON_USER_FACING_JSX_ATTRIBUTES`, `DIAGNOSTIC_CALLEE_PATTERNS`, `EXCLUDED_PATH_RULES`, `SUPPRESSION_MARKER` — her biri kod icinde gerekcesiyle | `yanlis pozitif yonetimi` blogu (9 test): dogru Turkce, saf ASCII dogru metin, yorumlar, kod anahtari/URL/e-posta/MIME/yol, yumusama (`sonucu`), log cagrilari, ciplak `Error`, susturma isareti |
| 6. Ne yaptigi + nasil genisletilecegi anlatilir | — | Bu devlog: "Kontrol ne yapar" ve "Yeni yuzey/kelime eklerken" bolumleri |

## Kontrol ne yapar

`tools/turkish-text/ascii-folded-turkish.ts` iki soruyu ayirir:

1. **Hangi metin kullaniciya donuktur?** TS/TSX icin TypeScript AST'i kullanilir: dize sabitleri,
   sablon dize parcalari ve JSX metin dugumleri toplanir. Kod yorumlari yapisal olarak DISARIDA
   kalir (depo genelinde yorumlar bilincli ASCII'dir). `.html` icin metin dugumleri +
   `content/alt/title/placeholder/aria-label`; `.webmanifest/.json` icin nesne DEGERLERI (anahtarlar
   degil).
2. **Bu metin ASCII'ye katlanmis mi?** `ASCII_FOLDED_PATTERNS` listesindeki kaliplar aranir. Her
   kalip, dogru yazimi MUTLAKA Turkce harf tasiyan bir govde/ektir (`odeme`, `tutanag`, `paylas`,
   `-lari`, `-madi`...). Bu yuzden dogru yazim ("Ödeme", "Tutanağı") kalibi tetiklemez; saf ASCII
   ama DOGRU olan metin ("Yeni Tutanak") de bulgu uretmez.

Bulgu bulunursa jest testi kirilir ve rapor `dosya:satir — "kelime" (beklenen: "...") | metin`
biciminde basilir.

## Alinan Kararlar ve Gerekceleri

- **Jest testi olarak uygulandi** (ticket "Teknik Notlar" bunu acikca serbest birakiyor). Sebep:
  kriter 1 "mevcut test komutuna bagli" istiyor; kok `jest.config.mjs` zaten `tools/**/*.spec.ts`
  kosuyor ve `npm test` -> CI zinciri onu kendiliginden calistiriyor. `.github/**` degismedi
  (Kapsam DISI). Ayri kosum icin `npm run lint:tr` eklendi (yeni bagimlilik yok).
- **Regex yerine TypeScript AST.** `typescript` zaten kok devDependency. Satir bazli regex ile
  yorumlari, import yollarini ve `className` degerlerini ayirmak guvenilir degildi; AST ile
  "kullaniciya donuk dize" tanimi yapisal hale geldi.
- **Teshis (log) metinleri taranmaz — kod tabaninin mevcut kuralidir.** `resend-email.adapter.ts`
  bunu tek dosyada gosteriyor: kullaniciya giden sabit gercek Turkce
  (`REJECTED_MESSAGE = 'E-posta sağlayıcısı gönderimi reddetti.'`), log baglami ASCII
  (`logger.error('E-posta saglayicisi gonderimi reddetti (to=...)')`). Bu yuzden `logger./console.`
  cagrilari, `process.stdout|stderr.write` ve **ciplak `new Error(...)`** argumanlari disaridadir.
  `AppError` hiyerarsisi (CLAUDE.md §4.2) kullaniciya donuktur ve TARANIR — testle sabitlendi.
- **Susturma isareti gerekce zorunlu:** `// ascii-tr-ok: <neden>`. Gerekcesiz yazilan isaret
  calismaz (test var). CLAUDE.md §9'un "uyari bastirma gerekce ister" kuralinin aynisi.
  Depoda 6 yerde kullanildi (yalnizca yorum satiri eklendi, davranis degismedi):
  `env.schema.ts` (acilista operatore giden zod mesaji), `access-token-ttl.parser.ts`
  (`new Error` ile firlatilan yapilandirma metni; sabit oldugu icin yapisal kural yakalamiyor),
  `r2-storage.adapter.ts` x2 (`fail()`'e giden log baglami; kullaniciya
  `STORAGE_UNAVAILABLE_MESSAGE` gidiyor), `iyzico-payment.adapter.ts` x2 (saglayiciya giden ASCII
  yer tutucu payload; ayni nesnedeki `city: 'Istanbul'`, `country: 'Turkey'` ile ayni kalip).
- **Yumusama tuzagi:** ilk kosumda `sonuc\w*` kalibi `'Ödeme sonucu bekleniyor'` metnini yanlis
  pozitif isaretledi — "sonuç + unlu ek = sonucu" DOGRUDUR. Kalip eksiz bicime (`\bsonuc\b`)
  daraltildi ve bu davranis teste baglandi. Kalip listesine `ç/k` ile biten govde eklenirken ayni
  kontrol yapilmalidir.
- **Test fixture'lari disarida** (ticket Kapsam DISI): `*.spec.ts(x)`, `*.e2e-spec.ts`,
  `test/`, `e2e/` dizinleri; uretilmis dosyalar: `*.d.ts`, `dist/`, `dev-dist/`, `coverage/`.

## Yeni yuzey/kelime eklerken (kriter 6)

- **Yeni kelime kalibi:** `ASCII_FOLDED_PATTERNS` listesine tek satir eklenir (TEK YER). Kural:
  kalibin dogru yazimi Turkce harf icermeli; ekli bicimlerde yumusama olup olmadigi kontrol
  edilmeli (`sonuc` ornegi).
- **Yeni yuzey (dosya/dizin):** `SCAN_TARGETS`'a yol eklenir. Uzanti yeni ise (`.md`, `.yaml`...)
  `SUPPORTED_EXTENSIONS` + `scanSource` icinde o uzantinin `extractFrom*` ayristiricisi eklenir;
  aksi halde dosya sessizce atlanir.
- **Yeni yanlis pozitif sinifi:** once yapisal kural (`isTechnicalValue`, JSX oznitelik listesi,
  teshis cagrisi listesi) genisletilir; tek seferlik durumlarda `// ascii-tr-ok: <gerekce>`
  kullanilir.

## Varsayimlar

- "Kullaniciya donuk", urunun kendi arayuzunden ya da API yanitindan son kullaniciya ulasan metin
  demektir; acilis/operator konsoluna ve log satirlarina giden metin bu tanimin disindadir.
- Depodaki ASCII yorum uslubu bilinclidir ve degistirilmeyecektir (bu yuzden yorumlar taranmaz).

## Anayasa (CLAUDE.md) Bosluklari

- **Kalite araci kodunun yeri anayasada tanimli degil.** §1 agacinda `tools/` yok (ama depoda
  T-001'den beri kok seviyesi `tools/*.spec.ts` deseni var). Mevcut desene uyuldu:
  spec `tools/`, yardimci modul `tools/turkish-text/`. Anayasa boslugu olarak isaretlenir.
- **Susturma isareti (`ascii-tr-ok`) yeni bir mekanizmadir.** Desen Sozlugu'nde karsiligi yok;
  §9'un "gerekceli bastirma" kuralinin bu kontrole tasinmis halidir. Retrospektifte sozluge
  girmesi onerilir.

## Bilinen Sinirlamalar

- Kontrol **dil dogrulugunu** olcmez, yalnizca bilinen katlanma kaliplarini arar. Listede olmayan
  bir kelime (`kucultme` gibi) yakalanmaz — liste yasayan bir belgedir.
- `.md`, `.sql`, `.yaml` ve e-posta sablonu disindaki metin ureten yuzeyler bu turda kapsam
  disidir (ticket kriter 2'nin listesi esas alindi).
- HTML/JSON ayristiricilarinda satir numarasi hesabi dosya basi O(n·m)'dir (her eslesme icin
  bastan sayim). Taranan dosyalar KB olceginde oldugu icin bilincli olarak basit birakildi;
  tum depo taramasi ~80 ms suruyor.
- Susturma isareti satir bazlidir: isaret, susturulacak dizenin KENDI satirinda veya hemen
  ustundeki satirda olmalidir (cok satirli yorum blogunun ilk satirinda degil).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- `iyzico-payment.adapter.ts` -> `BUYER_PLACEHOLDER` alanlari saglayiciya ASCII yer tutucu
  gonderiyor (`Kullanicisi`, `Bilgi toplanmadi`, `Istanbul`). Saglayici sayfasinda/faturada
  gorunuyorsa urun metni sayilir ve duzeltilmesi ayri bir bug ticket'i olmalidir. Bu turda
  yalnizca gerekceli susturma isareti eklendi.
- Kontrol `apps/api/test/**` fixture'larini taramiyor (ticket Kapsam DISI). `report-pdf.e2e-spec.ts`
  disindaki fixture'lar hala ASCII; PDF/e-posta gibi metin ureten akislarda gercek Turkce fixture
  kullanimini garantileyecek ayri bir kontrol ihtiyaci duruyor (bilgi tabani dersi:
  `testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi.md`).

## Test Kosum Ciktisi (ozet)

```
$ npm run lint:tr
Tests:       23 passed, 23 total   (tools/ascii-folded-turkish.spec.ts)

$ npm test
kok:  Test Suites: 12 passed, 12 total | Tests: 97 passed, 97 total
api:  Test Suites: 56 passed, 56 total | Tests: 386 passed, 386 total
web:  Test Suites: 57 passed, 57 total | Tests: 448 passed, 448 total

$ npm run lint && npm run typecheck && npm run format:check
eslint --max-warnings=0: temiz | tsc --noEmit (kok+api+web): temiz | prettier: temiz
```
