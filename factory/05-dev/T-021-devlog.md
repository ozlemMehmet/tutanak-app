# Devlog — T-021

> Uretici: dev-agent | Branch: ticket/T-021 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. `/reports` acilinca `GET /reports` cagrilir; kartlarda baslik, sablon adi, durum rozeti, fotograf sayisi, olusturma tarihi | `features/reports/reports.api.ts` (`fetchReports`), `features/reports/useReports.ts`, `features/reports/ReportCard.tsx` + `StatusChip.tsx`, `pages/ReportListPage.tsx`, `router.tsx` (client gecisi) | `ReportListPage.spec.tsx` "acildiginda GET /reports cagrilir", "her kart icin ... gosterir"; `ReportCard.spec.tsx`; `StatusChip.spec.tsx` |
| 2. Arama ~400ms debounce ile `q` olarak gonderilir; her tus vurusunda istek yok | `hooks/useDebouncedValue.ts` + `ReportListPage` arama kutusu | `useDebouncedValue.spec.ts`; `ReportListPage.spec.tsx` "her tus vurusunda istek yapilmaz" + "400ms sonra tek istek q ile gider" (sahte zamanlayici) |
| 3. Hic tutanak yokken bos durum + "Ilk tutanagini olustur" CTA -> `/reports/new` | `ReportListPage` bos durum dali | `ReportListPage.spec.tsx` "hic tutanak yokken ..." + CTA rota testi |
| 4. Arama sonucu bosken "'{q}' icin sonuc bulunamadi" + "Aramayi temizle"; temizleyince tam liste doner | `ReportListPage` arama-bos dali + `clearSearch` | `ReportListPage.spec.tsx` "arama sonucu bosken ...", "Aramayi temizle tam listeyi geri getirir" |
| 5. `total`/`page`/`pageSize`'a gore sayfalama; sayfa degisince yeni istek | `components/Pagination.tsx`, `ReportListPage` `page` durumu, `buildReportListPath` | `Pagination.spec.tsx`; `ReportListPage.spec.tsx` "sayfalama kontrolleri ... render edilir", "sonraki sayfa yeni istek yapar" |
| 6. Yuklenirken iskelet kartlar; hata olursa "Tutanaklar yuklenemedi" + "Tekrar Dene" | `ReportListPage` iskelet + hata banner dali, `useReports` retry politikasi | `ReportListPage.spec.tsx` "yuklenirken iskelet kartlar", "hata banner'i + Tekrar Dene", "Tekrar Dene yeniden ceker" |
| 7. "+ Yeni Tutanak" her zaman erisilebilir -> `/reports/new` | `ReportListPage` FAB/buton (`app.css` `.report-list__new`) | `ReportListPage.spec.tsx` "yuklenirken/hata durumunda da gorunur", "+ Yeni Tutanak /reports/new'e goturur"; `ReportListPage` gorsel sozlesme testi (FAB sabit + md'de ust-sag) |
| 8. Karta tiklamak `/reports/:id` acar | `ReportCard.tsx` (`Link`) | `ReportListPage.spec.tsx` "karta tiklayinca detay sayfasi acilir"; `ReportCard.spec.tsx` |

## Alinan Kararlar ve Gerekceler
- **Sayfalama kontrolu = onceki/sonraki + "Sayfa X / Y".** design.md §4.5 `Pagination` "sayfa numarasi/ok
  butonlari" diyor; numara butonlari `total` buyudukce sinirsiz DOM uretecegi icin ok butonlari + sayfa
  gostergesi secildi (sabit maliyet). Tek sayfa varken (`pageCount <= 1`) kontrol hic render edilmez.
- **`pageSize` istekte gonderilmez.** Sozlesme varsayilani 20'dir ve kriter 5 sayfalamayi *yanittaki*
  degerlere gore kurmayi istiyor; istemcinin ayri bir varsayilan tasimasi iki dogruluk kaynagi yaratirdi.
- **Debounce sadelesmesi:** `useDebouncedValue` genel bir hook olarak `src/hooks/` altina kondu (CLAUDE.md
  §1 klasor agacinda `hooks/` bu is icin var); arama kutusu icin ayri bir `SearchInput` bileseni
  yazilmadi — tek `input` icin sarmalayici bilesen desen susu olurdu (§7.1).
- **Arama degisince sayfa 1'e doner.** Aksi halde 3. sayfadayken yazilan terim bos sonuc dondurup
  kullaniciyi yanlis "sonuc bulunamadi" durumunda birakirdi.
- **`shouldRetryReportList` yerel olarak yazildi** (useTemplates'teki ayni politikanin kopyasi):
  ortak bir yardimciya cikarmak T-019'un dosyasini refactor etmek olurdu (kapsam disi).
- **Bos/eksik govdeye karsi savunma:** `data?.items ?? []` — sozlesme disi yanitta sayfa cokmez,
  bos durum gosterilir (ReportCreatePage'deki savunmaci bos liste yaklasimiyla ayni).
- **Durum rozeti etiketleri** Turkce sabittir (`Taslak`/`Paylasildi`/`Onaylandi`) ve renkleri design.md
  §4.5 `StatusChip` satirindan gelir: draft notr (`surface-muted`/`text`), shared `primary`/`surface-muted`,
  approved `success`/`on-success`.

## Varsayimlar
- Ekranin kart tiklamasi tum karti kapsayan tek bir `Link`tir; design.md ayri bir "detay" butonu istemiyor.
- Arama kutusuna `maxLength=100` konuldu (sozlesmedeki `q` ust siniri) — sunucudan 400 almak yerine
  girdi kaynaginda sinirlanir.
- 401 yerel olarak ele alinmaz (ticket teknik notu): `client.ts` -> `onUnauthorized` + `RequireAuth`
  zinciri devrededir; bu ekranda 401 icin ayri bir dal yazilmadi.

## Anayasa (CLAUDE.md) Bosluklari
- Yok. (Tasarim sozlesmesi boslugu: `design-tokens.json` tipografi olceginde "Kucuk/Caption ~13px"
  adiminin token karsiligi yok; mevcut kodda oldugu gibi `0.8125rem` design.md §4.2'den birebir alindi.
  Golge degerleri de token'da degil, design.md §4.4 prose kuralindan alindi — orada "sabit degerler
  dev tarafindan CSS'te uygulanir" yaziyor.)

## Bilinen Sinirlamalar
- Sayfalamada dogrudan sayfa numarasina atlama yok (ok butonlari + gosterge).
- `md` (768px) ustunde 2 kolonlu kart izgarasi uygulandi (design.md'de "zorunlu degil" kademeli iyilestirme).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `ReportDetailPage` hala tutanak detayini cekmiyor (`h1` sabit "Tutanak", `canAddPhoto` sabit `true`);
  liste ekranindan gelen kullanici detayda baslik/durum goremiyor. Kendi ticket'inda ele alinmali.
- `npm run typecheck` api workspace'inde `Cannot find module 'resend'` veriyor: bu worktree'de
  `node_modules` yok, cozumleme ana checkout'un (T-001 donemi) `node_modules`'una dusuyor ve orada
  `resend` kurulu degil. Kaynak kodla ilgisi yok, T-021 kapsaminda dokunulmadi; web workspace
  typecheck'i ve tum test paketleri temiz kosuyor.

## Test Kosum Ciktisi (ozet)
```
apps/web  : Test Suites: 47 passed, 47 total | Tests: 337 passed, 337 total
            (ReportListPage.tsx, ReportCard.tsx, StatusChip.tsx, Pagination.tsx,
             useReports.ts, useDebouncedValue.ts, reports.api.ts -> %100 satir kapsami)
apps/api  : Test Suites: 55 passed, 55 total | Tests: 360 passed, 360 total (regresyon)
kok tools : Test Suites:  5 passed,  5 total | Tests:  25 passed,  25 total (regresyon)
eslint apps/web/src --max-warnings=0 : 0 uyari
prettier --check                      : temiz
web typecheck (tsc --noEmit)          : temiz
web build (vite)                      : 95.25 kB gz (butce <=250 kB gz)
```
