# Devlog — T-007

> Uretici: dev-agent | Branch: ticket/T-007 | Tarih: 2026-08-14

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Fotografli tutanakta PDF istegi 200 + `application/pdf` dosya doner | `ReportsController.downloadPdf` (`GET /reports/{reportId}/pdf`, `StreamableFile` + `application/pdf` + `attachment; filename="tutanak-<id>.pdf"`), `ReportsService.generatePdf`, `ReportPdfService.renderReport` | e2e: "en az bir fotografi olan tutanak icin 200 + application/pdf dosyasi doner"; birim: `ReportsController.downloadPdf`, `ReportsService.generatePdf` mutlu yol |
| 2. PDF baslik + sablon adi + notu icerir | `ReportPdfBuilder.addTitle/addTemplateName/addNote`, `ReportsService.generatePdf` (kayittan `title`/`templateName`/`note`) | e2e: "uretilen PDF tutanagin basligini, sablon adini ve notunu icerir"; birim: `ReportPdfBuilder`, `ReportPdfService.renderReport` |
| 3. PDF en az bir fotografi ve o fotografin tarih-saat damgasini icerir | `ReportPdfBuilder.addPhoto` (goruntu + damga satiri), `formatReportStamp`, `shrinkPhotoForPdf`, `StoragePort.getObject` | e2e: "uretilen PDF eklenen fotografi ve o fotografin tarih-saat damgasini icerir" + "birden fazla fotografta her fotograf kendi damgasiyla"; birim: builder/servis/formatter/processor spec'leri |
| 4. Fotografsiz tutanakta 400 + aciklayici mesaj | `ReportsService.generatePdf` guard: `UnprocessableError('REPORT_HAS_NO_PHOTOS')` | e2e: "hic fotografi olmayan tutanakta 400 REPORT_HAS_NO_PHOTOS + aciklayici mesaj doner"; birim: `ReportsService.generatePdf` |
| 5. Baskasinin tutanaginin PDF'i 403 | `ReportsService.assertOwnership` (§3.8 guard clause, PDF akisinin ilk adimi) | e2e: "baska kullaniciya ait tutanagin PDF"ini isteme 403 FORBIDDEN doner"; birim: "baska kullaniciya ait tutanakta ForbiddenError firlatir ve PDF URETMEZ" |

## Alinan Kararlar ve Gerekceler
- **Katman yerlesimi mimariyle birebir:** `modules/pdf` (PDFKit duzeni + `sharp` kucultme), `modules/reports` (endpoint + sahiplik + "fotografsiz -> 400"), `infra/storage` (fotograf okuma) — architecture.md §10 T-007 satiri. Bagimlilik yonu tek yonlu: `reports -> pdf -> infra/storage`.
- **Builder deseni** sozlukten alindi (CLAUDE.md §7: "PDF belgesinin bolum bolum kurulmasi — `ReportPdfBuilder`"): baslik -> sablon -> not -> fotograflar. T-010'un onay blogu bu zincire ek bir metot olarak girecek sekilde birakildi (simdi YAZILMADI, kapsam disi).
- **`StoragePort.getObject` eklendi** (port + `R2StorageAdapter` + `FakeStorageAdapter`): PDF fotograf baytlarini sunucuda okur, on-imzali URL ile tarayici uzerinden degil. Okuma hatasi zaten var olan `502 STORAGE_UNAVAILABLE` yoluna baglandi (§4.2.1) ve belge tamamlanmadan yanit yazilmadigi icin yarim PDF stream edilmesi yapisal olarak imkansiz.
- **`PhotosService.listOwnedPhotoSources`**: `PhotoDto` `storage_key` tasimaz (§3.5) — PDF icin ayri bir sinir tipi (`PhotoSource`) donduruldu. Sahiplik `ReportsService`'te dogrulandigi icin ikinci sahiplik sorgusu yapilmaz (istek basina iki sorgu); sira `findByReport` uzerinden `(sort_order, captured_at)` (§3.14).
- **Fotograflar sirayla okunur (paralel degil):** eleman sayisi `PHOTO_MAX_PER_REPORT` ile ustten sinirli oldugu icin bu bilincli bir O(n) I/O dongusudur; paralel okuma es zamanli isteklerde bellekte tutulan ham fotograf sayisini tutanak basina 1'den 30'a cikarirdi (4 GB tek VPS — architecture.md §6). Butce (p95 <= 3 sn / <=10 fotograf) sirali okumayla karsilanir.
- **Her fotograf kendi sayfasinda:** degisken sayida fotografta yer hesabi gerekmez ve damganin fotograftan ayri sayfaya dusmesi imkansiz olur.
- **PDF'e gomme oncesi `sharp` kucultme** (uzun kenar 1600 px, architecture.md §3) + **jpeg'e cevirme**: PDF, depoda izin verilen `webp` bicimini tasiyamaz; saydamlik basili belgede karsiligi olmadigi icin duz beyaz zemine indirilir.
- **`pdfkit@0.15.2` eklendi** — CLAUDE.md §6.1'de zaten secilmis kutuphanedir (surum pini 0.15). `@types/pdfkit` dev bagimliligi tip guvenligi icin eklendi. `npm audit --audit-level=high` temiz (yalnizca onceden var olan `iyzipay` kaynakli 4 moderate bulgu).
- **PDF metin dogrulamasi icin ek kutuphane EKLENMEDI:** `test/pdf-text.ts` yardimcisi PDF icerik akislarini node'un `zlib`'i ile acip `Tj`/`TJ` operatorlerini okur; testler "PDF gercekten bu metni/gorseli tasiyor mu" sorusunu bagimlilik eklemeden cevaplar. Bu dosya varlik uretmez (§8.4 ayrimi korundu).

## Varsayimlar
- PDF'in gorsel sartnamesi yoktur (`design.md` yalnizca "PDF Indir" butonunu tarifler, belge duzenini degil): A4, 50 pt kenar bosluklu, baslik/sablon/not + fotograf-basina-sayfa duzeni secildi.
- Bos not, bolumun kaybolmasi yerine `Not: -` yer tutucusu ile yazilir (belge alanlari sabit kalsin diye).
- `GET /reports/{reportId}/pdf` her istekte belgeyi yeniden uretir (onbellek yok) — architecture.md §8.1 "PDF her istekte yeniden uretilir" ifadesiyle ayni.

## Anayasa (CLAUDE.md) Bosluklari
- **Damga saat dilimi:** §5.1 tablosunda saat dilimi/yerellik anahtari yok, kendi env adimi icat etmedim. PDF basili bir belgedir ve damganin hangi dilimde oldugu okuyucuya gorunmez; sunucunun yerel saatine birakmak ayni tutanagin farkli sunucularda farkli saat gostermesi demekti. Urun tek pazara (Turkiye) ozel oldugu icin `REPORT_STAMP_TIME_ZONE = 'Europe/Istanbul'` sabiti + `tr-TR` bicimi secildi (adlandirilmis sabit, tek dosyada).
- **Belge duzeni sabitleri:** `PDF_PHOTO_MAX_EDGE_PX = 1600` degeri architecture.md §3'ten gelir ama §5.1 tablosunda karsiligi yok — dagitim yapilandirmasi degil belge duzeni sabiti sayilip adlandirilmis sabit olarak yazildi.
- **PDF fontu:** anayasada gomulu font karari yok. PDFKit'in standart fontu (Helvetica/WinAnsi) kullanildi; ek font dosyasi repoya KONULMADI (bkz. Bilinen Sinirlamalar).

## Bilinen Sinirlamalar
- **Turkce'ye ozgu harfler:** WinAnsi kodlamasi `c/o/u` gibi Latin-1 harflerini tasir ama `s-cedilla`, `g-breve`, noktasiz `i` ve `I` harflerini TASIMAZ; kullanicinin girdigi baslik/not bu harfleri iceriyorsa PDF'te yanlis glif olusur. Cozumu bir Unicode TTF gomlemektir; bu, repoya ikili varlik + `tsc` cikti kopyalama (build/Dockerfile) degisikligi gerektirdiginden ayri bir ticket konusudur (bu ticket'in kabul kriterlerinde karakter kumesi sarti yok). Font secimi tek sabitte (`TITLE_FONT`/`BODY_FONT`) toplandi ki degisiklik tek satir olsun.
- Onay bilgisi (onay damgasi + onaylayan e-posta) PDF'e ISLENMEDI — T-010 kapsami.
- `apps/web` tarafinda "PDF Indir" butonu bu ticket'ta YAZILMADI: architecture.md §10 ticket-bilesen esleminde T-007 yalnizca backend bilesenlerine eslenmistir (T-005/T-006 satirlarinin aksine `apps/web` gecmiyor).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `apps/api/package.json` icinde `sharp` `^0.35.3` pinlenmis; CLAUDE.md §6.1 tablosu `0.33` diyor (T-006'dan devralindi). Dokunulmadi, not edildi.
- `docker ps` ciktisinda onceki turdan kalmis `t006-review-db` container'i duruyor; bu calisma icin ayri bir container kullanildi ve calisma sonunda kaldirildi. Baskasinin container'ina dokunulmadi.

## Test Kosum Ciktisi (ozet)
```
# birim (kok + api + web)
Test Suites: 5 passed, 5 total     Tests: 25 passed   (kok)
Test Suites: 39 passed, 39 total   Tests: 256 passed  (apps/api, coverage esikleri gecti)
Test Suites: 11 passed, 11 total   Tests: 53 passed   (apps/web)

# e2e — CI paritesi: yalnizca DATABASE_URL tanimliyken TUM paket
env -i PATH=... DATABASE_URL=postgresql://... npm run test:e2e
Test Suites: 10 passed, 10 total
Tests:       138 passed, 138 total
(yeni: test/report-pdf.e2e-spec.ts — 8 senaryo)

# kapilar
npm run typecheck  -> temiz
npm run lint       -> 0 uyari/0 hata (--max-warnings=0)
npm run format:check -> temiz
npm run build      -> api + web basarili
npm audit --audit-level=high -> cikis kodu 0
```
