# Devlog — H-001

> Uretici: dev-agent | Branch: ticket/H-001 | Tarih: 2026-08-17

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Yeniden uretim senaryosu duzelir: PDF metni `Şişli Çağlayan`, `çıkış`, `ışık düğmesi` dizelerini GERCEK Turkce harflerle icerir | `report-pdf.builder.ts`: gomulu DejaVu Sans/Sans-Bold + `registerFont`; `test/pdf-text.ts`: gomulu fontun `/ToUnicode` CMap'i uzerinden metin cozumleme | `report-pdf.e2e-spec.ts` → "uretilen PDF Turkce'ye ozgu harfleri (s g i S I) bozulmadan tasir (H-001)"; `report-pdf.builder.spec.ts` → "baslik ve govdedeki Turkce harfleri ... bozulmadan yazar" |
| 2. ASCII'ye katlanmis fixture'lar Turkcelestirilir, regresyon teste baglanir | — (test verisi) | `report-pdf.e2e-spec.ts`: `REPORT_TITLE`/`REPORT_NOTE` artik `Şişli Çağlayan 3+1 çıkış teslimi` / `Mutfak dolabı çizik, ışık düğmesi bozuk, boyası eskimiş.`; builder spec'inde `TURKCE_BASLIK`/`TURKCE_NOT`/`TURKCE_SABLON` |
| 3. Regresyon: fotograf gomme, onay blogu, damga davranisi degismez | Builder'da yalnizca font ADLARI degisti; duzen/punto/sira sabitleri korundu | Mevcut `report-pdf.e2e-spec.ts` (9 test), `approvals.e2e-spec.ts`, `report-pdf.service.spec.ts`, `report-pdf.builder.spec.ts` tamami yesil |
| 4. Font serbest lisansli, lisans dosyasi/atifi depoda | `apps/api/src/modules/pdf/fonts/LICENSE.txt` + `fonts/README.md` (kaynak, surum, kullanim) | `tools/pdf-font-asset.spec.ts` → "font lisansi font dosyalariyla birlikte depoda tasinir" |
| 5. `test`, `test:e2e`, `lint`, `typecheck` temiz | Tum degisiklikler | Asagidaki kosum ciktisi |

## Alinan Kararlar ve Gerekceler

- **DejaVu Sans 2.37 (Regular + Bold), depoya commit edildi.** Ticket'in ornekledigi iki
  aileden biri; `ş ğ ı Ş İ` dahil Latin Extended-A kapsar. Lisansi (Bitstream Vera + Arev)
  gomme/dagitma iznini acikca verir. Calisma zamaninda hicbir indirme yoktur; npm
  bagimliligi olarak da EKLENMEDI (ticket "depoya commit edilmis dosya" diyor, §6.2
  kutuphane butcesi de bir bagimlilik daha istemiyor).
- **Bold varyanti da gomuldu.** `TITLE_FONT` bugun `Helvetica-Bold`'du; yalnizca Regular
  gomseydim baslik ve onay basligi kalinligini kaybederdi — bu bir DUZEN degisikligi olurdu
  ve ticket kapsam disi diyor. Punto/duzen sabitlerine dokunulmadi.
- **Font baytlari modul yuklenirken BIR kez okunur** (`readFileSync`, `registerFont`'a
  Buffer verilir). PDF her istekte yeniden uretiliyor; dosyayi her belgede diskten okumak
  istek basina ~1,4 MB gereksiz G/C demekti. Dosya eksikse hata ilk yuklemede gurultulu
  patlar, istek basina 500 olarak degil.
- **Derleme adimina font kopyalama eklendi** (`apps/api/scripts/copy-pdf-fonts.mjs`,
  `build` script'ine zincirlendi). `tsc` yalnizca `.ts` uretir ve uretim imaji SADECE
  `apps/api/dist`'i tasir (Dockerfile runtime asamasi); bu adim olmadan testler yesil
  kalir ama uretimde PDF ENOENT ile duserdi. Dockerfile'a dokunulmadi (devops mulkiyeti).
- **`test/pdf-text.ts` gomulu fontu cozecek sekilde genisletildi.** Gomulu TrueType
  kullanan PDF'te dizgeler karakter degil GLIF NUMARASI tasir (Type0/Identity-H); ham
  baytlari okuyan eski yardimci "Şişli" yerine anlamsiz kod uretiyordu — yani kriterdeki
  `expect(text).toContain('Şişli Çağlayan')` font duzeltilse bile gecmezdi. Cozumleyici
  artik her fontun `/ToUnicode` CMap'ini okuyup icerik akisindaki `Tf` ile eslestiriyor;
  gomulu font kullanmayan (WinAnsi) belgelerde eski davranis aynen korunuyor.
  **Testi zayiflatmadigini kanitladim:** builder gecici olarak standart Helvetica'ya
  dondurulup kosuldugunda yeni testler KIRMIZI oluyor ve ciktida bug raporundaki bozulmanin
  aynisi gorunuyor (`æ_li ÇaöÆyan 3+1 ç±1òFW6ÆÖ`). Eslesmeyen glif sessizce yutulmuyor,
  `�` olarak yaziliyor ve testler bu karakteri de reddediyor.
- **`tools/pdf-font-asset.spec.ts` eklendi.** Font dosyasinin depoda olmasi, lisansin
  yaninda tasinmasi, builder'in standart WinAnsi fontuna geri dusmemesi ve derlemenin
  fontu `dist`'e kopyalamasi birim/e2e testleriyle YAKALANMAZ (testler kaynak agacindan
  kosar). Bu zincir kirilirsa hata yalnizca uretimde gorunurdu; repo bu tur
  yapilandirma kilitleri icin zaten `tools/*.spec.ts` desenini kullaniyor.

## Varsayimlar

- Font dosyalari `dejavu-fonts-ttf` 2.37.3 paketindeki degistirilmemis upstream
  kopyalaridir (README'de kaynak + surum kayitli).
- PDFKit kaynak adlarini (`/F1`, `/F2`, ...) belge genelinde tekil uretir; cozumleyicideki
  ad->CMap tablosu bu yuzden tum sayfalar icin gecerli kabul edildi (mevcut ciktida
  dogrulandi).

## Anayasa (CLAUDE.md) Bosluklari

- **Ikili (binary) varlik dosyalarinin yeri ve derlemeye tasinmasi anayasada tanimli
  degil.** §1 klasor agacinda `apps/api/src` altinda varlik dizini yok, §9/§10 derleme
  adiminda varlik kopyalama yok. Mevcut en yakin kuralla ilerledim: dosya kullanildigi
  modulun yaninda (`modules/pdf/fonts/`), kopyalama modulun kendi build script'inde.
  Aday kural: "derleme ciktisina girmesi gereken kod disi varliklar modul dizininde durur
  ve `build` adimi bunlari `dist`'e kopyalar".
- T-007 devlog'undaki "gomulu Unicode font karari mimaride yoktur" boslugu bu ticket ile
  KAPANDI; builder'daki eski "bilinen sinirlama" yorumu kaldirildi.

## Bilinen Sinirlamalar

- Depoya ~1,4 MB ikili dosya girdi (iki TTF). Alternatif (alt kume/subset font uretmek)
  depoda uretim araci olmayan, tekrar uretilemez bir ikili birakirdi; tam dosya tercih
  edildi. Uretilen PDF'e yalnizca kullanilan glifler gomulur (PDFKit subset yapar), dosya
  boyutu ciktida buyumez (ornek PDF ~14 KB).
- Font ailesi degisikligi PDF'in gorunumunu (harf sekli/genislik) degistirir; duzen
  sabitleri (punto, marj, fotograf yuksekligi) aynen korundu.
- Playwright E2E (§8.3) ve Docker imaji uzerinden kosum bu ortamda calistirilmadi;
  `dist` ciktisi derlenip fontun kopyalandigi ve derlenmis builder'in Turkce PDF urettigi
  dogrudan dogrulandi (`node -e "... dist/modules/pdf/report-pdf.builder.js"`).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- `apps/api/prisma/seed.ts` sablon adlari ASCII'ye katlanmis (`Giris/Cikis Teslim
  Tutanagi`, `Sayac/Demirbas Tespiti`, `Periyodik Durum Kontrolu`). PDF artik dogru
  basiyor ama urun metni hala Turkcesiz — H-002 (arayuz/metin Turkcelestirme) kapsami.
- PDF etiket sabitleri de ASCII (`Sablon: `, `Fotograf tarihi: `, `Taraf onayi`); ayni
  sekilde H-002'ye ait, bu ticket'ta bilincli olarak degistirilmedi.
- `apps/web` ve e-posta govdesi gibi diger metin ureten ciktilar bu ticket'ta
  incelenmedi; ders dosyasi (`testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi`)
  "metin ureten HER cikti ayri dogrulanmali" diyor — kalan ciktilar icin ayri bir kontrol
  gerekebilir.

## Test Kosum Ciktisi (ozet)

```
# Once KIRMIZI (font degisikliginden once, yeni testler):
  ✕ baslik ve govdedeki Turkce harfleri (s g i S I) bozulmadan yazar
    Expected substring: "Şişli Çağlayan 3+1 çıkış teslimi"
    Received string:    "æ_li ÇaöÆyan 3+1 ç±1òFW6ÆÖ ..."

# npm run test (birim + tools)
Test Suites: 55 passed, 55 total
Tests:       408 passed, 408 total

# npm run test:e2e (gercek Postgres, 13 suite)
PASS test/report-pdf.e2e-spec.ts
  ✓ uretilen PDF Turkce"ye ozgu harfleri (s g i S I) bozulmadan tasir (H-001)
Test Suites: 13 passed, 13 total
Tests:       201 passed, 201 total

# npm run lint / typecheck / format:check
eslint . --max-warnings=0            -> temiz
tsc --noEmit (api + web)             -> temiz
prettier --check .                   -> All matched files use Prettier code style!

# npm run build --workspace @tutanak/api
dist/modules/pdf/fonts/{DejaVuSans.ttf, DejaVuSans-Bold.ttf, LICENSE.txt} olustu
derlenmis builder ile Turkce PDF uretimi dogrulandi (dist render ok)
```
