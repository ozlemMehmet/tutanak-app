# Devlog — T-017

> Uretici: dev-agent | Branch: ticket/T-017 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayan kod | Karsilayan test |
|---|---|---|
| K1: Router `design.md` §1'deki TUM rotalari tanimlar (`/login`, `/register`, `/reports`, `/reports/new`, `/reports/:id`, `/subscription`, `/t/:token`) | `router.tsx` tam rota haritasi + yer tutucu sayfalar (`LoginPage`, `RegisterPage`, `ReportListPage`, `ReportCreatePage`, `SubscriptionPage`) | `router.spec.tsx` → "rota haritasi" bloğu: 7 rotanin her biri + kok adres (8 test) |
| K2: Token YOKKEN korumali rotada `/login`'e yonlendirme + hedef `redirectTo` olarak korunur | `components/RequireAuth.tsx` (guard clause + `<Navigate replace>`) | `RequireAuth.spec.tsx` (4 test, sorgu dizesi dahil) + `router.spec.tsx` `it.each` ile 4 korumali rota + "icerigi hic render etmez" |
| K3: Token VARKEN ayni rotalar render edilir ve AppShell `GET /me` e-postasini gosterir | `components/AppShell.tsx`, `features/auth/auth.api.ts`, `features/auth/useCurrentUser.ts` | `AppShell.spec.tsx` (6 test), `router.spec.tsx` "token varken ... e-postasini gosterir", `App.spec.tsx` |
| K4: `/t/:token`, `/login`, `/register` token OLMADAN erisilebilir | `router.tsx` (bu rotalar `RequireAuth` disinda) | `router.spec.tsx`: uc rota token'siz render + "genel rotalarda AppShell (ve /me cagrisi) yoktur"; `PublicReportPage.spec.tsx` App testi |
| K5: Herhangi bir API cagrisi 401 dondugunde oturum temizlenir + `/login`'e yonlendirilir | `api/client.ts` `onUnauthorized` kancasi → `features/auth/session-client.ts` → `session.signOut()` → guard yonlendirir | `client.spec.ts` (4 test), `session-client.spec.ts` (3 test), `router.spec.tsx` "korumali ekranda API 401 ... /login'e yonlendirilir" (uctan uca) |
| K6: AppShell "Cikis" token'i siler, `/login`'e goturur; sonra korumali rotaya donus yine `/login` | `AppShell.tsx` cikis eylemi (`queryClient.clear()` + `session.signOut()`) | `AppShell.spec.tsx` "Cikis eylemi saklanan token'i siler" + `router.spec.tsx` "Cikis ... korumali rotaya donus yine /login'e dusurur" |

## Alinan Kararlar ve Gerekceleri
- **Token saklama yeri `localStorage` (icat degil, mimari karar).** `architecture.md` "Kimlik dogrulama (T-003)" maddesi bunu acikca belirliyor (refresh token yok; XSS riski kati CSP + React kacisi + `dangerouslySetInnerHTML` yasagi ile karsilaniyor). Okuma/yazma/silme tek dosyada (`api/access-token.ts`) toplandi ki anahtar adi tek yerde kalsin.
- **Oturum durumu icin kucuk, abone olunabilir kaynak + `useSyncExternalStore`.** Token React disindan da degisebiliyor (istemcinin 401 kancasi); guard'in bunu aninda gormesi gerek. CLAUDE.md §6.2 Redux/Zustand'i yasakladigi icin ~40 satirlik dahili kaynak yazildi, yeni bagimlilik eklenmedi. Anlik goruntu onbelleklenir (her okumada `localStorage`'a gitmek `useSyncExternalStore`'da sonsuz render dogururdu) — bunun regresyon testi var.
- **Tek yonlendirme noktasi.** 401 kancasi yalnizca oturumu bitirir; `/login`'e goturme isini `RequireAuth` yapar. Boylece yonlendirme mantigi (ve `redirectTo` uretimi) API katmanina sizmaz ve tek yerde kalir — cikis, 401 ve dogrudan URL girisi ayni kod yolunu kullanir.
- **401 kancasi YALNIZCA Authorization basligi gonderilmis isteklerde tetiklenir.** Aksi halde `POST /auth/login` → `401 INVALID_CREDENTIALS` mevcut oturumu silerdi; oysa design.md LoginPage sartnamesinde bu durum "form-genel banner" ile ayni sayfada kalir. Iki test bu ayrimi koruyor.
- **Istemci-oturum baglantisi `features/auth/session-client.ts`'e cikarildi.** `main.tsx` kapsam disi (CLAUDE.md §8.7); kritik "401 → oturumu bitir" davranisi orada kalsaydi testsiz olurdu.
- **`/reports/:reportId` parametre adi korundu.** URL bicimi design.md'deki `/reports/:id` ile birebir ayni; parametre adi `ReportDetailPage`'in mevcut `useParams<{ reportId }>` sozlesmesiyle uyumlu tutuldu — ticket "bu ticket onlari yeniden yazmaz" diyor. Davranis (`/reports/r-1` → detay ekrani) testle dogrulandi.
- **Cikista once `queryClient.clear()`, sonra `signOut()`.** Aksi halde onceki kullanicinin onbellekteki verisi bir sonraki oturumda kisa sure gorunebilirdi.
- **Gorsel degerler yalnizca token'lardan.** AppShell stilleri `tokens.css` degiskenleriyle yazildi; ham hex/keyfi px yok. Iki istisna design.md §5'ten birebir alindi ve yerinde gerekcelendirildi: 44×44px dokunma hedefi ve 2px odak halkasi (mevcut `app.css` ile ayni konvansiyon). `primary` zeminde odak halkasi `on-primary`'ye gecer (§5).

## Varsayimlar
- `redirectTo` sorgu parametresi olarak tasiniyor (`/login?redirectTo=%2Freports%2Fnew`) ve URL-encode ediliyor; design.md adi veriyor ama tasima bicimini belirtmiyor. T-018 bunu okuyup giris sonrasi hedefe donecek.
- Gezinme etiketleri design.md §1'deki AppShell tanimindan alindi: "Tutanaklarim / Yeni Tutanak / Abonelik".
- Yer tutucu ekranlar yalnizca ekran basligini icerir (icerik T-018..T-022); kabuk/rota iskeleti disinda hicbir UI durumu icat edilmedi.

## Anayasa (CLAUDE.md) Bosluklari
- **Istemci tarafi oturum durumu icin desen yok.** Desen Sozlugu (§7) sunucu durumu (TanStack Query) ve dis sistem portlarini kapsiyor; "React disindan degisen istemci durumu" icin karsilik yok. Icat etmek yerine en basit duz cozum (kaynak nesnesi + context + `useSyncExternalStore`) yazildi. Sozluk adayi: *"React disi kaynaktan gelen istemci durumu → abone olunabilir kaynak + `useSyncExternalStore`"*.
- **Tasarim sozlesmesi boslugu (bilgi amacli, bloklayici degil):** design.md §3 ekran sartnameleri AppShell'in kendi durumlarini (yuklenirken/`GET /me` hatasi) tanimlamiyor. Durum icat edilmedi: e-posta yalnizca yanit geldiginde gosteriliyor, kabuk ve ekran icerigi her halukarda render ediliyor (testle sabitlendi). 401 zaten global olarak `/login`'e goturuyor.
- **`/` (kok adres) ekran envanterinde yok.** Kendi basina ekran uretilmedi; kok adres `/reports`'a tasiniyor, oturum yoksa guard onu `/login`'e dusuruyor.

## Bilinen Sinirlamalar
- Guard yalnizca token'in **varligina** bakar, gecerliligine/suresine degil (yerelde JWT cozulmuyor). Suresi dolmus token ile korumali ekran bir an render olur, ilk API cagrisi 401 donunce oturum temizlenip `/login`'e gidilir. Yetki karari sunucuda kalir — bu bilincli bir tercihtir.
- `LoginPage` `redirectTo` degerini heniz TUKETMIYOR (giris formu T-018 kapsami); bu ticket degeri yalnizca uretir ve korur.
- Bilinmeyen adres icin 404 rotasi eklenmedi — design.md'de boyle bir ekran yok, icat edilmedi.
- Coklu sekme senkronizasyonu (`storage` olayi ile diger sekmede cikis) kapsamda degil, uygulanmadi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- Repo geneli `npm run lint`, `apps/api/src/infra/email/email.module.ts` icinde 3 hata veriyor (`no-unsafe-assignment/call/argument`): bu worktree ortaminda `resend` paketi kurulu olmadigi icin tip cozulemiyor. `apps/api` bu ticket'ta hic degistirilmedi (`git diff --name-only 66742d0 -- apps/api` → 0 dosya); ortamsal/onceden var olan bir durum. `apps/web` kapsaminda lint 0 hata/0 uyari.
- `MeResponse` semasinda ad/soyad alani yok; AppShell zorunlu olarak e-posta gosteriyor (design.md §6.2 zaten bunu sozlesme boslugu olarak isaretlemis).

## Test Kosum Ciktisi (ozet)
```
apps/web (jest, coverage acik):
  Test Suites: 27 passed, 27 total
  Tests:       158 passed, 158 total   (T-017 oncesi: 105 -> +53 test)
  coverageThreshold global lines %80 saglandi; yeni dosyalar:
    features/auth/session.ts, session-client.ts, useCurrentUser.ts, auth.api.ts,
    SessionProvider.tsx, components/RequireAuth.tsx, components/AppShell.tsx -> %100 satir

kok (tools) jest: 5 suites / 25 tests passed
npx tsc --noEmit -p apps/web/tsconfig.json        -> TEMIZ
npx eslint apps/web/src --max-warnings=0          -> TEMIZ (0 uyari)
npx prettier --check apps/web/src/**/*.{ts,tsx,css} -> TEMIZ
npm run build --workspace @tutanak/web            -> basarili (PWA precache 7 entries)
```
