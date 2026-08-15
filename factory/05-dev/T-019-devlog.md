# Devlog — T-019

> Uretici: dev-agent | Branch: ticket/T-019 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. `/reports/new` acilinca `GET /templates` cagrilir, 3 sablon DIKEY kart listesi | `features/reports/reports.api.ts` (`fetchTemplates`), `useTemplates.ts`, `ReportCreatePage` + `.template-list` (flex column) | `reports.api.spec.ts`; `ReportCreatePage.spec.tsx` → "sablon listesi (kriter 1)"; dikeylik `app.css` sozlesme testi |
| 2. Secili kart `primary` 2px kenarlik + `surface-muted` zemin; 2. adim erisilebilir olur | `TemplateCard.tsx` + `.template-card--selected`, `isSecondStepDisabled` | `TemplateCard.spec.tsx` (DOM + `app.css` gorsel sozlesmesi); `ReportCreatePage.spec.tsx` → "sablon secimi (kriter 2)" |
| 3. Sablon secilmeden VEYA baslik bosken buton disabled | `ReportCreatePage` `canSubmit` | `ReportCreatePage.spec.tsx` → "gonderim kosullari (kriter 3)" |
| 4. Baslik zorunlu/max 200; not opsiyonel/max 5000 + karakter sayaci | `ReportCreatePage` `TITLE_MAX_LENGTH`/`NOTE_MAX_LENGTH` + `#report-note-counter` | `ReportCreatePage.spec.tsx` → "form alanlari (kriter 4)" |
| 5. Gecerli gonderimde `POST /reports`, 201 → `/reports/:id` | `reports.api.ts` (`createReport`), `useCreateReport.ts`, `handleSubmit` `onSuccess` | `reports.api.spec.ts`; `ReportCreatePage.spec.tsx` → "basarili gonderim (kriter 5)" |
| 6. 400 → alan bazli hata | `report-error.ts` (`toReportFormError`) + `InlineFieldError` baglama | `report-error.spec.ts`; `ReportCreatePage.spec.tsx` → "alan bazli hata (kriter 6)" |
| 7. 404 `TEMPLATE_NOT_FOUND` → banner + liste yeniden cekilir | `report-error.ts` (`isTemplateInvalidError`, `TEMPLATE_NOT_FOUND_MESSAGE`), `handleSubmit` `onError` → `refetch()` | `report-error.spec.ts`; `ReportCreatePage.spec.tsx` → "gecersiz sablon (kriter 7)" |
| 8. Yuklenirken iskelet kartlar; hata → banner + "Tekrar Dene" | `ReportCreatePage` `isPending` iskeleti, `isTemplateListBroken` banner | `ReportCreatePage.spec.tsx` → "liste yukleme ve hata durumlari (kriter 8)" |

## Alinan Kararlar ve Gerekceler
- **Iki adim tek sayfada, ikinci adim gizlenmez, DEVRE DISI birakilir.** Kriter 3 "sablon secilmeden buton disabled kalir" diyor; form gizlenseydi bu kriter gozlemlenemezdi. Secim yapilinca alanlar etkinlesir (kriter 2 "erisilebilir olur").
- **Secim, listenin guncel halinden turetilir** (`templates.find(...)`), state'te ayrica sablon nesnesi tutulmaz: 404 `TEMPLATE_NOT_FOUND` sonrasi liste yeniden cekildiginde silinmis sablonun secimi kendiliginden duser ve buton disabled olur (kriter 7'nin regresyon testi bunu dogruluyor).
- **Kart secimi native `radio` ile.** Tek-secim davranisi, klavye gezinmesi ve `:focus-within` tarayicidan gelir; `role="radiogroup"` elle kurulmaz (design.md §5 klavye esdegerligi).
- **Kart kenarligi her iki durumda da 2px** (renk degisir): design.md "animasyonsuz anlik degisim" isterken 1px→2px gecisi yerlesim kaydirirdi.
- **Hata cevrimi ayri saf fonksiyonda** (`report-error.ts`): `features/auth/auth-error.ts` yeniden kullanilmadi, cunku o fonksiyon 401'i "e-posta veya sifre hatali" olarak yorumluyor — bu ekranda yanlis metin olurdu. Ortak bir jenerik form-hata cevrimi cikarmak refactor'dur, ticket disidir (asagida not edildi).
- **jsdom harici CSS'i uygulamadigi icin** kriter 1'in "dikey liste" ve kriter 2'nin "2px `primary` kenarlik + `surface-muted` zemin" gorsel sozlesmesi `app.css` kaynagi uzerinden test edildi (deger token degiskeni mi, ham hex mi dahil).
- **Verimlilik:** sicak yolda ic ice dongu/istek yok. Tek `find` cagrisi 3 elemanli sabit liste uzerinde (sozlesme "tam olarak 3 kayit" garantisi) — O(n) ve n=3.

## Varsayimlar
- `POST /reports` 400 yanitinin `details[]` alan adlari sozlesmedeki govde alan adlariyla ayni (`title`, `note`); formda karsiligi olmayan alan adi (ornegin `templateId`) banner'a duser, sessizce yutulmaz.
- Bos sablon listesi (sozlesme disi) kullanici acisindan yuklenememe ile ayni sonucu dogurur; design.md'nin "savunmaci genel hata banner'i" talimati bu sekilde uygulandi.

## Anayasa (CLAUDE.md) Bosluklari
- **Tasarim sozlesmesi boslugu (mevcut kayit tekrari):** `design-tokens.json` tipografi olceginde "Kucuk/Caption ~13px" adiminin ve dokunma hedefi 44px'in degisken karsiligi yok. T-018'de kurulan uygulamaya uyuldu: `0.8125rem` ve `44px` design.md §4.2/§5'ten birebir alindi, yerinde gerekcelendirildi.
- **Motion tokeni yok** (design.md "gelecek revizyon adayi"): bu ekranda hicbir gecis animasyonu kullanilmadigi icin (sartname "animasyonsuz anlik degisim" diyor) ek deger yazilmadi.

## Bilinen Sinirlamalar
- `useCreateReport` basarili olunca tutanak listesi onbellegini gecersiz kilmiyor: liste ekrani (T-021) henuz sorgu anahtarini tanimlamadi. Detay sayfasina yonlendirme kriteri bundan etkilenmiyor; anahtari tanimlayan ticket bu baglantiyi kurmali.
- CLAUDE.md §8.3'teki Playwright senaryosu ("kayit → giris → sablon sec → taslak olustur") bu ticket'ta yazilmadi: repoda `apps/web/e2e` altyapisi ve Playwright bagimliligi henuz yok, kurmak ticket kapsami disindadir.
- Baslik/not degerleri sunucuya kullanicinin girdigi haliyle gonderilir (istemci `trim` uygulamaz); buton etkinligi icin `trim()` yalnizca "bos mu" kontrolunde kullanilir.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `features/auth/auth-error.ts` ile `features/reports/report-error.ts` benzer bir cevrim iskeleti tasiyor (alan detaylarini bilinen alanlara baglama). Ucuncu bir form ekrani gelirse ortak bir saf yardimci cikarilabilir — su an iki kopya, farkli hata kodu semantigi tasidigi icin bilincli olarak ayri.
- `ReportListPage`, `SubscriptionPage` hala rota iskeleti (T-021/T-022 kapsami) — dokunulmadi.

## Iade turu 1 (QA: AC8 FAIL — hata banner'i gorunmuyor)

Sistematik hata ayiklama, 4 faz:

1. **Izole et.** QA'nin tekrar-uretimi (kalici 500, 3 saniye bekle) birim seviyesinde
   yeniden uretildi: `renderPage`'e `uretimYenidenDeneme` secenegi eklendi (sorgu
   varsayilanlarini bastirmaz, uretimdeki zamanlama calisir). Test kirmizi geldi — DOM'da
   3. saniyede hala iskelet kartlar vardi, `alert` yoktu. QA'nin gozlemi birebir dogrulandi.
2. **Hipotez (tek, test edilebilir).** "Hata durumu UI'a ZATEN bagli (`isTemplateListBroken`
   → banner + Tekrar Dene); sorun `useTemplates`in yeniden deneme politikasinda: hook `retry`
   belirtmedigi icin TanStack Query varsayilani (3 deneme, ustel bekleme 1s+2s+4s) devrede ve
   sorgu ~7 saniye boyunca `isPending` kaliyor — 3 saniyede henuz `isError` olmuyor." QA'nin
   "error handling eksik" tahmini bu yuzden dogru degildi; eksik olan ZAMANLAMA politikasiydi.
   Mevcut birim testleri bunu goremedi, cunku test `QueryClient`i `retry: false` ile kosuyordu.
3. **Test et.** `useTemplates`e kod tabaninin mevcut deseni uygulandi: `shouldRetryTemplates`
   saf yuklem (`useCurrentUser` / `usePublicReport` ile ayni sekil) — 4xx tekrarlanmaz,
   sunucu/ag hatasi sinirli tekrarlanir. `MAX_RETRY_COUNT = 1` (digerlerinde 2): bu ekranin
   design.md §3 sartnamesinde ACIK bir "Tekrar Dene" butonu var, otomatik deneme yalnizca
   anlik kesintiyi yutmali; kalici hatada kullanici hata durumunu ~1 saniyede gorup yeniden
   denemeyi kendisi tetikler. Hipotez dogrulandi: test yesile dondu.
4. **Dogrula + regresyon testi.** Kalici 500'de banner'in **en gec 3 saniyede** (QA'nin
   tekrar-uretim penceresi) gorundugunu olcen test kaliciysa eklendi
   (`ReportCreatePage.spec.tsx` → kriter 8). Bu test gercek zamanlayicilarla kosar; politika
   yeniden yavaslarsa kirmizi doner. `shouldRetryTemplates` icin ayrica saf fonksiyon testleri
   (`useTemplates.spec.ts`) eklendi.

Yan etki (bilincli): hook artik kendi `retry`sini tasidigi icin test `QueryClient`indeki
`retry: false` sablon sorgusunu ezemiyor. Varsayilan test modunda politika aynen calisir,
yalnizca `retryDelay: 0` ile beklemesi sifirlanir. Buna bagli olarak "Tekrar Dene listeyi
yeniden ceker" testi cagri SAYISINDAN bagimsiz hale getirildi (sunucu, kullanici butona
basana kadar hatali kalir) — boylece test deneme sayisi degisirse kirilmaz.

Kapsam: yalnizca `useTemplates.ts` (+ testleri) ve `ReportCreatePage.spec.tsx` degisti;
`ReportCreatePage.tsx` uretim kodunda degisiklik GEREKMEDI (hata durumu zaten bagliydi).
QA'nin PASS verdigi 7 kriterin kodu ellenmedi.

## Test Kosum Ciktisi (ozet)
```
# npm run test (workspace koku) — iade turu 1 sonrasi
root  : Test Suites: 5 passed, 5 total   | Tests: 25 passed
api   : Test Suites: 55 passed, 55 total | Tests: 360 passed
web   : Test Suites: 41 passed, 41 total | Tests: 281 passed  (+1 suite / +6 test)
        ReportCreatePage.tsx  100% satir / 100% dal
        src/features/reports  100% satir / 100% dal (useTemplates.ts dahil)

# npm run lint        -> 0 uyari / 0 hata
# npm run typecheck   -> temiz (root + api + web)
# npm run format:check-> All matched files use Prettier code style
# web build           -> 301.78 kB (gzip 94.37 kB), bundle butcesi (<=250 kB gz) korunuyor
```
