# Devlog — H-004

> Uretici: dev-agent | Branch: ticket/H-004 | Tarih: 2026-08-17

Konu: B-004 — masaustunde `.page` kapsayicisi sinirsiz (icerik kenardan kenara), birincil
butonlar viewport genisliginde, tutanak detayindaki "Fotograflar"/"Paylasim" bolumleri
kart/panel zemininde durmuyor. Degisiklik YALNIZCA `apps/web/src/styles/app.css` icindedir
(salt istemci tarafi CSS/yerlesim); hicbir TSX/markup dosyasina dokunulmadi — gerekli
siniflar (`.photo-section`, `.share-panel`) markup'ta zaten vardi.

## Kriter -> Plan Eslemesi (kod yazmadan ONCE dolduruldu)

| # | Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|---|
| 1 | 1280px'te `.page` genisligi <= 960px VE yatayda ortali | `app.css` `.page` → `max-width: 768px; margin-inline: auto;` | `app-layout.spec.ts` → "masaustunde kapsayici genisligi 960px ustune cikmaz", "kapsayici yatayda ortalanir", "kapsayici genisligi tokens.css kirilma noktasindan gelir" |
| 2 | 375px'te `.page` davranisi DEGISMEZ (`--space-3`, viewport'u doldurur) | `.page` taban `padding`/`padding-bottom` kurallarina DOKUNULMADI; sinir `md` (768px) oldugu icin mobilde hic devreye girmez | `app-layout.spec.ts` → "mobil kenar boslugu --space-3 olarak KORUNUR", "alt guvenli alan payi KORUNUR", "kapsayici genisligi md kirilma noktasinin ALTINDA hicbir sinir getirmez", "kapsayiciya sabit bir width verilmez" |
| 3 | `md`+ genislikte `.subscription__pay`/`.auth-form__submit`/`.report-create__submit` kapsayici genisligine ESIT DEGIL; <768px'te tam genislik KORUNUR | Dosya SONUNA `@media (min-width: 768px)` blogu: `width: auto; align-self: flex-start; min-width: calc(var(--space-7) * 3)` | `app-layout.spec.ts` → uc secici icin `it.each`: "mobilde tam genislik KALIR", "md ustunde icerik genisligine gore boyutlanir", "md ustunde kapsayicisina gerilmez", "md ustunde makul bir min-width korur" |
| 4 | "Fotograflar" + "Paylasim" bolumleri `.status-card`/`.report-card` ile AYNI Elevation 1 golgesinde | `.photo-section, .share-panel` → `padding`, `border-radius: var(--radius-lg)`, `background: var(--color-surface)`, `box-shadow: 0 1px 2px rgb(0 0 0 / 6%)` | `app-layout.spec.ts` → golge degeri `.report-card`tan OKUNUR ve esitlik iddia edilir (hardcode degil); ayrica `.status-card` ile ayniligi dogrulanir |
| 5 | Regresyon: `report-card-list` md+ 2 kolon ve FAB->buton donusumu BOZULMAZ | Mevcut `@media (min-width: 768px)` kurallarina DOKUNULMADI | `app-layout.spec.ts` → "tutanak kart listesi md ustunde 2 kolon KALIR", "FAB md ustunde normal butona DONMEYE devam eder" |

Red-green: test dosyasi once yazildi ve kosuldu — 26 testin 17'si KIRMIZI (kriter 1/3/4),
9'u zaten yesildi (kriter 2 ve 5 regresyon testleri, yani "bozmadigimi" olcen testler
degisiklikten ONCE de gecmeliydi ve gectiler). CSS eklendikten sonra 26/26 yesil.

## Alinan Kararlar ve Gerekceler

- **Kapsayici genisligi 960px degil `768px` (tokens `breakpoints_px.md`).** Ticket 960'i
  "baslangic noktasi, nihai degil" diye veriyor ve kriteri `<= 960px` olarak yaziyor.
  Rol sozlesmesi ve `app.css` dosya basligi keyfi px yasakliyor; token setinde
  "container/max-width" adimi YOK. Bu yuzden deger, ayni dosyadaki mevcut emsalle birebir
  ayni mantikla secildi: `.auth-page` okuma genisligini `sm` kirilma noktasindan (480px)
  aliyor → `.page` de bir kirilma noktasindan alir. `<= 960` sartini saglayan en buyuk
  kirilma noktasi `md` = 768px (`lg` = 1024 kriteri ihlal ederdi). Test bunu iki tarafli
  dogruluyor: hem `<= 960` (ticket kriteri) hem `== md` (token disiplini).
- **Buton daraltmasi dosyanin SONUNDA.** Uc butonun `width: 100%` taban kurali dosyanin
  ortasinda/sonunda tanimli ve media sorgusu ozgulluk EKLEMEZ; override daha yukarida
  dursaydi `.subscription__pay { width: 100% }` (satir ~920) onu sessizce ezerdi. Yer
  secimi gerekcesiyle birlikte koda yorum olarak da yazildi.
- **`align-self: flex-start` sart.** `.auth-form` ve `.report-create__step` flex kolon
  kapsayicilar (`align-items: stretch` varsayilani); tek basina `width: auto` butonu yine
  kapsayici genisligine gererdi — kriter 3 "ESIT DEGILDIR" der, dolayisiyla bu satir
  kozmetik degil kriterin kendisidir. Ayri bir test bu satiri koruyor.
- **Panel yaricapi `lg` (16px).** design.md §4.4 `lg` adimini "buyuk kart / alt-sheet panel"
  icin tanimlar; `md` adimi buton/kucuk karttir. Bu iki bolum sayfa seviyesinde buyuk
  panellerdir.
- **Golge testi degeri `.report-card`tan okur.** Kriter "AYNI golge" dedigi icin test sabit
  string yerine mevcut karttan okunan degerle karsilastirma yapar; ileride Elevation 1
  degeri tek yerde degisirse test "ayrisma"yi yakalar, "eski sabiti" degil.
- **Desen kullanilmadi.** Problem saf bir stil sozlesmesi; Desen Sozlugu'nde karsiligi olan
  bir problem sinifi degil (§7.1 "desen susu" yasagi).

## Varsayimlar

- `.page auth-page` tasiyan kimlik ekranlarinda cascade `.auth-page`'in `max-width: 480px` +
  `margin: 0 auto` kurallarini kazandirir (ikisi de tek-sinif ozgullugunde, `.auth-page`
  dosyada sonra geliyor) → kimlik ekranlarinin genisligi DEGISMEZ, bu bilincli.
- `min-width: calc(var(--space-7) * 3)` (192px) "makul min-width" kabul edildi; butonlarin
  metni ("Odeme Yap", "Giris Yap", "Taslak Olustur") zaten bunun altinda kaldigi icin
  masaustunde uc buton da 192px'te durur, kapsayici genisligine (448-736px) esit olmaz.

## Anayasa (CLAUDE.md) Bosluklari

- **Tasarim sozlesmesi boslugu 1 — kapsayici genisligi.** `design-tokens.json`de
  container/max-width token'i, `design.md`de masaustu yerlesim sartnamesi YOK (ticket'in
  kendisi de bunu tespit ediyor). En yakin token (`breakpoints_px.md`) kullanildi; kalici
  sartname ux-designer-agent isidir (asagida).
- **Tasarim sozlesmesi boslugu 2 — buton min-width.** Token setinde buton genislik olcegi
  yok; deger bosluk olceginin en ust adimindan turetildi (3 x `space-7`). Kod yorumunda da
  isaretli.
- Elevation degerleri zaten token disidir ve `design.md` §4.4'te prose kural olarak durur —
  mevcut `.report-card`/`.status-card` ile birebir ayni deger kullanildi, yeni deger
  uretilmedi.

## Bilinen Sinirlamalar

- **Kriter olcumu tarayicida degil stil kaynagindadir.** jsdom harici stylesheet uygulamaz
  ve yerlesim hesaplamaz (`getBoundingClientRect` her zaman 0); repoda Playwright/headless
  tarayici bagimliligi YOK (`apps/web` icinde playwright paketi bulunmuyor). Bu yuzden
  "hesaplanan genislik" kriterleri, kod tabaninda zaten yerlesik olan desenle
  (`ReportListPage.spec.tsx` → "gorsel sozlesmesi (app.css)") stil kaynagindan dogrulandi.
  Playwright altyapisi kurmak ticket kapsami disi olurdu; 1280x900 / 375px gorsel
  dogrulamasi QA'nin tarayicili kosumuna kalir.
- Kapsayici TEK genisliktedir (ticket'in onerdigi sadelik): form/detay ekranlari icin daha
  dar bir varyant uretilmedi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- **ux-designer-agent'a RAPOR (ticket'in "Kapsam DISI" bolumunun talebi):** `design.md` §3'teki
  7 ekran sartnamesinin hicbirinde masaustu yerlesim kurali yok (yalnizca "Mobil notu").
  Bu kosumda uygulanan kararlar kalici sartnameye islenmelidir: (a) `.page` kapsayici
  genisligi = `md` kirilma noktasi (768px), yatayda ortali; (b) `md`+ ekranda birincil
  butonlar tam genislikten cikar, min 192px; (c) ReportDetailPage'de "Fotograflar" ve
  "Paylasim" bolumleri Elevation 1 + `lg` yaricapli panel yuzeyidir. Ayrica token setine
  bir "container" adimi ve bir "buton min genisligi" adimi eklenmesi degerlendirilmelidir.
- `app.css` icinde caption tipografi adimi (`0.8125rem`) 4 ayri yerde tekrarlaniyor ve her
  seferinde ayni "token karsiligi yok" gerekcesi yaziliyor — token setinde tipografi olcegi
  adimlari degisken olarak uretilmiyor. Dokunulmadi, ayri bir kayit konusu.
- `.report-actions` bolumu (PDF Indir / hata toast'i) simdi iki panel yuzeyinin ARASINDA
  duz zeminde kaliyor. Ticket kriteri yalnizca "Fotograflar" ve "Paylasim" bolumlerini
  sayiyor, kapsam disi tutuldu.

## Test Kosum Ciktisi (ozet)

Kirmizi tur (CSS eklenmeden once, yalnizca yeni spec):

```
Tests: 17 failed, 9 passed, 26 total
```

Yesil tur (yeni spec):

```
PASS src/styles/app-layout.spec.ts
Tests: 26 passed, 26 total
```

Tum paket (repo koku — tools + apps/api + apps/web):

```
> jest --config jest.config.mjs && npm run test --workspaces --if-present
Test Suites: 10 passed, 10 total     (tools)
Test Suites: 56 passed, 56 total     (@tutanak/api)
Test Suites: 56 passed, 56 total     (@tutanak/web)  Tests: 434 passed, 434 total
```

Statik analiz:

```
> eslint . --max-warnings=0        -> temiz (0 uyari)
> tsc --noEmit (kok + api + web)   -> temiz
> prettier --check (degisen dosyalar) -> All matched files use Prettier code style!
```
