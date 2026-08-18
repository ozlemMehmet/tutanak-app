# Performans Raporu

> Uretici: perf-agent | Branch: main | Tarih: 2026-08-18 | Kaynak: `main` @ `5f86403`
> **Bu rapor bir YENIDEN DENETIMDIR (7. tur).** Onceki `performance-report.md` (6. tur, 2026-08-17,
> `374cce9` @ T-028) **SONUC: FINDINGS** idi — CRITICAL bulgu YOKTU (P-01 T-028 ile kapanmisti,
> bagimsiz dogrulanmisti), 2 HIGH (P-02 PDF, P-03 auth login 2x) + 1 MEDIUM (P-04 liste/arama
> 41k-olcek) + 1 LOW (P-05 paylasim linki) acikti, hicbiri GATE3'u bloklamiyordu. `374cce9..HEAD`
> arasinda 6 commit var (H-001, H-002, H-003, H-004, `fix(deps)`, `chore(release)`); bunlarin en
> performans-ilgili olani **H-001** (`apps/api/src/modules/pdf/report-pdf.builder.ts`): PDF'e artik
> **gomulu Unicode TTF fontlar** (DejaVuSans + Bold, ~1,46 MB toplam) yuklenip her belgeye
> `registerFont` ile gomuluyor — onceki 6 tur PDFKit'in standart 14 fontunu (gomme yok)
> kullaniyordu. Bu, P-02'nin (PDF, HIGH) kok nedenini DEGISTIREBILECEK tek kod degisikligi
> oldugu icin bu tur PDF akisi SIFIRDAN, tam yontemle yeniden olculdu. H-002/H-003/H-004 ve
> diger 4 dosya (`photos.service.ts`, `reports.service.ts`, `billing.service.ts`,
> `share-link.service.ts`, `rate-limit.factory.ts` vb.) `git diff 374cce9 HEAD` ile tek tek
> okundu — **tumu yalnizca Turkce karakter (ş/ğ/ı/İ/ö/ü) mesaj duzeltmesi**, hicbir kontrol
> akisi/sorgu/algoritma degismedi; bu yollar dusuk riskli kabul edilip regresyon-duman-testiyle
> (tek-kosum degil, hedef eszamanilikta tam kosum) yeniden dogrulandi, DERINLEMESINE yeniden
> denetlenmedi.
> Olcum ortami: Yerel makine (10 vCPU host, Docker Desktop, macOS), **uretim imajlari**
> (`docker compose -f docker-compose.e2e.yml`, `apps/api` Dockerfile `runtime` hedefi + `apps/web`
> Caddy imaji), izole proje adi (`-p perfaudit3`), is bitince `down -v` ile tamamen temizlendi
> (dogrulandi: `docker ps -a` sonrasinda perfaudit3 konteynerleri yok, `git status` oturum
> basi/sonu AYNI — Write araci bu rol icin depo/host disina da KAPALI, tum betikler Bash
> heredoc ile `/tmp/perfaudit3/` altina yazildi, repoya SIFIR dosya eklendi).
> **Bu makine (10 cekirdek) uretim hedefinden (Hetzner CX22, 2 vCPU) COK daha guclu** — asagidaki
> mutlak sayilar bu farki barindirmiyor, bulgularin ciddiyetini AZALTMAZ; bulgular butce-orani ve
> kirilma DESENI uzerinden okunmalidir.
> Yuk araci: Python stdlib (`urllib.request` + `ThreadPoolExecutor`), onceki turlarla AYNI desen.
> **Metodoloji notu (dogrulukla ilgili):** bu turun ilk betiginde yuzdelik-dilim (percentile)
> hesabinda bir enterpolasyon hatasi bulundu ve DUZELTILDI (kod `/tmp` altinda, dogrulama:
> duzeltme sonrasi min≤p50≤p95≤p99≤max tutarliligi tum tablolarda saglandi); asagidaki TUM
> sayilar duzeltilmis hesapla alinmistir, hatali ilk cikti hicbir yerde kullanilmadi.
> Fotograf fixture'lari: Pillow+numpy ile 2400x3200 yuksek-entropili JPEG (~6,87 MB, "ONCE/buyuk"
> — istemci kucultmesi yokmus gibi), `thumbnail((1600,1600))` kucultulmus hali (~1,16 MB,
> "SONRA/kucuk" — T-028 sonrasi tarayicinin GERCEKTE gonderdigi govde). Hiz siniri repo DISI bir
> override compose dosyasiyla (`-f`, `/tmp` altinda) gecici yukseltildi
> (`RATE_LIMIT_MAX_REQUESTS`/`AUTH_RATE_LIMIT_MAX_REQUESTS` → 100000, `PHOTO_MAX_PER_REPORT` →
> 2000); repodaki hicbir dosyaya dokunulmadi, `docker exec ... printenv` ile canli dogrulandi.
> Veritabani, mimarinin §6 varsaydigi ilk-yil olcegine (~40.000 tutanak satiri) `generate_series`
> ile SQL'den DOGRUDAN dolduruldu (API disindan, hizli) — bu, onceki turlerin "41k-olcek" EXPLAIN
> kanitiyla AYNI buyuklukte, tazeledi.
> Butce kaynagi: `factory/04-architecture/architecture.md` §6 "Performans Butceleri" (o bolumde
> "perf-agent'in release olcutu" diye acikca isaretli). Varsayilan butceye DUSULMEDI.

## SONUC: FINDINGS

**CRITICAL bulgu YOK — GATE3 bloklanmiyor.** P-01 (fotograf yukleme) kapali kaldigi bagimsiz
olarak yeniden dogrulandi (hedef eszamanilikta p95 583 ms, butcenin **%39'u**; 2x'te 778 ms,
**%52'si**; hata **%0**). **P-02 (PDF, HIGH) devam ediyor** — H-001'in gomulu font degisikligi
sonrasinda bile hedef eszamanilikta (c=30) p95 **3.144-3.414 ms** (butcenin **%5-14 uzeri**),
hata YOK; onceki turun asim orani (%19-53) ile ayni buyukluk mertebesinde, kucuk iyilesme
gozlemlendi ama YETERSIZ, hala butce disi. 2x'te (c=60) p95 **6.542 ms** (butcenin **~2,18
kati**) — zarif yavaslama (hata yok) ama ciddi kuyruklanma. **P-03 (auth login, HIGH)** hedef
eszamanilikta rahat icinde (p95 272 ms/400 ms), 2x'te hafif asiyor (441 ms, **~%10 uzeri**) —
marj onceki turdan (431 ms) hemen hemen ayni, iyilesme/kotulesme YOK, sinirda kaldi. **P-04
(liste/arama, MEDIUM — genisletildi)** 41k-olcekte SIFIRDAN yuk-altinda olculdu (onceki tur
yalnizca EXPLAIN'e dayaniyordu, yuk testi yapilmamisti): nadir/eslesmeyen arama teriminde
sunucu Postgres GIN trigram indekslerini KULLANMIYOR, sahibin 40k satirinin TAMAMINI tarayan bir
Seq Scan'e dusuyor; hedef eszamanilikta bu senaryoda p95 **411 ms** (butcenin **%17 uzeri**),
sik/eslesen terimde ise 182 ms (rahat icinde) — bulgu DOGRULANDI ve somut kanitla (EXPLAIN +
yuk) desteklendi. **P-05 (paylasim linki, LOW)** bu turda kod dokunulmadigi (mesaj duzeltmesi
disinda) icin yeniden test EDILMEDI, tasindi.

## 0. Metodoloji Notlari ve Kapsam Sinirlamalari

- **Hedeflenmis yeniden denetim**, tam sifirdan denetim degil. `374cce9..HEAD` (6 commit)
  `git diff --stat` ile incelendi: `apps/web` tarafinda H-004 (masaustu CSS/layout) + H-003
  (abonelik sayfasi yoklama/UI) degisiklikleri var — performans acisindan yalnizca bundle
  boyutu (frontend §4) ETKILENEBILIR, bu yuzden yeniden olculdu. `apps/api` tarafinda TEK
  performans-ilgili degisiklik H-001 (PDF font gomme); geri kalan `apps/api` dosyalari
  (billing, sharing, photos, reports, rate-limit) satir satir okunup YALNIZCA Turkce karakter
  mesaj duzeltmesi oldugu DOGRULANDI (`git diff` ciktilari asagida ozetlenmis, tamami
  incelendi) — bu yollar icin tek-kosum duman testiyle regresyon KONTROLU yapildi, P-02
  seviyesinde derinlemesine yeniden olculmedi.
- **P-01 (fotograf yukleme) neden yeniden derinlemesine olculdu:** `photos.service.ts`
  degisikligi yalnizca hata mesajlarinda (kod yolu ayni); yine de bu, mimarinin en riskli
  gecmisi olan akis oldugu icin (5. turda CRITICAL idi) hem "SONRA" (kucuk govde) hem "ONCE"
  (buyuk govde, T-028 istemci-kucultmesi bypass edilmis SENARYOsu) tekrar kosuldu — regresyon
  YOK, sonuc onceki turle ayni buyukluk mertebesinde.
- **P-04 bu tur ILK KEZ yuk altinda olculdu** (onceki turlerde yalnizca EXPLAIN vardi, gercek
  HTTP yuk testi yoktu) — bu yuzden "MEDIUM — genisletildi" olarak isaretlendi, bulgunun
  KENDISI yeni degil (5./6. turden tasinan bir kok-neden hipoteziydi), ama artik dogrudan HTTP
  yuk kanitiyla desteklendi.
- **Veri hacmi limiti:** 41k satirlik "arama" verisi SQL ile senkron toplu ekleme (`generate_series`)
  ile uretildi, API'den DEGIL — bu, uygulamanin YAZMA performansini degil YALNIZCA okuma/arama
  performansini test eder (P-04'un kapsami zaten budur).
- **Yerel makine ≠ uretim.** Butun mutlak sureler 10 cekirdekli bir Docker Desktop host'unda
  olculdu; uretim (Hetzner CX22, 2 vCPU) muhtemelen daha yuksek gecikme gorecektir. Yorumlar
  butce-orani ve kirilma DESENI (zarif yavaslama / hata seli / cokme) uzerinden yapilmistir.
- Yuk kademeli: 1x → hedef eszamanilik (c=30, mimari §6 varsayimi) → 2x (c=60). PDF icin 2
  BAGIMSIZ kosum (c=30) + 1 kosum (c=60) + 1 kosum (c=3, ~1x). Fotograf yukleme icin ayri
  kosumlar (SONRA hedef, SONRA 2x, ONCE hedef). Auth login icin hedef + 2x. Arama icin nadir-
  terim + sik-terim, hedef eszamanilikta.
- `PHOTO_MAX_PER_REPORT` ve rate limit'ler repo DISI `/tmp` override ile yukseltildi (yalnizca
  test kolayligi icin), performans DAVRANISINI etkilemez (dogrulama mantigi sabit-zamanli).

## 1. API Gecikme ve Yuk

| Akis (endpoint) | Yuk | p50 | p95 | p99 | Hata % | Butce (mimari §6) | Durum | Onceki tur (6. tur) |
|---|---|---|---|---|---|---|---|---|
| **PDF uretimi (10 fotografli, H-001 gomulu-font SONRASI)** | ~1x (c=3, n=9) | 364 | **470** | 474 | 0 | ≤3.000ms | ICINDE (%16) | ICINDE (443ms) |
| **PDF uretimi** | **hedef (c=30, n=60) — 2 BAGIMSIZ kosum** | 2.254 / 2.548 | **3.414 / 3.144** | 3.549 / 3.163 | 0 (tumu) | ≤3.000ms | **ASIYOR (%5-14 uzeri), hata YOK** — devam ediyor, HIGH | ASIYOR %19-53 uzeri — HIGH |
| **PDF uretimi** | 2x (c=60, n=80) | 4.254 | **6.542** | 6.808 | 0 | ≤3.000ms | **ASIYOR (~2,18 kati)** — zarif yavaslama, hata yok | Bu turda 2x olculmemisti |
| Fotograf yukleme — SONRA (kucultulmus, 1,16MB) | hedef (c=30, n=60) | 337 | **583** | 616 | 0 | ≤1.500ms | **ICINDE (%39)** — P-01 kapali, dogrulandi | ICINDE (%33-42) |
| Fotograf yukleme — SONRA | 2x (c=60, n=80) | 546 | **778** | 789 | 0 | ≤1.500ms | **ICINDE (%52)** | ICINDE (%69-75) |
| Fotograf yukleme — ONCE (buyuk, kucultme-yok, 6,87MB) | hedef (c=30, n=40) | 1.345 | **2.117** | 8.553 | 0 | ≤1.500ms | **ASIYOR (%41 uzeri)** — beklenen, istemci kucultmesi bypass edilmis senaryo, mitigasyon (T-028) ONCESI davranisi gosterir | Karsilastirilabilir asim |
| Auth login (bcrypt cost10) | hedef (c=30, n=90) | 211 | **272** | 282 | 0 | ≤400ms | **ICINDE (%68)** | ICINDE (%57) |
| Auth login | 2x (c=60, n=120) | 389 | **441** | 457 | 0 | ≤400ms | **ASIYOR (~%10 uzeri)** — onceki turla (431ms) ayni buyuklukte, degismedi | ASIYOR (~%8 uzeri) |
| Tutanak olusturma (T-005) | hedef (c=30, n=60) | 34 | **73** | 74 | 0 | ≤300ms | **ICINDE (%24)** | Bu turda ayrica olculdu |
| Tutanak listesi, kucuk olcek (dogrulama) | hedef (c=30, n=60) | 48 | **52** | 53 | 0 | ≤350ms | ICINDE (%15) | — |
| **Arama, 41k-olcek, nadir/eslesmeyen terim** | hedef (c=30, n=60) | 241 | **411** | 438 | 0 | ≤350ms | **ASIYOR (%17 uzeri)** — Seq Scan (bkz. §2), hata yok | EXPLAIN'e dayali tahmin, bu tur HTTP yuk kanitiyla dogrulandi |
| Arama, 41k-olcek, sik/eslesen terim | hedef (c=30, n=60) | 126 | **182** | 190 | 0 | ≤350ms | ICINDE (%52) | — |

**Kirilma davranisi (2x yuk):** **zarif, sinir tanimli — hicbir akista hata/zaman-asimi/cokme
YOK.** PDF: p95 hedefte 3.144-3.414ms'den 2x'te 6.542ms'ye ~1,9-2x artiyor (CPU-bagli
kuyruklanma, dogrusala yakin). Fotograf yukleme SONRA: p95 583→778ms (~1,3x, kontrollu). Auth
login: p95 272→441ms (~1,6x). Hicbir kosumda `docker compose ps` "unhealthy"/restart
GOSTERMEDI, API loglarinda istisna YOK (bkz. §3).

## 2. Veritabani

**Sema/indeksler onceki turlerle BIREBIR AYNI** (migration dosyalari `374cce9..HEAD` arasinda
degismedi, canli dogrulandi):
```
reports_pkey                  UNIQUE btree (id)
reports_owner_id_idx          btree (owner_id)
reports_template_id_idx       btree (template_id)
reports_owner_created_at_idx  btree (owner_id, created_at DESC)
reports_title_trgm_idx        GIN (title gin_trgm_ops)
reports_note_trgm_idx         GIN (note gin_trgm_ops)
```

**P-04'un kok-neden kaniti (bu tur ILK KEZ HTTP yukuyle birlikte alindi):** 40.062 satirlik
tek-sahip tabloda (mimarinin §6 "ilk yil sonu" varsayimi):

- Sik/eslesen terim (`ILIKE '%arama%'`, ~40k satirin cogu eslesir): planlayici
  `reports_owner_created_at_idx` uzerinde Index Scan + Limit kullanir, LIMIT 20'ye ulasir
  ulasmaz durur — **Execution Time 0,09 ms** (tek sorgu, izole).
- **Nadir/eslesmeyen terim** (`ILIKE '%zzznotfoundxyz%'`, 0 eslesme): planlayici trigram GIN
  indekslerini (`reports_title_trgm_idx`/`reports_note_trgm_idx`) HIC kullanmiyor, sahibin
  TUM 40.062 satirini tarayan bir **Seq Scan**'e dusuyor (`EXPLAIN ANALYZE, BUFFERS`):
  ```
  Seq Scan on reports (actual time=26.820..26.820 rows=0 loops=1)
    Filter: (owner_id = ... AND (title ~~* '%zzznotfoundxyz%' OR note ~~* '%zzznotfoundxyz%'))
    Rows Removed by Filter: 40062
    Buffers: shared hit=889
  Execution Time: 26.869 ms
  ```
  Tek sorguda 26,9 ms goze carpmiyor ama hedef eszamanilikta (c=30) bu, sunucu p95'ini 411
  ms'ye tasiyor (butcenin %17 uzeri) — CPU/Node katmaninda kuyruklanan 30 paralel Seq Scan'in
  toplam maliyeti.
- **Kok neden hipotezi:** OR ile birlestirilmis iki ayri sutundaki (`title`, `note`) ILIKE
  filtresi + `owner_id` esitligi kombinasyonu icin planlayici, iki GIN indeksi uzerinde bir
  Bitmap-Or yerine `owner_created_at_idx` uzerinden Index-Scan-with-Limit'i (eslesen az sayida
  satir varsa ucuz) VEYA Seq-Scan'i (eslesme YOKSA/az sayida beklenirse) tercih ediyor;
  hicbir planda trigram indeksleri kullanilmiyor. Bu, Prisma'nin `contains`/`OR` uretimindeki
  SQL kaliginin (iki ayri `ILIKE` + `OR`) GIN'in tek-ifade avantajini planlayiciya
  gosteremiyor OLMASINDAN kaynaklaniyor olabilir.
- **Oneri (kod DEGISTIRILMEDI, yalnizca oneri):** arama sorgusunu tek bir birlesik
  `to_tsvector`/trigram ifadesine (ornegin `(title || ' ' || note) ILIKE ...` uzerinde tek bir
  GIN indeks, ya da `similarity()`/`%` operatoruyle acik trigram sorgusu) tasimak
  planlayiciyi GIN kullanima zorlayabilir; alternatif olarak arama sonucu SAYFALANDIGI icin
  (pageSize ≤50) bu Seq Scan zaten sinirli (~40k satir, tek sahip) — 1 yillik hedef olcekte
  **"gerektiginde"** etiketiyle v2/borc listesine uygun, MEDIUM, bloklamiyor.

PDF akisinda DB sorgusu **darbogaz DEGIL**: `generatePdf` istek basina 2 sorgu yapar
(`assertOwnership` + `listOwnedPhotoSources`, kod okundu, N+1 YOK); asil maliyet CPU-bagli
(bkz. §1 kok-neden, sharp/PDFKit) ve depolamadan (MinIO/R2) fotograflarin **sirali** (`for`
dongusu icinde `await storage.getObject(...)`, `apps/api/src/modules/pdf/report-pdf.service.ts`
satir 51-54) okunmasidir — bu, kodda ACIKCA belgelenmis bilinçli bir tasarim (bellek sinirini
4 GB'lik tek sunucuda kontrol altinda tutmak icin tutanak basina ayni anda yalnizca 1 fotograf
bellekte tutulur), bug DEGIL, ama P-02'nin dogrudan kok nedenidir.

## 3. Kaynak Profili (yuk altinda)

- **Bellek (baslangic → tepe → sogutma sonrasi):** Karma yuk turunda (60 fotograf yuklemesi
  [1/3 buyuk 6,87MB + 2/3 kucuk 1,16MB, c=20] + 30 PDF uretimi [c=10] + 30 arama [c=10] AYNI ANDA)
  API container'i **109 MiB → tepe 472,8 MiB → ~15sn sonra 74,25 MiB'ye geri dustu.** Onceki
  turlerin desenle (139,8→451,5→67,6-126,2 vb.) AYNI aile — **sizinti supheli DEGIL.**
- **CPU doygunlugu:** Ayni karma yukte API container'i **%715,78** (10 cekirdegin ~7,16'si) tepe
  gordu — onceki turdeki %343-745 araliginin icinde. **Uretim hedefi 2 vCPU** oldugu icin bu
  profil PDF+fotograf yuklemesinin AYNI ANDA gerceklestigi senaryolarda dikkatli izlenmeli
  (izleme onerisi, bloklamiyor).
- **Baglanti havuzu:** Yuk sirasinda `pg_stat_activity` **27**'de sabit kaldi (Postgres
  `max_connections=100`), havuz tukenmesi izine rastlanmadi.
- Tum agir yuk turlarindan sonra `docker compose ps` container'lari (`api`, `db`, `web`, `minio`)
  `healthy`/`Up` gosterdi; API loglarinda (`docker logs`, 15 dakikalik pencere) istisna/5xx izi
  YOK.

## 4. Frontend (`apps/web`, uretim build'i)

Lighthouse/chrome-headless bu ortamda hala YOK (arac bosluğu, degismedi). H-003/H-004 CSS/UI
degisiklikleri sonrasi bundle boyutu yeniden olculdu:

| Metrik | Bu tur (7. tur) | Onceki tur (6. tur) | Butce | Durum |
|---|---|---|---|---|
| Ana JS chunk, ham | 313.640 bayt | 312.627 bayt | — | +1.013 B (kucuk artis) |
| Ana JS chunk, gzip | 97.524 bayt | ~97.042 bayt | — | +482 B, ihmal edilebilir |
| CSS, ham | 13.705 bayt | — | — | — |
| CSS, gzip | 2.698 bayt | ~2.640 bayt | — | +58 B, ihmal edilebilir |
| **Toplam ilk-yuk transferi (gzip)** | **~100.222 bayt (~97,9 KB)** | ~99.682 bayt (~97,3 KB) | ≤250 KB | **ICINDE (%39 kullanim)** — H-003/H-004 UI genislemesine ragmen butce payinda pratik degisiklik YOK |
| LCP (soğuk/tekrar) | **OLCULEMEDI** (arac yok) | Olculemedi | ≤2,5sn/≤1,2sn | Arac bosluğu — bulgu degil, degismedi |

## 5. Soguk Baslangic

**Uygulanamaz (N/A) — degismedi.** Mimari §5.3 scale-to-zero'yu bilincli reddediyor (surekli
acik tek instance, Hetzner CX22, `restart: unless-stopped`).

## Bulgular

| ID | Siddet | Alan | Bulgu (olcum kanitiyla) | Kok neden hipotezi | Oneri |
|---|---|---|---|---|---|
| P-01 | **KAPALI (dogrulandi)** | Fotograf yukleme (T-006) | Hedef eszamanilikta p95 583ms (butcenin %39'u), 2x'te 778ms (%52), hata %0 — T-028'in mitigasyonu bu turda da gecerli, `photos.service.ts` degisikligi yalnizca mesaj metniydi (kod okundu). | Degismedi. | Aksiyon gerekmiyor. |
| P-02 | **HIGH (devam ediyor, kucuk iyilesme YETERSIZ)** | PDF uretimi (T-007), H-001 sonrasi | Hedef eszamanilikta (c=30) 2 BAGIMSIZ kosumda p95 3.144-3.414ms (butcenin **%5-14 uzeri**), hata yok; 2x'te (c=60) p95 6.542ms (**~2,18 kati**). H-001'in gomulu-font eklemesi (~1,46MB TTF, her belgeye gomulu) DAHA KOTU YAPMADI (onceki tur %19-53 uzeriydi) ama sorunu COZMEDI de — asil maliyet hala `report-pdf.service.ts`'deki SIRALI `for` dongusu (storage okuma + `sharp` kucultme, fotograf basina) oldugu icin font degisikligi bu maliyetin YANINDA kucuk kaliyor. Kanit: §1 tablosu + §2 kod okumasi (satir 51-54). | Fotograf sayisiyla dogrusal olceklenen, sirali (paralel DEGIL) depolama-okuma + CPU-bagli kucultme/gomme zinciri; bu bilinçli bellek-sinirlama tasarimi (yorum satirinda belgeli) hiz pahasina. | **Bloklamiyor** ama iki turdur acik: (a) depolanan fotograf zaten ≤1600px ise PDF yolunun `sharp.resize()` cagrisini atlamasi (onceki oneri, hala gecerli); (b) storage okumalarini `Promise.all` ile SINIRLI paralellikte (ornegin 3'lu batch) yapmak, bellek sinirini tamamen terk etmeden gecikmeyi azaltabilir — "gerektiginde", v2/borc listesine tasinmasi onerilir, ancak iki turdur ayni HIGH'ta kalmasi nedeniyle bir sonraki surumde ELE ALINMASI tavsiye edilir. |
| P-03 | HIGH (degismedi, marj sabit) | Auth login (T-003) | Hedef eszamanilikta rahat icinde (p95 272ms/400ms=%68). 2x'te p95 441ms (**~%10 uzeri**) — onceki turdeki 431ms ile PRATIKTE AYNI, ne iyilesti ne kotulesti. Hata yok. | Degismedi (bcrypt native, libuv havuzu paylasimi). | Aksiyon gerekmiyor — yalnizca 2x stres testinde, sinirli asim, "gerektiginde" izlenir. |
| P-04 | **MEDIUM (genisletildi — bu tur HTTP yuk kanitiyla dogrulandi)** | Tutanak arama (T-011), 41k-olcek, nadir terim | Hedef eszamanilikta p95 411ms (butcenin **%17 uzeri**), hata yok; EXPLAIN Seq Scan (40.062 satir tarandi, 26,9ms/sorgu) ile dogrulandi — trigram GIN indeksleri KULLANILMIYOR. Sik terimde 182ms (rahat icinde). Kanit: §1 + §2. | Iki-sutunlu OR + ILIKE deseni planlayiciyi GIN'den Seq-Scan/Index-Scan-with-Limit'e yonlendiriyor. | Birlesik trigram ifadesi veya acik `%`/`similarity()` operatoru ile sorgu yeniden yazimi — "gerektiginde", v2/borc listesi (mevcut ilk-yil olceginde bloklayici degil, sayfalama zaten sinirli). |
| P-05 | LOW (tasindi, test EDILMEDI) | Paylasim linki olusturma (T-008) | `share-link.service.ts` bu turda yalnizca mesaj metni degisti (kod okundu, dogrulandi); onceki turun kenar-bulgusu degismeden tasindi. | Degismedi. | Aksiyon gerekmez; v2/borc listesi, "gerektiginde". |

## GATE3 Etkisi

**BLOKLANMIYOR.** CRITICAL bulgu yok. Onceki turun tek CRITICAL'i (P-01) bu turda da kapali
kaldigi bagimsiz dogrulandi. `374cce9..HEAD` arasindaki tek performans-ilgili kod degisikligi
(H-001, PDF font gomme) mevcut HIGH bulguyu (P-02) ne kotulestirdi ne cozdu — **iki turdur
ayni HIGH seviyede takili kaliyor**, bu nedenle bir sonraki surum dongusunde ele alinmasi
tavsiye edilir (bloklayici degil, ama "gerektiginde" degil "yakinda" olarak isaretlenmeli).
P-03/P-04/P-05 mimarinin kendi tanimladigi anlamda bloklayici DEGIL: sinirli asim (P-03 yalnizca
2x'te ~%10, P-04 yalnizca kotu-durum arama teriminde ve ilk-yil olcek varsayiminda ~%17), hata
YOK, zarif yavaslama; hicbiri release'i BEKLETME nedeni degil.

**Erken-optimizasyon notu:** P-01 %39/%52 butce kullanimiyla RAHAT icinde; bu payi daha da
kucultmek icin ek karmasiklik (cache katmani, async kuyruk) EKLEMEK bu asamada gereksizdir.
Tutanak olusturma (%24) ve kucuk-olcek liste (%15) da rahat icinde, herhangi bir onceden-
optimizasyon GEREKMIYOR — mimarinin kendi notuyla uyumlu ("bilinçli olarak rahat bütçeler").
