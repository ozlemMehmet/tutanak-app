# Devlog — T-026

> Uretici: dev-agent | Branch: ticket/T-026 | Tarih: 2026-08-16

Konu: `performance-report.md` P-01 (fotograf yukleme) ve P-02 (PDF uretimi) CRITICAL
bulgularinin kok nedeni — `architecture.md` §104'te KARARI VERILMIS ama yalnizca PDF yolunda
uygulanmis 1600 px kucultme — yukleme yolunda da uygulanir; libuv is-parcacigi havuzu
uretim imajinda acikca ayarlanir.

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Depoya yazilan fotografin uzun kenari ≤ 1600 px; kucuk gorsel BUYUTULMEZ | `photos/photo-image.processor.ts` → `normalizePhoto` icine `.resize({ width/height: PHOTO_MAX_EDGE_PX, fit: 'inside', withoutEnlargement: true })` | Birim: `photo-image.processor.spec.ts` (2400x3200 → 1200x1600, yatay 3200x2400 → 1600x1200, 320x240 buyutulmez, 1601 → 1600, tam 1600 degismez). E2E: `photos.e2e-spec.ts` "depoya yazilan fotografin uzun kenari 1600 px ile sinirlidir" — dogrulama YANIT alanlarindan degil DEPOLANAN BAYTLARDAN (`FakeStorage.read` + `sharp.metadata`) yapilir |
| 2. Sinir tek kaynaktan; iki ayri "1600" literali kalmaz | `PHOTO_MAX_EDGE_PX` yalnizca `photo-image.processor.ts`'te; `pdf-photo.processor.ts` onu import eder (`PDF_PHOTO_MAX_EDGE_PX` kaldirildi) | `tools/photo-pipeline-config.spec.ts` → "sinir degeri uygulama kaynaginda YALNIZCA bir kez tanimlanir" (tum `apps/api/src` taranir) + "PDF yolu sinirin kendi kopyasini tutmaz, yukleme yolundan alir" |
| 3. `GET /reports/{id}/photos` ve PDF icerigi bozulmaz; T-006/T-007/T-010 e2e'leri DEGISTIRILMEDEN gecer | Kod degisikligi yalnizca olcu; sira/damga/depolama anahtari/akis dokunulmadi | Mevcut e2e paketi degistirilmeden kosuldu: 13 suite / 200 test yesil (photos, pdf, public-report dahil). `photos.e2e-spec.ts`'e YALNIZCA yeni test EKLENDI, mevcut assert'ler degistirilmedi |
| 4. EXIF yonlendirmesi + meta veri temizleme korunur | `.rotate()` cagrisi korundu ve `.resize()` ONDAN SONRA zincirlendi (sinirlanan kenar kullanicinin gordugu kenardir) | Birim: "EXIF yonlendirmesi kucultmeden ONCE uygulanir" (orientation 6, 3000x1000 → 533x1600) + mevcut "gomulu meta veri ciktiya tasinmaz" testi (degistirilmedi) |
| 5. `UV_THREADPOOL_SIZE` uretim imajinda acikca ayarli; `docker exec ... printenv` bos donmez; deger koda gomulu degil | `apps/api/Dockerfile` → `ENV UV_THREADPOOL_SIZE=8` (gerekce yorumda) | `tools/photo-pipeline-config.spec.ts` (ENV var mi, pozitif tam sayi ve 4'ten buyuk mu, uygulama kaynagi bu degiskeni ATAMIYOR mu, ENV nihai asamada mi) + CANLI: `docker exec t026perf-api-1 printenv UV_THREADPOOL_SIZE` → `8` (asagida) |
| 6. Butceler hedef eszamanlilikta (c=30) tutar: yukleme p95 ≤ 1.500 ms, PDF p95 ≤ 3.000 ms, hata ≤ %1 | (yukaridaki iki degisikligin toplam etkisi) | Uretim imajlariyla A/B olcum — "Olcum" bolumu |
| 7. `test`, `test:e2e`, `lint`, `typecheck` temiz | — | "Test Kosum Ciktisi" |

## Alinan Kararlar ve Gerekceler

- **Kucultme `rotate()`'ten SONRA, `toFormat()`'tan ONCE.** EXIF donusu uygulanmadan
  sinirlanirsa dik cekilmis bir fotografta yanlis kenar sinirlanir (3000x1000 + orientation 6
  girdisinde sonuc 1600x533 degil 533x1600 olmalidir). Test bunu acikca kilitliyor.
- **`withoutEnlargement: true`.** Kriterin kendi sarti; ayrica buyutme ne kalite kazandirir ne
  de butceye katki saglar, yalnizca depolama ve PDF isini buyutur.
- **Sinir sabiti `modules/photos` altinda yasar, PDF yolu onu ithal eder** (ters yon degil).
  Gerekce: deger artik DEPOLANAN halin ozelligidir; PDF yolu depolanan halin uzerinde calisir.
  Bu, `pdf` → `photos` yonunde bir sabit bagimliligi uretir; alternatif (ortak bir `common/`
  sabiti) CLAUDE.md §1'deki "`common/*` capraz kesen konular" tanimina zorlama olurdu — 1600 px
  capraz kesen bir konu degil, goruntu hattinin ta kendisidir. Tek yonlu, davranissiz bir sabit
  ithalati bilincli olarak kabul edildi.
- **PDF yolundaki `resize` KALDIRILMADI** (ticket teknik notu): bicim donusumu/saydamlik
  duzlestirme orada zorunlu ve T-026 oncesi yuklenmis buyuk fotograflar depoda duruyor olabilir.
  Artik cogu fotograf icin etkisiz (`withoutEnlargement`), geriye kalan maliyet cozme+kodlama.
- **`UV_THREADPOOL_SIZE=8`, imaja (`ENV`) yazildi, koda degil.** Kriterin acik sarti. Deger
  gerekcesi Dockerfile yorumunda: uretim hedefi 2 vCPU (§5.1) oldugu icin daha buyuk bir sayi
  islem gucu getirmez; 8, CPU'yu bekleyen `sharp`/`bcrypt` isini varsayilan 4'luk kuyruktan
  cikarmaya yeterken ayni anda bellekte tutulan JPEG tamponu sayisini kontrol altinda tutar.
  `.env.example`'a EKLENMEDI: bu bir uygulama yapilandirmasi degil (kod `process.env` ile
  okumuyor), Node/libuv'un imaj seviyesindeki calisma parametresidir — CLAUDE.md §5.1 tablosu
  "kodda okunan" anahtarlari yonetir.
- **Yapilandirma testleri `tools/` altinda** (`photo-pipeline-config.spec.ts`): iki karar da
  birim/e2e ile yakalanamaz (biri Dockerfile'da, digeri "ikinci literal kalmasin" kurali);
  depoda ayni deseni kullanan `tools/*.spec.ts` dosyalari zaten var (`ci-workflow`,
  `rate-limit-config`, `docker-build-context`).
- **ENV testi yalnizca SON `FROM`'dan sonraki satirlari sayar.** Bugun dosya tek asamali oldugu
  icin fark etmiyor; ama derleme asamasina yazilan `ENV` nihai imaja tasinmaz ve `printenv` bos
  donerdi. Cok asamali imaj devreye girdiginde ayarin sessizce kaybolmamasi icin ayrim simdiden
  test ediliyor (fixture'li test bunu kanitiyla gosteriyor).

## Olcum (kriter 6) — yontem ve sayilar

**Yontem.** perf-agent'in deseniyle ayni: uretim imajlari (`docker compose -f
docker-compose.e2e.yml`, `apps/api/Dockerfile`), izole proje adi, repo DISI (/tmp) gecici
override ile yalnizca hiz sinirlayici yukseltildi (`RATE_LIMIT_MAX_REQUESTS`,
`AUTH_RATE_LIMIT_MAX_REQUESTS`) — olculen sey hiz sinirlayici degil arkasindaki kapasite.
Yuk kosucusu Python stdlib (`http.client` + `ThreadPoolExecutor`), 5 MB / 2400x3200 gercekci
gurultulu JPEG, hedef eszamanlilik **c=30**, n=60. Ayni fotograf, ayni kosucu, ayni makine.

**A/B kurulumu:** iki yigin ayni Dockerfile ile derlendi, biri T-026 ONCESI kaynaktan
(`t026base`), digeri BU branch'in kaynagindan (`t026perf`); **ayni anda calistirilmadi** (biri
olculurken digeri durduruldu) — yoksa CPU rekabeti sonuclari kirletirdi.

**Onemli metodoloji notu (onceki olcumden sapmanin nedeni):** yuk istemcisi Docker agi ICINDE
kosuldu (`docker run --network <proje>_default python:3.12-alpine`). Host port yonlendirmesi
uzerinden olcum, isleme maliyetini degil Docker Desktop'in ag katmanini olcuyor: kanit olarak
"sadece tasima" referans senaryosu (govde tam okunur, `sharp` HIC calismaz — 403 ile biten
yukleme) host portundan c=30'da p95 **1.071 ms** verdi. Bu yuzden asagidaki mutlak sayilar
`performance-report.md`'deki sayilardan dusuk; **karsilastirma ayni yontemle olculen
ONCE/SONRA arasindadir**, rapor sayilariyla degil.

| Senaryo (c=30, n=60) | ONCE (T-026 oncesi imaj) | SONRA (bu branch) | Butce | Durum |
|---|---|---|---|---|
| Fotograf yukleme p95 | **1.566 ms** (p50 1.038, max 1.627, err %0) | **923 / 779 ms** (p50 608/631, max 961/849) | ≤1.500 ms | ASIYOR → **ICINDE** (~%40-50 iyilesme) |
| PDF uretimi (10 foto) p95 | **7.427 ms** (p50 6.800, max 7.595, err %0) | **2.725 / 2.726 ms** (p50 2.068/2.138, max 2.901/2.893) | ≤3.000 ms | ASIYOR (2,5x) → **ICINDE** (~%63 iyilesme) |
| Hata orani | %0 | **%0** (her iki kosumda, zaman asimi yok) | ≤%1 | ICINDE |

Ham cikti (SONRA, iki ardisik kosum):
```
FOTOGRAF YUKLEME: c=30 n=60 p50=608 p95=923 p99=932 max=961 err=0.00% butce=1500 -> ICINDE
PDF URETIMI (10 foto): c=30 n=60 p50=2068 p95=2725 p99=2860 max=2901 err=0.00% butce=3000 -> ICINDE
FOTOGRAF YUKLEME: c=30 n=60 p50=631 p95=779 p99=805 max=849 err=0.00% butce=1500 -> ICINDE
PDF URETIMI (10 foto): c=30 n=60 p50=2138 p95=2726 p99=2862 max=2893 err=0.00% butce=3000 -> ICINDE
```
ONCE (ayni yontem, T-026 oncesi imaj):
```
FOTOGRAF YUKLEME: c=30 n=60 p50=1038 p95=1566 p99=1603 max=1627 err=0.00% butce=1500 -> ASIYOR
PDF URETIMI (10 foto): c=30 n=60 p50=6800 p95=7427 p99=7499 max=7595 err=0.00% butce=3000 -> ASIYOR
```

Depolanan hacim (ayni 4,65 MB / 2400x3200 girdi, `sharp` ile dogrudan olculdu):
`ONCE 2400x3200 = 4,37 MB` → `SONRA 1200x1600 = 0,75 MB` (**~5,8 kat** kucuk; PDF yolu her
istekte bu kadar az bayt cozuyor — P-02'nin dolayli kazanci buradan geliyor).

Kriter 5 canli dogrulama:
```
$ docker exec t026perf-api-1 printenv UV_THREADPOOL_SIZE
8
$ docker exec t026base-api-1 printenv UV_THREADPOOL_SIZE   # T-026 oncesi imaj
(bos, exit=1)
```

## Varsayimlar

- Olcum makinesi (10 cekirdek) uretim hedefinden (2 vCPU) guclu; **oransal** iyilesme
  (yukleme ~%40-50, PDF ~%63, depolanan bayt ~5,8x) donanimdan buyuk olcude bagimsizdir, ama
  mutlak p95 degerlerinin uretimde de butce icinde kalacagi bu ortamda KANITLANAMAZ.
- `PHOTO_MAX_EDGE_PX` bir dagitim parametresi degil goruntu hatti sabiti kabul edildi
  (env'den gelmez) — architecture.md §104 degeri sabit veriyor.
- Yukleme yanitindaki `widthPx`/`heightPx` artik kucultulmus olculeri yansitir; sozlesme
  (`api-contract.yaml`) bu alanlara sayi disinda bir sart koymuyor ve mevcut e2e assert'lerinin
  hicbiri orijinal olculere bagli degildi (paket degistirilmeden yesil).

## Anayasa (CLAUDE.md) Bosluklari

- **Iki modulun ayni sabiti paylasmasi icin desen yok.** §7 Desen Sozlugu bu problem sinifini
  tanimlamiyor, §7.1 gereksiz soyutlamayi yasakliyor. Icat etmedim: en duz cozum (sahibi olan
  modulden dogrudan `import`) secildi. Sozluk adayi: "**Tek-kaynak sabiti**: degeri, anlamina
  sahip olan modulde tanimla; diger tuketiciler ithal eder, kopya literal birakma."
- **Runtime/imaj parametreleri (`UV_THREADPOOL_SIZE`, `NODE_OPTIONS` vb.) §5.1 tablosunun
  kapsaminda degil.** §5.1 "kodda okunan" env anahtarlarini yonetiyor; bu degeri kod hic
  okumuyor, Node'un kendisi okuyor. Secim: `.env.example`'a eklenmedi, imajda durur, gerekcesi
  Dockerfile yorumunda. Aday kural: "kodun okumadigi calisma-zamani parametreleri imaj/compose'da
  tanimlanir, `.env.example` kapsaminda degildir."

## Bilinen Sinirlamalar

- **PDF butcesinin payi dar (~%9).** Olculen p95 2.725/2.726 ms, butce 3.000 ms. Ayni kurulumda
  daha erken (makine baska islerle mesgulken) alinan bir kosumda p95 **3.276 ms** gorulmustu;
  yani sonuc makinenin o anki yukune duyarli. Uretimde (2 vCPU) bu payin korunacagi bu ortamda
  KANITLANAMAZ — perf raporundaki (d) secenegi (VPS boyutu) ticket kapsami disi ve bu risk
  hala acik.
- **Depodaki ESKI fotograflar buyuk kalir.** Geriye donuk yeniden isleme (backfill) YOK; T-026
  oncesi yuklenmis fotograflari iceren tutanaklarin PDF'i eski maliyetle uretilir. Kapsam disi
  birakildi (ticket istemiyor, veri donusumu ayri bir karar).
- **Kucultme kayipsiz degildir:** 2400x3200 girdi artik 1200x1600 olarak saklanir; orijinal
  cozunurluk hicbir yerde tutulmaz. Bu architecture.md §104'un bilincli karari, ancak
  "orijinali sakla" ihtiyaci ileride dogarsa karar yeniden acilmalidir.
- Olcum kosucusu ve gecici compose override repoya YAZILMADI (perf-agent deseni; `/tmp` altinda).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- **`apps/api/Dockerfile` depodaki haliyle hala T-001 iskeleti**: tek asamali, `CMD npm run
  start:dev`, `NODE_ENV=production` YOK, `HEALTHCHECK` yok. Buna karsilik `docker-compose.e2e.yml`
  yorumu "Dockerfile'daki varsayilan (son) asama `runtime`" diyor ve
  `factory/10-release/performance-report.md` olcumu "runtime hedefi" ile yaptigini yaziyor —
  yani devops'un cok asamali uretim Dockerfile'i **workspace'te untracked duruyor, depoda yok**
  (T-024 devlog'u bunu zaten tespit etmis). T-026'nin `ENV` satiri depodaki (gercekten derlenen)
  dosyaya yazildi ve canli dogrulandi; ancak o untracked dosya bir gun depoya girerse `ENV`'in
  **nihai asamada** olmasi gerekir — bu yuzden `tools/photo-pipeline-config.spec.ts` ENV'i
  yalnizca son asamada kabul ediyor. Dosyanin kendisine DOKUNULMADI (devops/documentation isi).
- `performance-report.md`'nin P-03 (login p95, 2x yukte) ve liste uclarindaki MEDIUM bulgulari
  bu ticket kapsaminda degil; olcumde de dokunulmadi.

## Test Kosum Ciktisi (ozet)

```
$ npm run lint                     -> exit 0 (0 uyari)
$ npm run typecheck                -> exit 0
$ npm run format:check             -> All matched files use Prettier code style!
$ npm run test                     -> exit 0
    kok (tools/):        9 suite /  56 test
    apps/api:           56 suite / 377 test
    apps/web:           53 suite / 390 test
$ DATABASE_URL=postgresql://tutanak:tutanak@localhost:5432/tutanak npm run test:e2e
                                   -> exit 0 | 13 suite / 200 test (CI paritesi: yalnizca DATABASE_URL disaridan)
```

Kirmizi-yesil kaniti (testler gercekten kriteri olcuyor mu):
```
# `.resize(...)` gecici olarak kaldirildiginda (sonra geri alindi):
✕ uzun kenari sinirdan buyuk goruntuyu sinira indirir (T-026: depolanan hal kucuktur)
✕ genis (yatay) goruntude de sinirlanan kenar UZUN kenardir
✕ sinirin tam ustundeki goruntuyu sinira indirir (sinir degeri dahil edilir)
✕ EXIF yonlendirmesi kucultmeden ONCE uygulanir (dondurulmus olculer sinirlanir)

# Dockerfile'daki `ENV UV_THREADPOOL_SIZE=8` gecici olarak silindiginde (sonra geri alindi):
✕ UV_THREADPOOL_SIZE imajda ENV olarak tanimlidir (printenv bos donmez)
✕ deger pozitif tam sayidir ve Node varsayilanindan buyuktur
```
