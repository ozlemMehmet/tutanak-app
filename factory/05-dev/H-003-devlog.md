# Devlog — H-003

> Uretici: dev-agent | Branch: ticket/H-003 | Tarih: 2026-08-17

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Kullanici hicbir sey yapmadan, webhook geldikten sonra ekran EN GEC bir yoklama araligi icinde `Aboneliginiz aktif`'e gecer | `useSubscriptionAutoRefresh.ts` — `pending` iken `setTimeout` zinciriyle `refresh()` (`GET /me`) cagrisi | `SubscriptionPage.spec.tsx` › "kullanici hicbir sey yapmadan webhook gelince ekran otomatik olarak aktife gecer (kriter 1)" — `/me` once `pending`, sonra `active` doner; yalnizca ilk aralik ilerletilir |
| 2. `pending`'de HER ZAMAN gorunur/tiklanabilir "Durumu yenile"; tiklaninca `GET /me` tekrar cagrilir | `SubscriptionPage.tsx` — `pending` dali `<div class="banner banner--warning">` + `.button--ghost` "Durumu yenile" (`disabled` yok) | `SubscriptionPage.spec.tsx` › "...tiklaninca GET /me tekrar cagrilir (kriter 2)" ve "...tukendikten sonra da tiklanabilir kalir (kriter 2 + 4)" |
| 3. Artan aralik + makul ust sinir; `active`'e gecince yoklama DURUR | `SUBSCRIPTION_POLL_DELAYS_MS` (3/5/8/12/15/20/25 sn, toplam 88 sn) + `isAwaitingPayment` false olunca effect temizligi | `useSubscriptionAutoRefresh.spec.tsx` › "araliklar artandir", "toplam butce 60-90 sn", "her aralik sonunda tam bir kez", "pending bittiginde durur", "ust sinira ulasinca yeni cagri yapmaz"; `SubscriptionPage.spec.tsx` › "aktiflesince yoklama durur", "ust sinirda durur (1 + adim sayisi cagri)" |
| 4. Ust sinirda mesaj degisir: odeme alindiysa/alinmadiysa ne olacagi soylenir | `SubscriptionPage.tsx` — `PENDING_TIMEOUT_MESSAGE` + `isPollExhausted` | `SubscriptionPage.spec.tsx` › "sonraki adim mesajini gosterir (kriter 4)" (+ sinir durumu: son adimdan once mesaj DEGISMEZ) |
| 5. Regresyon: `inactive` / `active` dallari + checkout 502/409 banner'lari | Bu dallara dokunulmadi | T-022'den gelen mevcut testler (kriter 2/4/6/7) degistirilmeden gecti |
| 6. Regresyon: `visibilitychange` ve `?checkout=return` korunur | Iki `useEffect` aynen korundu, yoklama EK effect olarak eklendi | T-022'den gelen "?checkout=return ile acilinca...", "donus parametresi yokken...", "sekme yeniden gorunur olunca..." testleri degistirilmeden gecti |

## Alinan Kararlar ve Gerekceler
- **Yoklama, mevcut hook'un ICINE eklendi** (yeni hook acilmadi): tetikleyicilerin tamami tek yerde
  toplanir ve sayfa tek bir sozlesme ile calisir; ticket'in kok-neden bolgesi de bu dosya.
- **`setInterval` degil, adim adim yeniden planlanan `setTimeout`**: aralik artan oldugu icin sabit
  periyot uymuyor; ayrica her adimda tek bir zamanlayici yasar, `pending` bitince effect temizligi
  bekleyen adimi iptal eder (sonsuz cagri riski yapisal olarak yok).
- **Aralik cizelgesi kodda sabit (`SUBSCRIPTION_POLL_DELAYS_MS`), env'den okunmuyor:** CLAUDE.md §5.1
  tablosu yalnizca API tarafi yapilandirmasini tanimlar, web tarafi icin karsilik yoktur ve tabloya
  anahtar eklemek dev yetkisinde degildir (§5.1 son cumle). Deger istemci UX zamanlamasidir, sir
  degildir; testler cizelgeyi ice aktarip degismezlerini (artan olmasi, 60-90 sn butce) dogrular.
- **Toplam butce 88 sn** (3+5+8+12+15+20+25): kriterdeki "~60-90 sn" araliginin ust ucuna yakin,
  webhook gecikmesine genis pay birakir; ilk aralik 3 sn (kriterdeki "birkac saniyede bir baslar").
- **Ust sinirda ekran metni degisir, buton kalir:** `pending` dali artik `<p>` degil banner + aksiyon;
  kod tabanindaki mevcut desen (T-022'deki `GET /me` hata banner'i: banner + `.button--ghost`
  "Tekrar Dene") birebir kopyalandi — yeni CSS sinifi/ham deger eklenmedi.
- **Yoklama tukendikten sonra "Durumu yenile" yoklamayi YENIDEN BASLATMAZ**, yalnizca tek bir
  `GET /me` yapar. Gerekce: kriter yalnizca "tiklaninca `GET /me` cagrilir" diyor; otomatik yeniden
  baslatma butceyi fiilen sinirsiz kilar. (Durum `pending` disina cikip tekrar `pending` olursa
  cizelge sifirlanir — bu ayrica testlendi.)
- **Verimlilik oz-kontrolu:** sicak yolda ic ice dongu/O(n^2) yok; yoklama toplam **7** ek `GET /me`
  cagrisiyla sinirlidir ve yalnizca `pending` ekrani acikken calisir; `active`/`inactive` durumlarinda
  hic zamanlayici kurulmaz.

## Varsayimlar
- Webhook gecikmesi tipik olarak saniyeler mertebesindedir (ticket'in kendi tespiti); bu yuzden
  cizelge basta sik, sonra seyrektir.
- `GET /me` yaniti tek dogruluk kaynagidir; istemci `pending -> active` gecisini yalnizca bu yanittan
  ogrenir (backend'e dokunulmadi, ticket kapsam disi).

## Anayasa (CLAUDE.md) Bosluklari
- **Web tarafi zamanlama sabitleri icin yapilandirma yeri tanimli degil.** §5.1 tablosu API
  yapilandirmasini kapsiyor, `VITE_` tarafinda yalnizca "API tabani/uygulama URL'i" ornekleniyor.
  Yoklama cizelgesi bu yuzden modul sabiti olarak yazildi (en yakin mevcut kalip: `MAX_RETRY_COUNT`
  `useCurrentUser.ts`'te modul sabiti).
- **Tasarim sozlesmesi boslugu:** `design.md` SubscriptionPage sartnamesinde `pending` icin yalnizca
  "bilgi metni + buton gizli/disabled" tanimli; H-003'un istedigi "elle yenileme eylemi" ve
  "yoklama tukendi" durumu sartnamede YOKTUR. Ticket bagladigi icin eklendi; gorsel degerler yalnizca
  mevcut token tabanli siniflardan (`banner--warning`, `button--ghost`) geldi, ham hex/px yazilmadi.
  Sartname bu iki durumla guncellenmelidir (architect kararidir, dokunulmadi).

## Bilinen Sinirlamalar
- Yoklama yalnizca sayfa acikken calisir; kullanici sekmeyi kapatirsa durum guncellemesi olmaz
  (`visibilitychange` tetikleyicisi geri donuste devreye girer).
- Yoklama sirasinda `GET /me` hata donerse ekran mevcut `pending` metninde kalir ve cizelge devam
  eder; ayri bir "yoklama basarisiz" gostergesi eklenmedi (kriterlerde yok, kapsam disi).
- Butce tukendikten sonra otomatik kontrol yoktur; kullanici "Durumu yenile" ile ilerler (bilincli
  karar, yukarida).

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `SubscriptionPage.tsx` `errorMessageOf` fonksiyonunun son satiri (Error olmayan reddetme) test
  kapsaminda degil (coverage raporunda satir 41). H-003 oncesinden gelen bir bosluk, dokunulmadi.
- `PENDING_TIMEOUT_MESSAGE` metni ASCII-katlanmis Turkce yaziyor (kod tabaninin genelindeki mevcut
  durum); B-002 kapsaminda ele alinacagi ticket'ta yazili.

## Test Kosum Ciktisi (ozet)
```
$ npm test            # kok + apps/api + apps/web
Test Suites: 10 passed, 10 total   (kok)
Tests:       68 passed, 68 total
Test Suites: 56 passed, 56 total   (apps/api)
Tests:       377 passed, 377 total
Test Suites: 56 passed, 56 total   (apps/web)
Tests:       422 passed, 422 total

$ npm run typecheck   -> temiz (kok + api + web)
$ npm run lint        -> eslint . --max-warnings=0, 0 hata/0 uyari
$ npm run format:check-> All matched files use Prettier code style!
```
