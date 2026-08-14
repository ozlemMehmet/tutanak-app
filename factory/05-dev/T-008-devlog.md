# Devlog — T-008

> Uretici: dev-agent | Branch: ticket/T-008 | Tarih: 2026-08-14

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: Sahibi olunan tutanak icin paylasim linki istegi 201 + benzersiz, tahmin edilemez token/URL doner | `modules/sharing/sharing.controller.ts` `POST /reports/{reportId}/share-link` -> `share-link.service.ts#issueShareLink` -> `sharing.repository.ts#getOrCreateShareLink` (INSERT + ayni transaction icinde `draft`->`shared` gecisi, §3.10) -> token `share-token.generator.ts` (32 bayt entropi, base64url) -> `mappers/share-link.mapper.ts#toShareLinkDto` | e2e `test/sharing.e2e-spec.ts`: "sahip olunan tutanak icin 201 + benzersiz base64url token ve /t/{token} URL doner", "iki farkli tutanagin tokenlari farklidir", "basarili istekte draft -> shared olur"; birim `share-token.generator.spec.ts` (uzunluk/alfabe/benzersizlik, §8.1) |
| K2: Link, kimlik dogrulamasi olmadan erisilebilir genel URL formatindadir (`/t/:token`, bkz. T-009) | `share-link.mapper.ts#buildShareUrl`: `url` her zaman `<PUBLIC_APP_URL>/t/<token>`; genel goruntuleme endpoint'inin kendisi T-009 kapsami | e2e: url birebir `/t/{token}` dogrulanir; birim `share-link.mapper.spec.ts` |
| K3: Ayni tutanak icin ikinci istek AYNI aktif linki doner (yeni token uretilmez) | `sharing.repository.ts#getOrCreateShareLink`: once INSERT, P2002 (`share_links_report_id_key`) yakalaninca mevcut satir okunur (§7 "unique kisit + get-or-create"); `GET .../share-link` mevcut linki doner | e2e (§8.2 zorunlu idempotans a): "ikinci POST ayni token'i doner ve tabloda tek satir kalir"; birim `sharing.repository.spec.ts` (P2002 dali), `share-link.service.spec.ts` |
| K4: E-posta gonderim istegi 200/202 doner; durum (sent/failed) yanitta belirtilir | `POST .../share-link/email` (202) -> `share-link.service.ts#sendShareEmail`: link yoksa 404 `SHARE_LINK_NOT_FOUND` (link URETMEZ, §3.10); `infra/email` `EmailPort` + `ResendEmailAdapter` + `FakeEmailAdapter` (§7); basarisizlik istisna DEGIL (§4.2.2): `share_deliveries` `failed`+`error_message` yazilir, 202 + `status: failed` doner | e2e: sent/failed/404/400 (+alan hatasi)/beyaz liste disi alan/durum degismezligi; birim `share-link.service.spec.ts`, `resend-email.adapter.spec.ts`, `fake-email.adapter.spec.ts` |
| K5: WhatsApp icin paylasim linkini iceren onceden doldurulmus `wa.me` URL'si uretilir | `whatsapp-link.builder.ts` (saf fonksiyon, §7 Builder): `https://wa.me/?text=<encoded>`; `ShareLink.whatsAppUrl` alaninda doner, teslim kaydi URETMEZ (sozlesme) | birim `whatsapp-link.builder.spec.ts` (host/encode/link icerigi); e2e "whatsAppUrl wa.me tabanlidir ve paylasilan linki icerir" |
| K6: Var olmayan veya baskasina ait tutanak icin 403/404 doner | `share-link.service.ts#assertOwnership` guard clause (§3.8): kayit yok -> `NotFoundError`, baskasina ait -> `ForbiddenError`; uc endpoint'te de ilk is | e2e: 404 (bilinmeyen + bicimsiz id), 403, 401 senaryolari; birim `share-link.service.spec.ts` |
| Web (architecture.md §10 T-008 satiri: "apps/web paylasim ekrani") | `features/sharing/`: `sharing.api.ts`, `useShareLink.ts`, `SharePanel.tsx` (link kutusu + kopyala + WhatsApp + e-posta formu; e-postadan ONCE her zaman idempotent POST share-link — design.md ReportDetailPage is kurali); `ReportDetailPage`'e panel eklendi | `SharePanel.spec.tsx` (link uretimi, kopyala, wa.me anchor, sent/failed — failed WARNING tonunda, link hatasi banner + Tekrar Dene, cagri sirasi), `sharing.api.spec.ts` |

## Alinan Kararlar ve Gerekceler
- **Katman zinciri onceki ticketlarla ayni:** Controller -> Service -> Repository -> Prisma + saf mapper (§3.1-§3.5); sahiplik kontrolu icin tutanagin asgari alanlarini `sharing.repository` kendisi okur (photos.repository ile ayni desen — modul grafi dongusuz kalir, reports modulune bagimlilik eklenmedi).
- **Idempotans birincil olarak DB'de (§7):** once `INSERT` denenir, P2002 yakalaninca mevcut satir okunur; "SELECT sonra INSERT" yarisi yapisal olarak imkansiz. `draft`->`shared` gecisi link INSERT'i ile AYNI interaktif transaction icinde ve KOSULLU `updateMany`(status=draft) ile yapilir — `shared`/`approved` korunur, geri gecis yok (§3.10). P2002 dalinda gecis hic calismaz (link zaten vardi, durum zaten shared/approved).
- **EmailPort sonucu deger olarak doner, firlatmaz:** §4.2.2 "e-posta gonderimi istisna DEGILDIR" kuralinin dogal karsiligi `EmailSendResult = sent | failed` birlesimidir; boylece serviste try/catch akisi yerine tek kod yolu var, `ExternalServiceError` uretilmesi tip duzeyinde imkansiz. Adapter hata mesajlari kullaniciya gosterilebilir Turkce OZETTIR; saglayicinin ham yaniti (anahtar/stack icerebilir) yanita ve `share_deliveries.error_message`'a sizmaz (§4.3, data-model "ozetlenmis" notu).
- **E-posta endpoint'i get-or-create YAPMAZ** (§3.10 baglayici sonucu): link yoksa 404 `SHARE_LINK_NOT_FOUND`; e2e bununla birlikte "hicbir link satiri olusmadi + durum draft kaldi" dogrulamasini da yapar.
- **`resend@^4` eklendi:** §6.1 tablosunda tanimli (resend 4.x); `npm audit --audit-level=high` temiz kaldi (mevcut 4 moderate iyzipay zincirinden, high esiginin altinda). Adapter SDK'nin dar bir yuzeyini (`ResendLikeClient`) gorur; birim testte sahtelenir, gercek ag cagrisi yok (§8.1).
- **Token ureteci saf fonksiyon:** `generateShareToken` (32 bayt `crypto.randomBytes`, base64url -> 43 karakter, DDL CHECK 32..128 icinde). Ayri sinif/DI kurmadim — tek implementasyon, durum yok (§3.3 abartma yasagi; §7 Factory satiri "token uretiminde" saf uretici fonksiyonla karsilanir).
- **Web'de e-posta gonderiminden once idempotent `POST share-link`** (design.md ReportDetailPage "is kurali"): `useSendShareEmail` mutation'i once linki uretir/getirir, sonra e-postayi gonderir; `404 SHARE_LINK_NOT_FOUND` kullaniciya hicbir zaman yansimaz. `failed` sonucu WARNING tonunda inline mesajdir (danger degil) ve design.md'deki metni birebir tasir.
- **Gorsel degerler yalnizca tokens.css degiskenlerinden** (`--color-warning`/`--color-on-warning`, spacing/radius); ham hex/keyfi px eklenmedi (44px dokunma hedefi mevcut app.css istisnasinin devami, design.md §5).
- **Verimlilik:** her endpoint sabit sayida sorgu kosar (sahiplik SELECT + link INSERT/SELECT [+ delivery INSERT]); dongude DB/HTTP cagrisi, sayfalamasiz cekis, ic ice dongu yok. Paylasim linki uretimi tek gidis-donuslu transaction'dir (performans butcesi ≤250 ms icin uygun).

## Varsayimlar
- `share_links`/`share_deliveries` tablolari T-002 migration'inda mevcut (dogrulandi; yeni migration gerekmedi).
- Genel `/t/:token` goruntuleme ucu (T-009) bu ticket'ta YAZILMAZ; K2 "URL formati" olarak dogrulanir (ticket metni de "bkz. T-009" der).
- `wa.me/?text=...` bicimi "onceden doldurulmus wa.me URL'si" kriterini karsilar (alici telefon numarasi PRD'de yok; numarasiz paylasim URL'si WhatsApp'in belgelenmis bicimidir).

## Anayasa (CLAUDE.md) Bosluklari
- **§5 ile §10 celiskisi (RESEND_API_KEY):** §5 "diger tum sirlar her ortamda zorunludur" derken §10 `docker compose up`'in hicbir dis hesap/anahtar olmadan calismasini kabul kriteri yapar ve `.env.example` bu anahtari bos tasir. Anahtar zorunlu olsaydi yerel kurulum HIC ACILMAZDI. Secim: `RESEND_API_KEY` istege bagli (bos metin = tanimsiz); anahtar yokken gonderim denemesi §4.2.2 geregi 202 + `status: failed` olarak yanita yansir, uygulama acilir. Kod yorumu `env.schema.ts`'te; `.env.example` aciklamasi guncellendi. Retrospektif adayi: §5 listesine iyzico benzeri kosullu istisna cumlesi.
- **Mailpit fiilen baglanamiyor:** architecture.md yerel karsilik olarak "Mailpit container" der, ama e-posta siniri Resend HTTP API'sidir (§6.1'de SMTP istemcisi yok) ve §5.1'de `EMAIL_PROVIDER` benzeri bir secim anahtari tanimli degil — dev anahtar ICAT ETMEZ (§5.1 son cumle). Bu yuzden yerel compose'ta e-posta mailpit'e DUSMEZ; anahtar tanimsizsa gonderim `failed` olarak raporlanir (akis kirilmaz, wa.me/kopyalama calisir). Retrospektif adayi: ya mailpit'i konusturacak bir secim anahtari/adapteri tanimlanmali ya da mailpit compose'tan cikarilmali.

## Bilinen Sinirlamalar
- Genel goruntuleme sayfasi (`/t/:token`, `PublicReportPage`) yok — T-009 kapsami; uretilen link su an 404'e gider (beklenen, bagimlilik sirasi geregi).
- `SharePanel` linki panoya `navigator.clipboard` ile kopyalar; guvenli olmayan baglamda (http + LAN IP) tarayici API'yi vermeyebilir — kullanici linki kutudan elle secebilir. Design.md bu durum icin ayri bir sartname tanimlamiyor.
- Gercek Resend hesabiyla uctan uca gonderim QA "komsulu" modunda dogrulanacak (ticket teknik notu); testler `FakeEmailAdapter` + adapter birim testleriyle sinirli (§8.1 geregi ag cagrisi yok).
- Kopyalama durumu ("Kopyalandi") link degisince sifirlanmaz — link ayni oturumda degismedigi (idempotent) icin pratik etkisi yok.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- T-006 devlog'unun onerdigi ortak `setupTestEnv()`/jest `setupFiles` yardimcisi hala yok; zorunlu env anahtarini her suite'e elle ekleme isi bu ticket'ta da tekrarlandi (bilgi tabani dersi `testing/zorunlu-env-anahtari-tum-e2e-suitleri.md` uygulanarak TUM suite'ler ayni commit'te guncellendi). Retrospektif adayi.
- `payment.module.ts` icinde sabit `IYZICO_API_URI` anayasa boslugu notu duruyor (T-012'nin notu) — dokunulmadi.

## Test Kosum Ciktisi (ozet)
```
# 1) ONCE KIRMIZI (uygulama dosyalari yokken):
api birim: Test Suites: 9 failed (Cannot find module './share-link.service' / './fake-email.adapter' ...;
           env.schema.spec yeni EMAIL_FROM/RESEND_API_KEY beklentileriyle kirmizi)
web birim: FAIL SharePanel.spec.tsx / sharing.api.spec.ts (Cannot find module)

# 2) Uygulama yazildiktan sonra YESIL:
npm test           -> kok 25 + api 270 + web 62 = 357 test, tum suite'ler gecti
                      (coverage esikleri: api modules/ >=80, repo >=70 — gecti)
npm run test:e2e   -> CI paritesi: env -i, YALNIZCA DATABASE_URL ile TAM paket:
                      Test Suites: 10 passed, Tests: 152 passed
                      (yeni test/sharing.e2e-spec.ts: 22 test; gercek Postgres,
                       FakeEmailAdapter override, EMAIL_FROM tum suite'lere eklendi)
npm run lint       -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck  -> temiz (kok + api + web)
npm run format:check -> temiz
npm run build      -> api tsc + web vite (PWA precache) basarili
npm audit --audit-level=high -> yuksek/kritik bulgu yok (4 moderate: mevcut iyzipay zinciri)
```
