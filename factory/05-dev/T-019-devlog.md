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

## Test Kosum Ciktisi (ozet)
```
# npm run test (workspace koku)
root  : Test Suites: 5 passed, 5 total   | Tests: 25 passed
api   : Test Suites: 55 passed, 55 total | Tests: 360 passed
web   : Test Suites: 40 passed, 40 total | Tests: 275 passed
        ReportCreatePage.tsx  100% satir / 100% dal
        src/features/reports  100% satir / 100% dal

# npm run lint        -> 0 uyari / 0 hata
# npm run typecheck   -> temiz (root + api + web)
# npm run format:check-> All matched files use Prettier code style
# web build           -> 301.70 kB (gzip 94.35 kB), bundle butcesi (<=250 kB gz) korunuyor
```
