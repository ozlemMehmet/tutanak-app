# Devlog — T-018

> Uretici: dev-agent | Branch: ticket/T-018 | Tarih: 2026-08-15

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)
| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. `/login` e-posta + sifre alanlari, "Giris Yap" butonu, sifre goster/gizle | `pages/LoginPage.tsx` + `features/auth/PasswordField.tsx` (toggle) | `LoginPage.spec.tsx`: alanlar/buton render, `PasswordField.spec.tsx`: toggle `type` degisimi |
| 2. Basarili giriste token saklanir, `redirectTo` varsa oraya yoksa `/reports` | `features/auth/useLogin.ts` (`session.signIn`), `LoginPage.tsx` (`safeRedirectTarget`) | `LoginPage.spec.tsx`: token depoya yazildi + konum `/reports` ve `redirectTo` hedefi; `redirect-target.spec.ts` |
| 3. 401 `INVALID_CREDENTIALS` -> form-GENEL banner, alan belirtilmez | `features/auth/auth-error.ts` (401'de `fields` bos) | `auth-error.spec.ts` + `LoginPage.spec.tsx`: banner var, alan hatasi YOK |
| 4. 429 -> "Cok fazla deneme yaptiniz, birazdan tekrar deneyin" | `auth-error.ts` RATE_LIMIT dali | `auth-error.spec.ts` + `LoginPage.spec.tsx` |
| 5. Istek surerken buton disabled + yukleniyor, alanlar disabled | `LoginPage.tsx`/`RegisterPage.tsx` `isPending` bagi | `LoginPage.spec.tsx` + `RegisterPage.spec.tsx`: pending sirasinda disabled |
| 6. `/register` uc alan; sifre-tekrar YALNIZCA istemcide, API'ye GONDERILMEZ | `pages/RegisterPage.tsx` + `features/auth/auth.api.ts` `registerUser()` govdesi | `RegisterPage.spec.tsx`: gonderilen govde tam olarak `{email,password}`; eslesmeme -> istek yok |
| 7. 409 `EMAIL_ALREADY_REGISTERED` -> `details[0].field` uyarinca e-posta altina | `auth-error.ts` details -> alan eslemesi | `auth-error.spec.ts` + `RegisterPage.spec.tsx`: mesaj e-posta girdisinin `aria-describedby` hedefinde |
| 8. Basarili kayitta otomatik giris YOK; `/login` + "Hesabiniz olusturuldu, giris yapin" | `RegisterPage.tsx` navigate(query), `LoginPage.tsx` banner | `RegisterPage.spec.tsx`: token yazilmadi + `/login`'e gecildi, banner gorunur |
| 9. "En az 8 karakter" yardimci metni surekli gorunur | `RegisterPage.tsx` kalici `form-field__hint` | `RegisterPage.spec.tsx`: hata yokken de gorunur, hatadan sonra da gorunur |

Ek olarak (kriterlerin on kosulu): ekranlarin rota haritasina API istemcisiyle baglanmasi —
`router.tsx` + `router.spec.tsx` ("`/login` rotasindaki form gonderildiginde API istemcisini kullanir").

## Alinan Kararlar ve Gerekceler
- **Hata cozumleme tek saf fonksiyonda (`auth-error.ts`).** Iki ekran ayni zarfi (401/429/`details[]`)
  cozuyor; kopyalamak yerine saf fonksiyon + `knownFields` parametresi. Desen sozlugunde bu problem
  sinifina karsilik gelen madde "Mapper (saf fonksiyon)" — sinif/DI eklenmedi.
- **Metin secimi `error.code`/`status` ile, sunucu `message`'ina gore DEGIL** (CLAUDE.md §4.3).
  401'de sunucu mesaji ne olursa olsun sabit "E-posta veya sifre hatali" gosterilir ve `details[]`
  gelse bile alan hatasina cevrilmez — kullanici numaralandirma yuzeyi acilmasin diye (kriter 3).
- **Yonlendirme sayfada, token saklama hook'ta.** `useLogin` yalnizca `session.signIn` cagirir;
  rota bilgisi mutation'a sizmaz (CLAUDE.md §3.9: sayfa duzen/etkilesim kurar).
- **`safeRedirectTarget` ile acik yonlendirme korumasi.** `redirectTo` adres cubugundan da
  gelebildigi icin yalnizca uygulama ici mutlak yollar kabul edilir; `//host` ve `/\host`
  reddedilir (tarayicida dis adrese cozulurler).
- **Kayit basari mesaji sorgu parametresiyle tasindi** (`/login?registered=1`), router `state`
  yerine: deger tiplidir ve sayfa tazelendiginde kaybolmaz.
- **Sifre-tekrar yapisal olarak sizmiyor.** `registerUser()` govdeyi `...credentials` ile yaymaz,
  alanlari tek tek yazar; boylece istemci tarafi bir alanin `RegisterRequest`'e girmesi imkansiz
  (sunucu govde katiligi geregi 400 dondururdu — CLAUDE.md §3.7).
- **Yukleniyor gostergesi metinle ("Giris yapiliyor...") verildi, spinner ile degil.** design.md §4.5
  `Button` loading satiri "spinner + disabled" diyor; ancak (a) token dosyasinda `motion` (sure/easing)
  anahtari yok — animasyon suresi uydurmak tasarim sozlesmesini asardi, (b) kod tabanindaki mevcut
  desen (T-009 `ApprovalForm`: "Onaylaniyor...") metin gostergesi. Tutarlilik + token disiplini
  geregi mevcut desen korundu; buton yine `disabled` ve alanlar da disabled (kriter 5 karsilanir).
- **Yeni `InlineFieldError` bileseni `components/` altinda** (ozellikten bagimsiz, uc ekranda
  kullaniliyor — CLAUDE.md §1); `PasswordField` yalnizca kimlik ekranlarina ait oldugu icin
  `features/auth/` altinda.
- **Gorsel degerler yalnizca `tokens.css` degiskenlerinden.** Ham hex/keyfi px yok; tek istisnalar
  design.md'den birebir alinan ve yerinde gerekcelendirilen iki deger: 44px dokunma hedefi (§5) ve
  caption adimi `0.8125rem` (§4.2) — ikisi de kod tabaninda mevcut precedent ile ayni bicimde.
- **Ikon olcusu `1em`** (sabit px yerine): hata ikonu metnin tipografi adimini devralir.

## Varsayimlar
- `redirectTo` sorgu parametresinin adi ve bicimi T-017'nin `RequireAuth` uretimiyle aynidir
  (router.spec'teki mevcut beklentiler dogrulandi).
- Hiz siniri (429) yanitinin kodu `RATE_LIMIT_EXCEEDED`; kod tanimlanmasa bile 429 durumu ayni
  banner'a duser (savunmaci dal, testi var).

## Anayasa (CLAUDE.md) Bosluklari
- **Tasarim sozlesmesi boslugu — `info` tonu:** design.md §3 LoginPage basari mesaji icin `Banner`
  (info) istiyor, fakat `design-tokens.json` renk setinde `info` YOK. En yakin token cifti
  kullanildi: `surface-muted` zemin + `text` metin (§4.1 "notr durumlar" tanimi, §5'te beyan edilmis
  ~16.1:1 cift). Uydurma renk eklenmedi.
- **Tasarim sozlesmesi boslugu — `motion`:** token dosyasinda hareket (sure/easing) anahtari yok;
  bu yuzden spinner/gecis animasyonu eklenmedi (yukaridaki karar).
- Bunlar disinda anayasa boslugu yok; hata zarfi, katman ve isimlendirme kurallari birebir uygulandi.

## Bilinen Sinirlamalar
- CSS icin otomatik test yok (kod tabaninda precedent de yok): `app.css`'e eklenen kimlik ekrani
  stilleri jsdom testlerinde dogrulanmaz, yalnizca `npm run build` ile derlenir. Gorsel dogrulama
  QA'nin manuel adimina kalir.
- Sifre kurali istemcide zorlanmiyor: "En az 8 karakter" kalici yardimci metindir, uzunluk
  dogrulamasinin tek kaynagi sunucudur (400 + `details[]` alan altina baglanir). Ticket istemci
  tarafi uzunluk kontrolu istemiyor; sozlesme tekrari uretmemek icin eklenmedi.
- Klavye acikken butonun viewport disina cikmamasi (design.md mobil notu) sabit alt bar yerine
  normal akis + `safe-area-inset` ile cozuldu; gercek cihaz dogrulamasi QA'ya aittir.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)
- `features/approvals/ApprovalForm.tsx` alan hatasini `<p className="field-error" role="alert">`
  ile gosteriyor; yeni `InlineFieldError` bilesenine (ikon + `aria-describedby` + `aria-live`)
  gecirilmedi — T-009 kapsamindaki dosya, kapsam disi birakildi.
- `.worktrees/T-018` calisma agacinda `node_modules` yoktu; testleri kosabilmek icin `npm ci`
  calistirildi (gitignore'da, commit'e girmiyor). Fabrika ortaminin worktree hazirligiyla ilgili
  olabilir — kod tarafinda degisiklik yapilmadi.

## Test Kosum Ciktisi (ozet)
```
npm run typecheck   -> temiz (kok + apps/api + apps/web)
npm run lint        -> eslint . --max-warnings=0 : 0 hata / 0 uyari
npm run format:check-> All matched files use Prettier code style!
npm test
  kok  : Test Suites 5 passed,  Tests 25 passed
  api  : Test Suites 55 passed, Tests 360 passed
  web  : Test Suites 35 passed, Tests 222 passed   (LoginPage 12, RegisterPage 10, auth-error 10,
         redirect-target 7, PasswordField 8, InlineFieldError 3, useLogin 3, useRegister 2, router +1)
  web coverage: pages/LoginPage.tsx 100%, pages/RegisterPage.tsx 100%, features/auth/* 100%
npm run build       -> web derlendi (dist 296.68 kB js / 8.47 kB css, gz 93.15 kB)
```

Red-green kaydi: rota baglantisi testi ("`/login` rotasindaki form gonderildiginde API istemcisini
kullanir") once KIRMIZI kosuldu (`router.tsx` `LoginPage`'e `client` gecmiyordu; `tsc` de ayni
hatayi veriyordu), ardindan tek satirlik baglama ile yesile alindi.
