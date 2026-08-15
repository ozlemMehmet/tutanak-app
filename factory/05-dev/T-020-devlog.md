# Devlog — T-020

> Uretici: dev-agent | Branch: ticket/T-020 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Baslik, sablon adi, not ve durum (`StatusChip`) gosterilir | `features/reports/reports.api.ts#fetchReport`, `features/reports/useReport.ts`, `features/reports/StatusChip.tsx`, `pages/ReportDetailPage.tsx` basligi/ustbilgi bolgesi | `StatusChip.spec.tsx`, `reports.api.spec.ts` (`fetchReport` adresi), `ReportDetailPage.spec.tsx` ("tutanagin basligini, sablon adini, notunu ve durum rozetini gosterir") |
| 2. "PDF Indir" `GET /reports/{id}/pdf` cagirir, `application/pdf` dosya olarak sunulur | `api/client.ts#requestFile` (blob + `Content-Disposition`), `reports.api.ts#downloadReportPdf`, `lib/download-file.ts#saveBlobAsFile`, `features/reports/useDownloadReportPdf.ts`, sayfadaki aksiyon bari | `client.spec.ts` (requestFile), `reports.api.spec.ts`, `download-file.spec.ts`, `ReportDetailPage.spec.tsx` (indirme akisi + 502 toast) |
| 3. `photoCount === 0` iken PDF disabled + yardimci metin (400 REPORT_HAS_NO_PHOTOS yansimaz) | Sayfa fotograf sayisini `usePhotos` onbelleginden okur; buton `disabled`, altinda yardimci metin | `ReportDetailPage.spec.tsx` ("fotograf yokken PDF Indir disabled ve yardimci metin gorunur" + istek atilmadigi dogrulanir) |
| 4. Yukleme hatalari (400 UNSUPPORTED_MEDIA_FORMAT / FILE_TOO_LARGE, 502 STORAGE_UNAVAILABLE) sartname metinleriyle toast | Mevcut `photo-error-message.ts` + `PhotoSection` (degisiklik gerekmez) | `ReportDetailPage.spec.tsx` (FILE_TOO_LARGE ve STORAGE_UNAVAILABLE toast'lari sayfa uzerinden) + mevcut `photo-error-message.spec.ts` |
| 5. 30 fotografta "Fotograf Ekle" proaktif disabled | `features/photos/photo-limits.ts#PHOTO_MAX_PER_REPORT`, `PhotoSection` liste uzunlugu ile disabled | `PhotoSection.spec.tsx` ("30 fotografa ulasildiginda ... 409 beklenmeden") |
| 6. `approved` iken ekleme arayuzu yok, galeri salt-okunur, onay banner'i | Sayfa `canAddPhoto={status !== 'approved'}` + `ApprovedBanner` | `ReportDetailPage.spec.tsx` ("onaylanmis tutanakta ...") |
| 7. Her fotografin `capturedAt` damgasi izgarada gorunur | Mevcut `PhotoGrid` (degisiklik gerekmez) | `ReportDetailPage.spec.tsx` (damga metni sayfada) |
| 8. E-posta oncesi her zaman `POST /reports/{id}/share-link` | Mevcut `useShareLink.ts#useSendShareEmail` (degisiklik gerekmez) | `ReportDetailPage.spec.tsx` (sayfa uzerinden cagri sirasi; 404 SHARE_LINK_NOT_FOUND yansimaz) |

## Alinan Kararlar ve Gerekceler
- **PDF indirme icin `ApiClient.requestFile`**: yanit `application/pdf` oldugu icin mevcut
  `request` (JSON cozer) kullanilamazdi. Bilesende ciplak `fetch` YASAK (CLAUDE.md §3.9), bu
  yuzden token ekleme / 401 kancasi / hata zarfi cozumlemesi ayni `send` yolundan gecen ikinci
  bir yontem olarak `api/client.ts`'e eklendi. Sonucu: arayuze zorunlu uye eklendigi icin
  mevcut spec'lerdeki sahte istemcilere `requestFile: jest.fn()` eklendi (davranis
  degistirilmedi, yalnizca tip uyumu). Alternatifler reddedildi: ikinci bir istemci arayuzu
  (`FileApiClient`) router/App/main zincirine ikinci prop tipi tasirdi; `request`'e
  `responseType` parametresi eklemek donus tipini imzayla baglayamazdi.
- **Dosya adi sunucudan**: `Content-Disposition` cozumlenir; baslik yoksa sozlesmedeki bicim
  (`tutanak-<id>.pdf`) yedek olarak kullanilir — ad istemcide uydurulmaz.
- **PDF butonunun durumu `usePhotos` onbelleginden**: sayfa fotograf sayisini PhotoSection ile
  AYNI sorgu anahtarindan okur (ek ag cagrisi yok, TanStack onbellegi paylasilir). Boylece ilk
  fotograf yuklendiginde buton aninda aktiflesir; `ReportDetail.photoCount` yalnizca liste
  henuz gelmemisken yedek deger olarak kullanilir. Aksi halde detay sorgusu bayatlar ve buton
  yanlis durumda kalirdi.
- **Indirme `useMutation` ile**: indirme kullanici tetikli, tek seferlik bir eylemdir; `useQuery`
  onbellege alip yeniden calistirirdi. Beklerken buton disabled → ikinci istek uretilmez.
- **PDF hatasi kod bazli tek mesaj**: sartname 400 `REPORT_HAS_NO_PHOTOS`'u zaten disabled ile
  onledigi icin PDF hata yolunda tek metin ("PDF olusturulamadi, tekrar deneyin") gosterilir;
  mesaj metnine gore dallanma yok (CLAUDE.md §4.3).
- **Onay banner'i icin `status === 'approved'`**: `approval` alani onay yokken yanitta HIC
  bulunmaz (CLAUDE.md §3.5); onayin varligi `status` uzerinden okunur, alan yalnizca banner
  metnini zenginlestirmek icin kullanilir (yoksa yalin "Bu tutanak onaylandi").
- **Desen eklenmedi**: sozlukteki desenlerin (Adapter+Port, Repository, Builder...) hicbiri bu
  ekranin problem sinifina denk gelmiyor; sayfa, veri cekmeyi hook'lara devreden duz bir bilesen
  olarak yazildi (§7.1).
- **Kriter 4 ve 8 icin urun kodu yazilmadi**: yukleme hata metinleri (`photo-error-message.ts`)
  ve e-posta oncesi idempotent `share-link` cagrisi (`useShareLink.ts`) T-006/T-008'de dogru
  uygulanmisti; ticket "burada yalnizca dogrulanir" dedigi icin sayfa seviyesinde test eklendi,
  mevcut kod DEGISTIRILMEDI.

## Varsayimlar
- `StatusChip` etiket metinleri (`Taslak` / `Paylasildi` / `Onaylandi`) design.md'de yazili
  degil; tonlar (§4.5) sartnameden, metinler sozlesmedeki durum adlarinin Turkce karsiligindan
  alindi.
- Aksiyon barinda yalnizca "PDF Indir" var; "Paylas" butonu T-008'de teslim edilen
  `SharePanel`'in kendi icinde (bkz. Bilinen Sinirlamalar).

## Anayasa (CLAUDE.md) Bosluklari
- **Fotograf ust siniri istemci tarafinda sabit**: proaktif kapatma (kriter 5) esik degeri
  ister; sunucuda bu `PHOTO_MAX_PER_REPORT` yapilandirmasidir (§5.1) ama §5.1 tablosunda
  istemciye verilecek bir `VITE_` anahtari YOK ve sozlesmede degeri donen bir alan/uc nokta yok.
  Env adi ICAT EDILMEDI: deger `features/photos/photo-limits.ts` icinde, api-contract.yaml'da
  beyan edilen 30 degeriyle ve gerekce yorumuyla sabitlendi; sunucunun 409'u savunma katmani
  olarak korundu. Aday cozum: `VITE_PHOTO_MAX_PER_REPORT` ya da `ReportDetail`e alan eklenmesi
  (sozlesme karari).
- **Tasarim sozlesmesi boslugu (onceden de vardi)**: `design-tokens.json` tipografide yalnizca
  taban 16px tasiyor; §4.2'deki "Kucuk/Caption ~13px" adimi icin degisken uretilmiyor.
  `status-chip` ve `report-actions__hint` bu adimi, mevcut kodun (`photo-thumbnail__stamp`)
  gerekcesiyle birebir ayni sekilde `0.8125rem` olarak kullaniyor. Renk/bosluk/yaricap
  degerlerinin TAMAMI `tokens.css` degiskenlerinden geliyor; ham hex yazilmadi.

## Bilinen Sinirlamalar
- Mobil "alt sabit aksiyon bari" yalnizca PDF eylemini icerir (sticky + safe-area-inset).
  Sartnamedeki "PDF Indir + Paylas" ikilisinin tek barda birlesmesi `SharePanel`'in ic yapisini
  degistirmeyi gerektirirdi; SharePanel T-020'nin kapsam DISI listesinde.
- PDF indirme jsdom'da davranissal olarak dogrulandi (object URL + anchor tiklamasi + dosya adi);
  gercek tarayici indirme diyalogu CLAUDE.md §8.3 senaryo 2 (Playwright) ile dogrulanacak —
  `apps/web/e2e/` bu repoda henuz yok, bu ticket'ta e2e senaryosu yazilmadi.
- `usePhotos` sayfada ikinci kez cagrilir; TanStack ayni anahtari paylastigi icin ek ag cagrisi
  olusmaz, tazeleme yine yukleme sonrasi invalidasyona baglidir.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `resend` bagimliligi `apps/api/package.json`'da tanimli ama `package-lock.json`'da YOK
  (`npm ls resend` → empty). Sonucu: kok `npm run typecheck` ve `npm run lint`, apps/api
  tarafinda `Cannot find module 'resend'` + 3 `no-unsafe-*` hatasi veriyor
  (`src/infra/email/email.module.ts`). T-020 oncesinden gelen bir durum, web tarafiyla ilgisi
  yok — dokunulmadi.
- `ReportDetail.photoCount` fotograf yuklendikten sonra bayatliyor (yukleme yalnizca fotograf
  sorgusunu invalidate ediyor). Bu ekranda `usePhotos` ile asildi; liste ekrani (T-021) ayni
  bayatlamayi yasayabilir.

## Test Kosum Ciktisi (ozet)
```
$ npm run test           # kok + apps/api + apps/web
Test Suites:  5 passed,  5 total    Tests:  25 passed   (kok/tools)
Test Suites: 55 passed, 55 total    Tests: 360 passed   (@tutanak/api)
Test Suites: 44 passed, 44 total    Tests: 313 passed   (@tutanak/web)

apps/web kapsam: All files %99.06 satir; ReportDetailPage.tsx, StatusChip.tsx, useReport.ts,
useDownloadReportPdf.ts, download-file.ts, photo-limits.ts, reports.api.ts = %100

$ npx eslint apps/web --max-warnings=0        -> 0 uyari
$ npx prettier --check apps/web/src           -> temiz
$ npm run typecheck --workspace @tutanak/web  -> hatasiz
(Kok `npm run typecheck`/`npm run lint` apps/api'deki mevcut `resend` bagimlilik boslugu
yuzunden kirmizi; yukarida "ticket disi" olarak raporlandi, T-020 degisikligiyle ilgisi yok.)
```

## Iade turu 1 (code-reviewer, CHANGES)

Raporda TEK blocking madde vardi; yalnizca o ele alindi, ticket'in geri kalanina dokunulmadi.

**Bulgu:** `.status-chip--primary` "paylasildi" rozeti icin token ciftini TERS uyguluyordu
(`background: primary` + `color: on-primary`).

**Dogrulama (koru koru duzeltmeden once sozlesme teyit edildi):**
- `design-tokens.json` → `pairs`: `{ "foreground": "primary", "background": "surface-muted",
  "usage": "\"paylasildi\" durum rozeti metni; ..." }` — kullanim metni bu rozeti birebir adlandiriyor.
- `design.md` §4.5 bilesen tablosu: `StatusChip` → ``shared (`primary`/`surface-muted`)``.
- Cift siralamasinin `foreground`/`background` oldugu iki bagimsiz kanitla dogrulandi:
  (1) `draft` rozeti (`background: surface-muted; color: text-muted`) `{foreground: text-muted,
  background: surface-muted}` ciftiyle ortusuyor; (2) `design.md`:343 `SubscriptionPage`
  gosterimi "inactive: notr `text-muted`/`surface-muted`" ayni sirayi kullaniyor.
- Uygulanan `primary`/`on-primary` cifti gecerli bir cift olmakla birlikte beyan edilen kullanimi
  "birincil buton metni, AppShell header/nav metni" — rozet degil; ayrica rozeti ayni ekrandaki
  birincil butondan gorsel olarak ayirt edilemez kiliyordu.

**Degisiklik:**
- `apps/web/src/styles/app.css`: `.status-chip--primary` → `background: var(--color-surface-muted);
  color: var(--color-primary);` (deger yine yalnizca token degiskenlerinden geliyor, ham hex yok).
- `apps/web/src/features/reports/StatusChip.tsx:1-4`: sozlesmeyle celisen yorum duzeltildi; tonlar
  artik acikca `foreground`/`background` sirasiyla yaziliyor.
- `tone: 'primary'` anahtari ve sinif adi rapordaki yonlendirmeye uygun olarak DEGISMEDI;
  `StatusChip.spec.tsx` yalnizca sinif adi assert ettigi icin test degisikligi gerekmedi.

**Bulgu disi birakilanlar (raporda "finding degil" olarak isaretlenmisti, dokunulmadi):**
kok `npm run lint`'teki `email.module.ts` hatalari (kapsam disi, ortam/kurulum kaynakli) ve
`.status-chip`/`.report-actions__hint` icindeki caption `font-size` (beyan edilmis tasarim
sozlesmesi boslugu).

**Dogrulama:** `npm test --workspace apps/web` → 44 suite / 313 test gecti (regresyon yok);
`npm run typecheck --workspace apps/web` (`tsc --noEmit`) temiz; degisen iki dosyada
`npx prettier --check` temiz; `npx eslint StatusChip.tsx StatusChip.spec.tsx --max-warnings=0`
exit 0.
