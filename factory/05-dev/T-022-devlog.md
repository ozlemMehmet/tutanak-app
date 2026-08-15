# Devlog — T-022

> Uretici: dev-agent | Branch: ticket/T-022 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: `/subscription` acilinca `GET /me` cagrilir; durum karti + rozet (inactive notr / pending uyari / active basari) | `pages/SubscriptionPage.tsx` (mevcut `useCurrentUser` hook'unu tuketir), `features/billing/SubscriptionStatusCard.tsx` | `SubscriptionPage.spec.tsx` "acilinca GET /me cagrilir", `SubscriptionStatusCard.spec.tsx` uc durum rozet tonu |
| K2: `inactive` iken "Odeme Yap" aktif; tiklaninca `POST /billing/checkout` + `checkoutUrl`'e TAM SAYFA yonlendirme | `features/billing/billing.api.ts` (`startCheckout`), `useStartCheckout.ts`, `checkout-redirect.ts` | `billing.api.spec.ts`, `checkout-redirect.spec.ts` (`location.assign`, yeni sekme yok), `SubscriptionPage.spec.tsx` (yonlendirme + `window.open` cagrilmadi) |
| K3: `pending` iken bilgi metni + odeme butonu yok/disabled | `SubscriptionPage.tsx` durum dallanmasi | `SubscriptionPage.spec.tsx` "pending durumunda bilgi metni gosterir, odeme butonu gostermez" |
| K4: `active` iken "Aboneliginiz aktif" + `currentPeriodEnd` okunur bicimde; buton yok | `SubscriptionPage.tsx` + `SubscriptionStatusCard.tsx` (`lib/format-timestamp`) | `SubscriptionPage.spec.tsx` "active durumunda ...", `SubscriptionStatusCard.spec.tsx` tarih bicimi |
| K5: `?checkout=return` veya sekme gorunurlugu ile `GET /me` otomatik yeniden cekilir | `features/billing/useSubscriptionAutoRefresh.ts` | `SubscriptionPage.spec.tsx` "?checkout=return ile acilinca /me yeniden cekilir" + "sekme gorunur olunca /me yeniden cekilir" |
| K6: Checkout 502 `PAYMENT_PROVIDER_ERROR` -> "Odeme saglayicisina ulasilamadi, tekrar deneyin" banner'i | `SubscriptionPage.tsx` hata banner'i (kod ile dallanma, mesajla degil) | `SubscriptionPage.spec.tsx` "502 ... banner gosterir" |
| K7: Checkout 409 `SUBSCRIPTION_ALREADY_ACTIVE` -> bilgi banner'i + `GET /me` yeniden cekilir | `useStartCheckout.ts` `onError` -> `invalidateQueries(currentUserQueryKey)`, `SubscriptionPage.tsx` banner | `SubscriptionPage.spec.tsx` "409 ... bilgi banner'i gosterir ve /me yeniden cekilir" |

## Alinan Kararlar ve Gerekceleri
- **Abonelik durumu icin YENI sorgu acilmadi; mevcut `useCurrentUser` (`GET /me`) tuketildi.** Ayri bir `useSubscription` hook'u ayni endpoint icin ikinci bir onbellek anahtari uretir, AppShell ile sayfa arasinda tutarsiz durum dogururdu. 409 sonrasi tazeleme de bu tek anahtari (`currentUserQueryKey`) gecersiz kildigi icin kabuk ve sayfa ayni anda guncellenir.
- **Tam sayfa yonlendirme `checkout-redirect.ts` icinde tek satirlik bir sarmalayici.** `window.location.assign` dogrudan bilesende cagrilsaydi test edilemezdi (jsdom'da `location` yamalanmiyor). Hedef nesne parametre olarak alinir, varsayilani `window.location`'dir; sayfa da `redirect` prop'u ile ayni enjeksiyonu tekrarlar (mevcut `client` prop'u ile ayni konvansiyon). Yeni sekme (`window.open` / `target="_blank"`) hem testte hem kodda disarida birakildi — design.md gerekcesi mobil pop-up engelleme.
- **Hata dallanmasi KOD ile yapiliyor, mesaj metniyle degil** (CLAUDE.md §4.3): `isApiErrorWithCode(error, PAYMENT_PROVIDER_ERROR|SUBSCRIPTION_ALREADY_ACTIVE)`. Banner metinleri kriterden birebir alindi; sunucu mesaji yalnizca sozlesmede tanimli OLMAYAN hatalarda gosteriliyor (§4.5 "kullaniciya `error.message` gosterilir").
- **Renk tonu secimi design.md §4.1'in baglayici kuralindan:** 502 akisi BLOKE ediyor -> `danger`; `pending` ve "zaten aktif" akisi durdurmuyor, alternatifi var -> `warning`. Rozet tonlari da ayni tablodan (inactive notr `surface`/`text-muted`, pending `warning`, active `success`).
- **Otomatik tazeleme iki tetikleyicili tek hook** (`useSubscriptionAutoRefresh`): `?checkout=return` (ayni sekmede donus) + `visibilitychange` (baska sekmede/uygulamada odeme yapilip geri donuldugunde parametre gelmeyebilir). Dinleyici bir kez baglanir; `refresh` kimligi `useRef` ile tasinir, aksi halde her render'da dinleyici sokulup takilirdi.
- **Kriter 5 testi onbellege tohum ekleyerek yazildi.** Ilk kirmizi turda "parametre ile 2 cagri" beklentisi kirildi: kok neden, mount aninda zaten ucusta olan sorgunun `refetch()`'i TanStack Query'nin ayni anahtar icin cagriyi birlestirmesi (dedupe) nedeniyle yutmasi. Bu davranis kullanici acisindan dogrudur (veri zaten taze). Bu yuzden test, tetikleyiciyi yalniz basina gozleyecek sekilde kuruldu: onbellekte `staleTime: Infinity` ile taze durum varken parametresiz acilista **0**, `?checkout=return` ile **1** `GET /me` cagrisi beklenir. Testi zayiflatmak degil, dogru davranisi olcmek icin degistirildi; parametresiz durum ayri bir regresyon testi olarak sabitlendi.
- **Tutar sunucudan gelen METIN olarak gosteriliyor** (`199.00 TRY`), `parseFloat`/`Number` yok (CLAUDE.md §5.1); istemci tarafinda tutar/para birimi uretilmiyor ve checkout govdesi gonderilmiyor (sozlesmede istek govdesi yok).
- **Yeni desen icat edilmedi:** sayfa veri cekmeyi hook'lara devrediyor (§3.9), gorsel degerlerin tamami `tokens.css` degiskenlerinden. Tek token disi deger Elevation 1 golgesi (`0 1px 2px rgb(0 0 0 / 6%)`) — design.md §4.4'te "token'a dahil degil, prose kural" olarak birebir verilmis; yerinde gerekcelendirildi.
- **Commit bicimi CLAUDE.md §2'deki Conventional Commits + ticket kimligi** kaliba gore yazildi (`feat(billing): T-022 ...`); anayasa ustunlugu kurali geregi.

## Varsayimlar
- Rozet etiketleri (`Pasif` / `Beklemede` / `Aktif`) sartnamede metin olarak verilmemis; durum adlarinin Turkce karsiliklari kullanildi. Bilgi metinleri (`Odeme sonucu bekleniyor, abonelik henuz aktif degil`, `Aboneliginiz aktif`) kriterden BIREBIR alindi.
- `currentPeriodEnd` "okunur tarih bicimi" icin mevcut `lib/format-timestamp` (tr-TR kisa tarih-saat) yeniden kullanildi; ekrana ozel yeni bicimleyici yazilmadi.
- Donus parametresi (`?checkout=return`) URL'de birakiliyor; temizlenmesi (replace ile) sartnamede istenmedigi icin yapilmadi — parametre yalnizca mount'ta bir kez tetikliyor.

## Anayasa (CLAUDE.md) Bosluklari
- **Tasarim sozlesmesi boslugu — "info" tonu yok.** design.md §4.5 `Banner` varyantlari arasinda `info` sayiliyor ama `design-tokens.json`'da `info` rengi YOK. Renk uydurulmadi: §4.1'in baglayici kurali ("akisi durdurmayan durum = `warning`") uygulanip en yakin token (`warning`) kullanildi (409 bilgi banner'i ve `pending` bilgi metni).
- **Tasarim sozlesmesi boslugu — `GET /me` hata durumu tanimsiz.** SubscriptionPage sartnamesinin `error` durumu yalnizca checkout 502/409'u tanimliyor; `/me` basarisiz olursa gosterilecek ekran tarif edilmemis. "Sartname varken durum icat etme" kurali geregi yeni bir hata ekrani YAZILMADI: 401 zaten global olarak `/login`'e goturuyor, diger hatalarda sayfa yalnizca basligi gosteriyor. Sartname adayi: "SubscriptionPage: `/me` hata durumu -> tekrar dene butonlu banner".

## Bilinen Sinirlamalar
- `visibilitychange` tetikleyicisi durum `active` iken de calisiyor: kullanici sekmeye her donduğunde bir `GET /me` yapilir. Sartname durum ayrimi yapmadigi icin kosul eklenmedi; maliyet tek ve kucuk bir istek, TanStack Query es zamanli cagrilari birlestiriyor.
- Odeme sonrasi durum guncellemesi webhook'un islenmis olmasina baglidir: kullanici saglayicidan cok hizli donerse `GET /me` hala `pending` dondurebilir; ekran bunu dogru sekilde "odeme sonucu bekleniyor" olarak gosterir, ayrica bir yoklama (polling) EKLENMEDI (sartnamede yok).
- Checkout butonu istek suresince `disabled` olur (design.md §4.5 Button loading durumu); ayri bir spinner ogesi eklenmedi (ikon kutuphanesi yok).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `apps/api` bu ticket'ta hic degistirilmedi; T-017 devlog'unda not edilen `infra/email` lint durumu (worktree'de `resend` paketi kurulu olmadigi icin) hala ayni sekilde ortamsaldir. `apps/web` kapsaminda lint 0 hata / 0 uyari.
- `MeResponse.subscription.priceAmount` yalnizca checkout sonrasi doluyor; `inactive` durumda fiyat sunucudan gelmedigi icin ekran "Odeme Yap" butonunun yaninda tutar GOSTEREMIYOR (sozlesme boslugu; T-012/api-contract kapsami, dokunulmadi).

## Test Kosum Ciktisi (ozet)
```
apps/web (jest, coverage acik):
  Test Suites: 31 passed, 31 total
  Tests:       181 passed, 181 total   (T-022 oncesi: 158 -> +23 test)
  Yeni dosyalar: features/billing/{billing.api,checkout-redirect,useStartCheckout,
    useSubscriptionAutoRefresh}.ts, SubscriptionStatusCard.tsx, pages/SubscriptionPage.tsx
    -> hepsi %100 satir kapsami; global lines %98.6 (esik %80)

kok (tools) jest: 5 suites / 25 tests passed
npx tsc --noEmit -p apps/web/tsconfig.json          -> TEMIZ
npx eslint apps/web/src --max-warnings=0            -> TEMIZ (0 uyari)
npx prettier --check "apps/web/src/**/*.{ts,tsx,css}" -> TEMIZ
npm run build --workspace @tutanak/web              -> basarili (PWA precache 7 entries)
```
