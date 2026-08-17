# Devlog — T-028

> Uretici: dev-agent | Branch: ticket/T-028 | Tarih: 2026-08-17

Konu: `performance-report.md` (3. tur) P-01 (CRITICAL, GATE3'u bloklar) — fotograf yukleme
p95 butcesi hedef eszamanlilikta (c=30) hicbir kosumda tutmuyor. Raporun BIRINCI onerisi
uygulanir: 1600 px kucultme **istemciye** (PWA) tasinir; sunucu tarafi kucultme KALDIRILMAZ.

## Kriter -> Plan Eslemesi (kod yazmadan ONCE dolduruldu)

| # | Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|---|
| 1 | Istek yapilmadan ONCE tarayicida uzun kenar ≤ 1600 px; kucuk gorsel BUYUTULMEZ | YENI `apps/web/src/features/photos/downscale-photo.ts` → `downscalePhotoForUpload(file)`; `usePhotos.ts` → `useUploadPhoto` mutation'i `uploadPhoto`'yu **kucultulmus dosya** ile cagirir | `downscale-photo.spec.ts`: 2400x3200 → 1200x1600, yatay 3200x2400 → 1600x1200, 800x600 ve tam 1600 girdi DEGISMEDEN doner (ayni `File` nesnesi). `usePhotos.spec.tsx`: istege giden `FormData.file` kucultulmus dosyadir |
| 2 | Govde gercekten kuculur; boyutlar ≤ 1600 px (testte olculur) | ayni | `downscale-photo.spec.ts` "govde belirgin sekilde kuculur": 5 MB / 2400x3200 girdi → cizilen tuval 1200x1600, donen `File.size` orijinalin altinda. **Gercek tarayici kaniti**: headless Chrome kosumu (asagida "Gercek Tarayici Dogrulamasi") |
| 3 | EXIF yonlendirmesi gorsel iceriginde DOGRU uygulanir | `createImageBitmap(file, { imageOrientation: 'from-image' })` + tuvale cizim (cikti EXIF tasimaz, pikseller zaten dondurulmustur → sunucudaki `.rotate()` no-op olur, davranis bozulmaz) | `downscale-photo.spec.ts`: secenegin gecildigi + **yonu uygulamayan tarayicida orijinalin gonderildigi** (yoklama testi). Gercek Chrome'da piksel dogrulamasi (dik cekilmis 2400x3200 EXIF=6 fotograf → 1200x1600 ve sol-ust renk dogru) |
| 4 | Sunucu sozlesmesi degismez (yalnizca jpeg/png/webp; `FILE_TOO_LARGE`/`UNSUPPORTED_MEDIA_FORMAT` yollari; mevcut T-006/T-020 testleri DEGISTIRILMEDEN gecer) | Cikti bicimi girdi bicimiyle ayni (`canvas.toBlob(cb, file.type)`); jpeg/png/webp disindaki tur DOKUNULMADAN gonderilir; `photos.api.ts` govdesi degismez (yalnizca `file`) | Mevcut `apps/api` birim + e2e paketi **degistirilmeden** kosulur; `downscale-photo.spec.ts` "desteklenmeyen bicime dokunmaz" + "cikti bicimi girdiyle ayni" |
| 5 | API yoksa / kucultme HERHANGI bir nedenle basarisiz olursa orijinal yuklenir, kullaniciya hata gosterilmez | `downscalePhotoForUpload` tum yolu `try/catch` icinde; `createImageBitmap` yok, desteklenmeyen bicim, EXIF yonunu uygulamayan tarayici, cozme hatasi, `getContext` null, `toBlob` null → hepsi orijinal `File` doner | `downscale-photo.spec.ts` 5 dusme yolu testi + yon yoklamasi testi + `usePhotos.spec.tsx` "kucultme patlarsa yukleme yine basarili olur" |
| 6 | Sunucu tarafi kucultme KALDIRILMAZ (`normalizePhoto` 1600 px'i uygulamaya devam eder) | `apps/api` DEGISTIRILMEZ (bu ticket'ta tek satir bile) | Mevcut `photo-image.processor.spec.ts` + `photos.e2e-spec.ts` "depoya yazilan fotografin uzun kenari 1600 px ile sinirlidir" testleri degistirilmeden yesil; `git diff --stat` `apps/api` altinda 0 dosya |
| 7 | Olcum tekrarlandiginda p95 ≤ 1.500 ms ve hata ≤ %1 (c=30); yontem + sayilar devlog'da | (istemci kucultmesinin sonucu: sunucuya giden govde 5,83 MB yerine 1,19 MB) | Uretim imajlariyla A/B olcum — "Olcum (kriter 7)" bolumu |
| 8 | `npm run test`, `npm run test:e2e`, `lint`, `typecheck` temiz | — | "Test Kosum Ciktisi" |

## Alinan Kararlar ve Gerekceler

- **Kucultme `useUploadPhoto` (hook) katmaninda yapilir** — ticket'in acikca gerekce istedigi
  secim. `photos.api.ts` sozlesme esleme katmanidir (govdeye YALNIZCA `file` konur, §3.7);
  goruntu isleme oraya ait degildir. `PhotoCaptureInput` ise yalnizca kareyi ust bilesene veren
  bir giris bileseni: donusum orada yapilsaydi, ileride ikinci bir yukleme tetikleyicisi
  (or. galeriden coklu secim) eklendiginde kucultme sessizce atlanirdi. Mutation'in kendisi
  "yukleme isi"nin sahibidir; istegi kuran kod ile kucultme ayni yerde durur.
- **Yeni modul `downscale-photo.ts`, `features/photos/` altinda saf fonksiyon.** `lib/` degil:
  fotograf hattina ozgudur, genel amacli bir yardimci degildir (CLAUDE.md §1 — ozellik bazli
  gruplama). Desen SOZLUGUNDEN bir sey kullanilmadi; problem bir saf donusum, arayuz/port/
  strategy gerektirmiyor (§7.1 "desen susu" yasagi).
- **Olcut PIKSEL, bayt DEGIL.** Ilk uygulamada "kucultulmus govde orijinalden buyukse orijinali
  gonder" korumasi vardi. Gercek tarayici dogrulamasi bunun 2400x3200 bir PNG'yi kucultmeden
  gecirdigini gosterdi (duz renkli PNG'de tuval ciktisi daha cok bayt tutuyor) — bu, kriter 1'i
  ("uzun kenar en fazla 1600 px") kosullu hale getiriyordu. Koruma KALDIRILDI: sunucudaki
  `sharp` maliyeti dosya boyutuyla degil COZULEN PIKSEL sayisiyla buyur (P-01'in kok nedeni
  "islem gucu yetersiz"), dolayisiyla 1600 px hali birkac KB daha buyuk olsa bile gonderilmesi
  DOGRU davranistir. Yerine "bayt buyuse bile 1600 px hali gonderilir" testi kondu.
- **EXIF yon YOKLAMASI (304 baytlik gomulu JPEG).** `createImageBitmap`'in
  `imageOrientation: 'from-image'` secenegini YOK SAYAN bir tarayicida tuvale cizilen kare
  dondurulmemis olur ve cikti EXIF tasimadigi icin sunucudaki `.rotate()` de duzeltemez —
  dik cekilmis fotograf galeride ve PDF'te sessizce yan yatardi (kriter 3'un tam olarak
  yasakladigi sey). Yoklama bunu tespit edip kucultmeden vazgecer (kriter 5'in dusme yolu).
  Sonuc onbelleklenmedi: yoklama 304 bayttir, hemen ardindan gelen ~5,8 MB'lik cozmenin
  yaninda olculemez (gercek tarayicida toplam kucultme suresi 74 ms).
- **Cikti bicimi girdiyle ayni, kalite parametresi VERILMEDI** (tarayici varsayilani). Bicim
  esleme mantigi (`SHARP_FORMAT_BY_CONTENT_TYPE`) ve sunucu dogrulamalari degismeden calisir;
  sikistirma orani bir urun karari (ticket kapsam disi).
- **Sunucu tarafi kucultme KALDIRILMADI, `apps/api` altinda TEK SATIR degismedi** (kriter 6).
  Istemciye guvenilmez: `normalizePhoto` 1600 px'i, sihirli bayt dogrulamasini ve boyut
  sinirini uygulamaya devam ediyor. Kanit: `git diff --stat main` yalnizca `apps/web` +
  devlog gosteriyor; mevcut 13 e2e suite / 200 test DEGISTIRILMEDEN yesil.
- **1600 sabiti `apps/web` tarafinda yansitildi** (`PHOTO_UPLOAD_MAX_EDGE_PX`). Tarayici kodu
  sunucu modulunu ithal edemez (ayri dagitim birimi); depoda ayni durumun kurulu kalibi
  `photo-limits.ts` → `PHOTO_MAX_PER_REPORT = 30`'dur ve o kalip birebir izlendi (yorumda
  dogruluk kaynagi sunucu olarak isaretlendi). `tools/photo-pipeline-config.spec.ts`'in
  "tek tanim" kurali `apps/api/src` icin gecerlidir ve ihlal edilmedi.

## Gercek Tarayici Dogrulamasi (kriter 1-3, jsdom'un olcemedigi sey)

Birim testleri tarayicinin goruntu API'sini TAKLIT eder (jsdom `createImageBitmap`/canvas
saglamaz); bu yuzden kriterler ayrica GERCEK Chrome'da olculdu. Kosum: headless Chrome 151
(CDP uzerinden), repo DISI harness (`/tmp/t028browser`), modulun kendisi esbuild ile paketlendi.
Fixture: `sharp` ile uretilmis 2400x3200 gurultulu JPEG + **EXIF Orientation=6** (dik cekim),
koseleri ayirt edici renk bloklari tasiyor.

| Girdi | Sonuc | Beklenen | Durum |
|---|---|---|---|
| 2400x3200, EXIF=6, **5.825.569 B** | **1.192.733 B**, 1600x1200, 74 ms | ≤1600 px, belirgin kucuk | OK (4,9x kucuk) |
| 800x600 JPEG | AYNI `File` nesnesi, 800x600 | buyutulmez, dokunulmaz | OK |
| 2400x3200 PNG | 1200x1600, `image/png` | bicim korunur, kucultulur | OK |

**EXIF dogrulugu (kriter 3):** istemci ciktisinin kose renkleri, sunucunun ayni girdi icin
uretecegi referansla (`sharp().rotate().resize(1600 inside)`) BIREBIR ayni:
`tl=[0,0,254] tr=[254,0,0] bl=[255,255,0] br=[0,255,1]` ve olcu 1600x1200. Yon uygulanmasaydi
sonuc 1200x1600 ve `tl=[254,0,0]` olurdu — test bu iki durumu ayirt ediyor.

**Uctan uca (canli yigin):** ayni tutanaga hem istemci ciktisi hem 5,8 MB orijinal yuklendi;
depoya yazilan iki nesne de **1600x1200, EXIF yok** ve kose renkleri ayni
(`711.964 B` vs `720.031 B`). Yani istemci kucultmesi, sunucunun urettigi gorsel sonucu
DEGISTIRMIYOR — galeri ve PDF ayni kareyi gosterir.

## Olcum (kriter 7) — yontem ve sayilar

**Yontem.** `performance-report.md` (3. tur) ile AYNI desen: uretim imajlari
(`docker compose -f docker-compose.e2e.yml`, `apps/api` Dockerfile `runtime` hedefi + Caddy),
izole proje adi (`-p t028perf`), yuk istemcisi **HOST PORTU** uzerinden (Docker agi icinden
DEGIL — T-026 devlog'unun karsilastirilamaz sayilar uretme hatasi tekrarlanmadi), Python
stdlib + `ThreadPoolExecutor`, hedef eszamanlilik **c=30, n=60**, **8 BAGIMSIZ kosum**
(toplam 480 istek), butce ≤1.500 ms / hata ≤%1. Hiz sinirlayici repo DISI (/tmp) bir override
ile yukseltildi; repodaki hicbir dosyaya dokunulmadi. Is bitince `down -v` ile temizlendi.
Makine: 10 vCPU macOS/Docker Desktop (uretim hedefi 2 vCPU'dan GUCLU — bkz. Bilinen Sinirlamalar).

**A/B'nin ne oldugu:** kod degisikligi istemcide oldugu icin sunucu imaji IKI KOSUMDA DA
AYNIDIR; degisen sey **sunucuya giden govdedir**. "ONCE" = bugunku davranis (tarayici 5,8 MB
orijinali gonderir). "SONRA" = T-028 sonrasi davranis; gonderilen bayt dizisi **gercek Chrome
ciktisidir** (yukaridaki harness'tan alinan 1.192.733 baytlik 1600x1200 JPEG), sentetik degil.

| Senaryo (c=30, n=60, 8 kosum) | p50 | p95 (8 kosum) | Hata % | Butce | Durum |
|---|---|---|---|---|---|
| **ONCE** — istemci kucultmesi YOK (5,83 MB) | 703–1.162 | **1.719 / 1.924 / 1.962 / 1.983 / 1.997 / 2.597 / 3.383 / 30.147** | agregatif **%1,67** | ≤1.500 ms | **8/8 ASIYOR** |
| **SONRA** — istemci kucultmesi VAR (1,19 MB) | 324–412 | **560 / 580 / 632 / 634 / 652 / 666 / 666 / 687** | **%0** (480 istek) | ≤1.500 ms | **8/8 ICINDE** |

`ONCE` kolonu, `performance-report.md`'nin P-01 bulgusunu bagimsiz olarak YENIDEN URETIYOR
(rapor: p95 1.710–35.364 ms, agregatif hata %1,67 — burada 1.719–30.147 ms, hata %1,67).
Bu, olcum yonteminin raporunkiyle gercekten ayni oldugunun kanitidir; `SONRA` sayilari bu
yuzden raporla dogrudan karsilastirilabilir.

Ek bilgi (kriter degil): **2x yuk (c=60, n=80)** SONRA durumunda p95 **1.292 / 1.117 ms**,
hata %0 — yani hedefin iki katinda bile butce iciyiz (raporda ONCE bu noktada 3.817 ms idi).

Ham cikti:
```
ONCE  kosum 1-8: p95=1924 / 3383 / 1962 / 30147 / 2597 / 1719 / 1983 / 1997  err=0/0/0/13.33/0/0/0/0 %
OZET  ONCE : p95 araligi 1719-30147 ms | agregatif hata 1.67% | butce icindeki kosum 0/8
SONRA kosum 1-8: p95=652 / 666 / 560 / 632 / 666 / 580 / 634 / 687          err=0 % (tumu)
OZET  SONRA: p95 araligi 560-687 ms | agregatif hata 0.0% | butce icindeki kosum 8/8
SONRA 2x (c=60, n=80): p95=1292 / 1117  err=0.00%
```

## Varsayimlar

- Yuk istemcisi tarayici DEGILDIR: istemcide kucultme yapildigini, gercek Chrome ciktisinin
  bayt dizisini govde olarak gondererek modelledim. Kucultmenin CIHAZDA harcadigi sure
  (Chrome'da olculdu: **74 ms**, 5,8 MB girdi icin) sunucu p95 butcesine dahil degildir —
  mimari §6 butceleri "sunucu p95" olarak tanimli. Kullanicinin toplam bekleme suresi acisindan
  bu 74 ms, 4,6 MB daha az veri yuklemenin kazancinin yaninda ihmal edilebilir.
- Kucultmenin dogru calistigi tarayici ailesi Chromium ile dogrulandi; Safari/Firefox'ta
  `imageOrientation` destegi yoklama ile RUNTIME'da kontrol ediliyor, desteklenmiyorsa
  orijinal gonderiliyor (akis kirilmaz, sunucu yine 1600 px'e indirir).
- Depodaki ESKI (T-026 oncesi) buyuk fotograflar icin geriye donuk isleme yok — T-026'nin
  varsayimi korundu.

## Anayasa (CLAUDE.md) Bosluklari

- **Sunucu ile istemci arasinda paylasilan sabitler icin kural yok.** §5.1 env tablosu ve
  T-026'nin "tek kaynak" dersi yalnizca `apps/api` icini yonetiyor; `PHOTO_MAX_PER_REPORT`
  zaten `apps/web`'de elle yansitilmis durumda. Icat etmedim, o kalibi izledim. Sozluk adayi:
  "**Yansitilan sozlesme sabiti**: sunucu dogruluk kaynagidir; istemci kopyasi yorumda kaynagi
  isaret eder ve sunucu kurali ISTEMCIYE GUVENMEDEN uygulamaya devam eder."
- **Tarayici yetenek yoklamasi (capability probe) icin desen yok.** §7 sozlugunde karsiligi
  yok; en duz cozumle (saf fonksiyon + 304 baytlik gomulu fixture) yazildi.
- **jsdom'un saglamadigi tarayici API'lari icin test kurali yok.** §8 birim/e2e ayrimi bu
  durumu tanimlamiyor (Playwright deposunda kurulu degil). Secim: birim testte tarayici
  hatti taklit edildi + kriterler GERCEK Chrome'da ayrica dogrulanip devlog'a kanit olarak
  yazildi. Aday kural: "tarayici-motoruna bagli davranis birim testte taklit edilir, kabul
  kaniti gercek tarayicida uretilir ve devlog'da raporlanir".

## Bilinen Sinirlamalar

- **Olcum 10 cekirdekli makinede yapildi; uretim hedefi 2 vCPU.** Oransal kazanc (govde 4,9x
  kucuk, p95 ~%65-70 dusuk, kuyruklanma/zaman asimi kayboldu) donanimdan buyuk olcude
  bagimsizdir, ama mutlak p95'in uretimde de butce icinde kalacagi BU ORTAMDA kanitlanamaz —
  perf-agent'in kendi raporundaki ayni sinirlama gecerli.
- **Kucultme kayiplidir ve artik iki kez kodlama var** (istemcide bir kez, sunucuda bir kez).
  Depolanan dosya bu yuzden orijinal yola gore ~%1 daha kucuk (711.964 vs 720.031 bayt) ve
  bir nesil daha fazla JPEG kaybi tasiyor. Gorsel karsilastirmada fark kose renklerinde
  ±1/255 seviyesinde kaldi; kabul edildi (alternatifi sunucu kucultmesini kaldirmakti —
  kriter 6 bunu YASAKLIYOR).
- **`imageOrientation` yoklamasi her yuklemede bir kez daha `createImageBitmap` cagirir.**
  Olculen maliyeti ihmal edilebilir (toplam 74 ms icinde), ama teknik olarak fazladan bir
  cozme islemidir; onbellek bilincli olarak eklenmedi (durum tutmamak icin).
- E2E kapsaminda gercek tarayici testi (Playwright) YOK — depoda kurulu degil, kurmak ticket
  kapsami disi. Kanit devlog'daki Chrome kosumudur; tekrar uretmek icin harness adimlari
  yukarida.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- **Jest, `File`/`Blob` iceren bir assert KIRILDIGINDA cokuyor** (Node 22 + jsdom;
  `deepCyclicCopyReplaceable` icinde native assertion). Bu, testin kirmizi ciktisini
  OKUNAMAZ hale getiriyor. Kendi testlerimde dosyalari dogrudan assert'e vermeyip
  serilestirilebilir ozet kullanarak cozdum; deponun BASKA yerlerinde ayni tuzak varsa
  dokunmadim (or. ileride biri `expect(file).toBe(...)` yazarsa ayni sekilde cokecek).
- `apps/api/Dockerfile` hala tek asamali T-001 iskeleti (T-026 devlog'unun notu gecerli).
- P-02 (PDF, HIGH), P-03/P-04/P-05 bulgulari bu ticket kapsaminda degil; olcumde de
  dokunulmadi.

## Test Kosum Ciktisi (ozet)

```
$ npm run lint                     -> exit 0 (0 uyari)
$ npm run typecheck                -> exit 0
$ npm run format:check             -> All matched files use Prettier code style!
$ npm run build                    -> exit 0 (web bundle 312,63 kB / gzip 97,30 kB — butce ≤250 kB gz)
$ npm run test                     -> exit 0
    kok (tools/):        10 suite /  68 test
    apps/api:            56 suite / 377 test
    apps/web:            55 suite / 408 test  (yeni: downscale-photo 17, usePhotos 2)
$ DATABASE_URL=postgresql://tutanak:tutanak@localhost:5433/tutanak npm run test:e2e
                                   -> exit 0 | 13 suite / 200 test (DEGISTIRILMEDEN, CI paritesi)
```

Kirmizi-yesil kaniti (testler kriteri gercekten olcuyor mu — her mutasyon sonra geri alindi):
```
# scale = 1 (kucultme devre disi):                          -> 5 test kirmizi
  ✕ uzun kenari sinirdan buyuk fotografi 1600 px e indirir (dik fotograf)
  ✕ yatay fotografta da sinirlanan kenar UZUN kenardir
  ✕ gonderilen govde belirgin sekilde kuculur (2400x3200 / ~5 MB girdi)
  ✕ cikti bicimi girdi bicimiyle AYNI kalir (png -> png)
  ✕ useUploadPhoto > istek yapilmadan ONCE fotografi kucultur, sunucuya kucuk govde gider
# `imageOrientation` secenegi + yon yoklamasi kaldirildi:    -> 3 test kirmizi
# `scale >= 1` (buyutme yasagi) kaldirildi:                  -> 2 test kirmizi
# catch icinde orijinale dusme yerine hata firlatildi:       -> 2 test kirmizi
```
