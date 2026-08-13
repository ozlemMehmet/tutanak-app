# Devlog — T-006

> Uretici: dev-agent | Branch: ticket/T-006 | Tarih: 2026-08-13

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| K1: Taslak tutanaga fotograf yukleme 201 + kayit (ID + damga) doner | `modules/photos/photos.controller.ts` (`POST /reports/{reportId}/photos`) -> `photos.service.ts#addPhoto` -> `photos.repository.ts#create` -> `mappers/photo.mapper.ts#toPhotoDto` | e2e `test/photos.e2e-spec.ts`: "taslak tutanaga yuklenen fotograf icin 201 + kimlik ve damga doner", "yanit yalnizca sozlesmedeki Photo alanlarini tasir" + birim `photos.service.spec.ts`, `photo.mapper.spec.ts`, `photos.controller.spec.ts` |
| K2: Her fotografa SUNUCU tarafinda otomatik damga eklenir | `captured_at` DDL'de `DEFAULT now()`; repository INSERT'i bu alani HIC yazmaz (CLAUDE.md §3.7) | e2e: "damga veritabaninda sunucu saatiyle yazilir; istemci gonderemez" (§8.5 iki tarafli clock-skew penceresi) + `photos.repository.spec.ts` |
| K3: Istemciden gelen tarih degeri yok sayilir; damga sunucu saatine gore belirlenir | Controller govde icin DTO tanimlamaz, `@Body()` kullanmaz; yalnizca `FileInterceptor('file')` (§3.7 istisna 1). Web tarafinda `photos.api.ts` govdeye YALNIZCA `file` koyar | e2e: "govdeye eklenen capturedAt alani 400 URETMEZ; damga yine sunucu saatindedir" + web `photos.api.spec.ts`: "govdeye HICBIR tarih alani koymaz" |
| K4: Fotograf guncelleme/PATCH rotasi tanimli DEGILDIR; damga hicbir uctan degistirilemez | `photos.controller.ts` yalnizca `@Post()` + `@Get()` tanimlar; DB tarafinda `captured_at` immutability trigger'i (T-002) | e2e `damganin degistirilemezligi` blogu: "fotograf guncelleme/PATCH rotasi TANIMLI DEGILDIR ve damga degismez" (PATCH/PUT/DELETE 404) + "captured_at dogrudan veritabani guncellemesiyle de degistirilemez (trigger reddi)" |
| K5: Desteklenmeyen format (.txt) -> 400 + hata mesaji | `photo-format.validator.ts#detectPhotoContentType` (icerikten/sihirli bayttan tip tespiti) -> `UnprocessableError('UNSUPPORTED_MEDIA_FORMAT')` | e2e: ".txt 400", "jpg uzantisi + image/jpeg beyani ile gonderilen metin de 400 (beyana guvenilmez)", "gif 400" + birim `photo-format.validator.spec.ts` |
| K6: Birden fazla fotograf eklenebilir; listeleme hepsini damgalariyla doner | `photos.service.ts#listPhotos` -> `photos.repository.ts#findByReport` (`(sort_order, captured_at)` sirali, §3.14) | e2e: "bir tutanaga eklenen birden fazla fotografi damgalariyla ve sirali doner", "her fotograf kendi damgasini tasir" + web `PhotoGrid.spec.tsx` |
| K7: Arayuz mobilde cihaz kamerasini dogrudan acar; kare onizlenir, "Yukle" ile sunucuya gider | `apps/web/src/features/photos/PhotoCaptureInput.tsx` (`<input type="file" accept="image/*" capture="environment">` + onizleme + "Yukle"), `PhotoSection.tsx`, `usePhotos.ts`, `api/client.ts`; host: `pages/ReportDetailPage.tsx` + `router.tsx` | `PhotoCaptureInput.spec.tsx` (accept/capture oznitelikleri, onizleme, "Yukle" -> gonderim, hata sonrasi onizlemenin korunmasi), `PhotoSection.spec.tsx` (yukleme -> liste damgayla tazelenir), `App.spec.tsx` (rota) + asagidaki **manuel mobil senaryo** |

## Alinan Kararlar ve Gerekceler

- **Damga hicbir istemci girdisinden turemez.** `captured_at` INSERT'te hic yazilmaz; DDL `DEFAULT now()` uretir, guncelleme rotasi yoktur (K2/K3/K4 tek bir yapisal kararla kapanir). Web tarafinda da yukleme sonrasi liste **sunucudan yeniden cekilir** — iyimser guncelleme ile tahmini damga gosterilmez.
- **Multipart govde katiligi istisnasi birebir uygulandi (§3.7 istisna 1):** route'ta govde DTO'su yok, `@Body()` yok; ek alanlar 400 uretmez, sessizce yok sayilir. Bu davranis e2e'de acikca test edilir (§8.2 zorunlulugu).
- **Icerik tipi `sharp` ile icerikten tespit edilir, `file-type` KULLANILMADI (§6.1'den sapma).** `file-type` 17+ yalnizca ESM yayinliyor; API derlemesi CommonJS ve jest CJS cozumleyicisi paketi cozemiyor (test altyapisini deneysel ESM moduna almadan calismiyor). Kuralin davranissal amaci (beyan edilen MIME'a GUVENME, icerikten karar ver) `sharp`/libvips sniff'i ile birebir korunur ve `sharp` zaten zorunlu bagimlilik.
- **`sharp` surumu ^0.35.3 (anayasa tablosunda 0.33).** 0.33/0.34 zinciri libvips kaynakli 4 adet **high** advisory tasiyor (GHSA-f88m-g3jw-g9cj) ve §9'un `npm audit --audit-level=high` kapisiyla dogrudan celisiyor; 0.33'e sabitleyip audit'i kosarak dogrulandi (1 high). Kullanilan API (`metadata`, `rotate`, `resize`, `toBuffer`) iki surumde de ayni. Gerekce kalibi §6.1'deki `bcrypt` 5.x -> ^6.0.0 karariyla ayni: iki kural ayni anda saglanamiyorsa guvenlik kapisi alcaltilmaz.
- **Once depolama, sonra DB (§4.2.1):** PUT basarisizsa `report_photos` satiri yazilmaz (yetim kayit yok); depolama hatasi `502 STORAGE_UNAVAILABLE`.
- **Frontend ag katmani tek noktada (§3.9):** `src/api/client.ts` token ekler ve hata zarfini cozer; bilesenlerde ciplak `fetch` yok. Sunucu durumu TanStack Query ile yonetilir (`usePhotos`, `useUploadPhoto`).
- **Taban adres `/api/v1` (ayni kaynak) + Vite gelistirme vekili.** Boylece tarayici CORS istegi yapmaz ve API'de CORS acmak (bu ticket'in kapsaminda olmayan bir guvenlik karari) gerekmez. Vekil hedefi `VITE_API_PROXY_TARGET` ile ayarlanir (docker compose'ta `http://api:3000`).
- **Hata metinleri hata KODUNDAN uretilir** (`photo-error-message.ts`), mesaj metnine gore dallanilmaz (§4.3); metinler design.md → ReportDetailPage sartnamesinden birebir alindi. Ust sinir mesaji sunucudan gelir — esik (`PHOTO_MAX_PER_REPORT`) istemciye gomulmedi (§5.1).
- **Gorsel degerler yalnizca token'lardan:** `src/styles/tokens.css` `factoryctl design css` ciktisidir; `app.css` icinde ham hex/keyfi px yok. Tek istisna damga scrim'i `rgb(15 42 74 / 72%)` — design.md §5'te elle dogrulanmis, "%70'in altina dusurulmez" kurali ile birlikte yazili deger.
- **Verimlilik:** yukleme ve listeleme yollarinda dongu icinde DB/HTTP cagrisi yok; on-imzali URL uretimi yerel imzalamadir ve eleman sayisi `PHOTO_MAX_PER_REPORT` ile sinirlidir. Fotograf listesi tutanak basina sinirli oldugu icin sayfalama eklenmedi (bilincli tercih).
- **Desen kullanimi:** yalnizca sozlukteki desenler — Adapter+Port (`infra/storage`), Repository, saf Mapper, Guard Clause (`assertOwnership`). Yeni desen icat edilmedi.

## Varsayimlar

- Kabul kriteri 7'nin "kamera acilir" yarisi platform davranisidir: `accept="image/*" capture="environment"` mobil tarayicilarda (iOS Safari / Android Chrome) kamerayi dogrudan acar; masaustunde ayni giris dosya secicisine duser. Otomatik testler oznitelik + akis (onizleme -> "Yukle" -> POST) seviyesinde dogrular, kameranin fiilen acilmasi asagidaki manuel senaryoyla dogrulanir.
- Giris (login) ekrani henuz hicbir ticket'ta yazilmadi; erisim token'i `localStorage`'daki `tutanak.accessToken` anahtarindan okunur (`api/access-token.ts`). Giris ekrani geldiginde ayni anahtara yazacak.

### Manuel mobil dogrulama senaryosu (K7)

1. `cp .env.example .env && docker compose up` (api :3000, web :5173, db, minio).
2. Telefon ve bilgisayar ayni agda; telefondan `http://<bilgisayar-ip>:5173` acilir (Vite `host: true`).
3. `POST /api/v1/auth/register` + `/auth/login` ile token alinir; telefonun tarayici konsolundan
   `localStorage.setItem('tutanak.accessToken', '<token>')`.
4. `POST /api/v1/reports` ile taslak olusturulur, `http://<ip>:5173/reports/<reportId>` acilir.
5. "Fotograf Ekle" dokunuldugunda **cihaz kamerasi acilir**; cekilen kare sayfada onizlenir;
   "Yukle" ile gonderilir ve fotograf, **sunucu damgasiyla** izgarada gorunur.

Bu ortamda (baslik/agent kosumu) gercek bir mobil cihaz bulunmadigi icin 5. adim fiilen
kosturulamadi; QA'nin dogrulamasi gereken tek adim budur. Zincirin makinede dogrulanan kismi:
Vite gelistirme sunucusu sayfayi servis ediyor ve `/api/v1/...` istegini vekil uzerinden
API'ye tasiyor (sahte hedefe karsi curl ile dogrulandi), bilesen testleri de oznitelik + akisin
tamamini kapsiyor.

## Anayasa (CLAUDE.md) Bosluklari

- **`file-type` yerine `sharp` ile tip tespiti** ve **`sharp` ^0.35.3 pini**: §6.1 tablosundan iki sapma; gerekceleri yukarida (ESM/CJS uyusmazligi ve §9 audit kapisi). Anayasa guncellemesi retrospektife onerilir.
- **Frontend yapilandirma anahtari:** §5 "frontend'e VITE_ onekli, sir olmayan degerler gider (API tabani)" diyor ama §5.1 tablosunda karsiligi yok. Yeni bir uygulama ayari icat etmemek icin API tabani koda sabit `'/api/v1'` (ayni kaynak) olarak birakildi; yalnizca **gelistirme araci** olan vekil hedefi icin `VITE_API_PROXY_TARGET` eklendi ve `.env.example`'a yazildi. §5.1 tablosuna girmesi gereken aday: `VITE_API_PROXY_TARGET`.
- **Tasarim sozlesmesi boslugu:** design.md ReportDetailPage'de yukleme akisi "sec -> yukle" olarak anlatiliyor, ticket K7 ise **onizleme + "Yukle" onayi** istiyor. Ticket kriteri baglayici kabul edildi; onizleme adimi eklendi, sartnamedeki durumlar (empty/error/success metinleri) aynen korundu. `Toast` bileseni tasarim sisteminde tanimli ama henuz yazilmadi; hata mesaji `role="alert"` tasiyan `.toast` sinifli bir bolge olarak uygulandi (tokenlarla).

## Iade turu 1 (code-reviewer CHANGES — 2 blokleyici bulgu, ikisi de `apps/web/src/styles/app.css`)

Rapordaki iki madde de dogrulandi ve duzeltildi; rapordaki "DOKUNMA" listesine hic dokunulmadi (44x44px dokunma hedefi ve `rgb(15 42 74 / 72%)` scrim aynen kaldi), baska hicbir dosya degismedi.

1. **`.photo-thumbnail` yaricapi `md` -> `lg`.** design.md §4.4 tablosunda `lg` (16px) satiri birebir "Fotograf thumbnail'i, buyuk kart, alt-sheet panel" kullanimina atanmis (design.md:442); kod yanlis token'i (`--radius-md`, 8px) tuketiyordu. `border-radius: var(--radius-lg);` yapildi ve satirin ustune sozlesme referansi yorum olarak eklendi. Dogrulama: `tokens.css:31` `--radius-lg: 16px`.
2. **`.photo-thumbnail__stamp` yazi boyutu `0.875rem` (14px) -> `0.8125rem` (~13px).** 14px tipografi olceginde bir adim degil, ham degerdi. design.md §4.2 (design.md:426) "Kucuk/Caption | ~13px" satirini birebir "Zaman damgasi, yardimci aciklama, karakter sayaci" kullanimina atiyor; bu eleman tam olarak zaman damgasi. Deger olcekten turetildi: taban 16px / oran 1.25 = 12.8px ≈ 13px = 0.8125rem.
   - **Tasarim sozlesmesi boslugu (yeni):** `design-tokens.json` -> `tokens.css` uretimi tipografi icin yalnizca `--font-size-base` ve `--line-height-base` uretiyor; olcek adimlari (caption/h1/h2...) icin degisken YOK. Bu yuzden caption degeri CSS'te sayisal yazilmak zorunda kaldi; yerinde gerekce yorumu birakildi. Retrospektif adayi: token sozlesmesinde `--font-size-caption` (ve diger olcek adimlari) uretilmesi.
   - Dosya basligindaki "tum degerler token'dan gelir" iddiasi da gercekle hizalandi: token karsiligi olmayan uc istisna (44x44px dokunma hedefi, damga scrim'i, caption adimi) baslikta acikca sayiliyor ve her biri kullanim yerinde design.md referansiyla gerekcelendirildi.

**Regresyon kosumu (kod degisikligi yalnizca CSS oldugu icin tam paket yeniden kosuldu):** `npm run format:check` temiz, `npm run lint` (--max-warnings=0) 0 hata/0 uyari, `npm run typecheck` temiz, `npm test` 22 (kok) + 137 (api) + 53 (web) = 212 test gecti, `npm run test:e2e` (gercek Postgres) 82 test / 6 suite gecti. Kirmizi test yok.

## Iade turu 2 (code-reviewer CHANGES — 1 blokleyici bulgu: `npm run test:e2e` kirmizi)

Bulgu dogruydu: `env.schema.ts` bu ticket'ta `R2_ENDPOINT`, `R2_BUCKET`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` anahtarlarini **zorunlu** yaptigi icin, uygulamayi gercekten ayaga kaldiran her e2e spec'inin bu degerleri atamasi gerekiyor. Ilk turda 4 spec'e telafi blogu eklenmis, 2 spec atlanmisti.

**Sistematik hata ayiklama (kural 3).**
1. *Izole:* Raporun kosum komutu birebir tekrarlandi (Postgres :55432, yalnizca `DATABASE_URL` set — CI ile ayni). Hata `validateEnv` icinde, `AppModule` import edilirken, uygulama daha ayaga kalkmadan olusuyor.
2. *Hipotez A:* "Eksik olan tek sey, iki spec'in `R2_*` atamasi." — Kanit: `env.schema.ts` diff'inde `R2_*` `+` satiri; iki spec'in `beforeAll` env bloklarinda karsiligi yok.
3. *Test:* `billing.e2e-spec.ts` ve `auth-rate-limit.e2e-spec.ts` icine, `reports.e2e-spec.ts:107-112` desenindeki dort atama + ayni gerekce yorumu, `await import('../src/main')` satirindan ONCE eklendi. Sema **gevsetilmedi**: depolama sert bagimliliktir, `R2_*` zorunlu kalmalidir (CLAUDE.md §5 sir listesi).
4. *Dogrula:* Iki suite artik kosuyor. Ama tam paket hala kirmiziydi — **hipotez A eksikti**, ikinci bir kok neden ortaya cikti (asagida). Yeni kanitla yeni hipotez kuruldu; rastgele deneme yapilmadi.

**Ikinci kok neden — `photos.e2e-spec.ts`'te sirali baginti (kendi dosyam, ayni ticket).**
- *Kanit:* Iki suite duzeltilince paket 8 suite kosar hale geldi ve bu kez **photos** suite'i 24/24 patladi: `Ortam degiskenleri gecersiz: SUBSCRIPTION_PRICE_AMOUNT (Required), PUBLIC_APP_URL (Required)`.
- *Kok neden:* `photos.e2e-spec.ts` bu iki (T-012 ile zorunlu olan) anahtari **hic atamiyordu**; `--runInBand` tek surecte kostugu icin degerler daha once kosan bir spec'ten `process.env`'e **siziyor**du. Ilk turda "photos yesil" gorunmesinin sebebi buydu: gercek bir gecis degil, suite sirasinin sansiydi. Iki olu suite canlanip sira degisince baginti gorunur hale geldi. Yani bu, ilk turumda zaten var olan gizli bir kirilganlikti; raporun tarif ettigi duzeltme onu ortaya cikardi.
- *Duzeltme:* photos spec'i kendi kendine yeterli hale getirildi (`SUBSCRIPTION_PRICE_AMOUNT`, `PUBLIC_APP_URL` kendi `beforeAll`'unda atanir), nedenini anlatan yorum birakildi.
- *Regresyon korumasi:* Duzeltme "tam paket yesil" ile degil, **her spec'in tek basina ve temiz ortamla kosmasiyla** kanitlandi (`env -i` ile yalnizca `DATABASE_URL` verilerek) — bu, env sizintisinin sessizce geri gelmesini yakalayan kosum bicimidir; sirali baginti bir daha yesil gorunerek saklanamaz.

**Kosum sonucu (Postgres :55432, yalnizca `DATABASE_URL` — CI ile ayni):**
```
# Tam paket (rapordaki komut):  npx jest --config test/jest-e2e.config.mjs --runInBand
Test Suites: 8 passed, 8 total          # <- suite SAYISI kontrol edildi (rapor uyarisi)
Tests:       105 passed, 105 total

# Sira bagimsizligi: her spec tek basina, temiz ortamda (env -i ... DATABASE_URL=...)
photos 24 | billing 18 | auth-rate-limit 5 | auth 16 | health 2 | reports 19 | templates 9 | migration 12   -> 8/8 yesil

# Kapilar: lint (--max-warnings=0) 0/0, typecheck temiz, format:check temiz,
# npm test: 25 (kok) + 206 (api) + 53 (web) = 284 test gecti.
```

Kapsam: yalnizca uc test dosyasinin env bloklari degisti; urun kodu, sema ve rapordaki "eylem gerekmez" listesindeki hicbir sey degistirilmedi.

## Iade turu 3 (qa-agent CHANGES — 1 blokleyici bulgu: on-imzali URL tarayicida acilmiyor)

Bulgu dogruydu ve K7'nin 5. adimini (fotograf izgarada **gorunur**) fiilen dusuruyordu.

**Sistematik hata ayiklama (kural 3).**
1. *Izole:* Raporun yeniden uretim adimlari birebir kosuldu. Yanittaki `url` alani
   `http://minio:9000/...` — yani imza, API'nin **sunucudan sunucuya** kullandigi adresle
   uretiliyor. Sinir netti: hata API/tarayici sinirinda, DNS cozumlemesinde.
2. *Hipotez (tek):* "Adapter tek bir S3 istemcisi tutuyor ve ayni `R2_ENDPOINT` hem PUT
   hem de on-imzalama icin kullaniliyor; imzalanan URL'nin host'u bu yuzden ic ag adi
   oluyor." Kanit: `r2-storage.adapter.ts` yalnizca `this.client` tanimliyor ve
   `getSignedUrl` ona veriliyor; docker-compose `R2_ENDPOINT`'i `http://minio:9000` ile eziyor.
3. *Test (en kucuk degisiklik):* Ic adres ile tarayiciya donen adres ayristirildi.
   Onemli ayrinti: **SigV4 imzasi host'u da kapsar**, bu yuzden URL uretildikten sonra
   metin degistirme (`replace('minio','localhost')`) imzayi gecersiz kilardi — dogru cozum
   imzalamayi bastan **dogru endpoint ile** yapmaktir. Adapter artik iki istemci tutar
   (`client` = yazma/ic yol, `presignClient` = imzalama/tarayici yolu); iki adres esitse
   tek istemci kullanilir. Adres `R2_PUBLIC_ENDPOINT`'ten gelir, verilmezse `R2_ENDPOINT`'e
   duser (davranis, tek adresli uretim kurulumunda oldugu gibi kalir).
4. *Dogrula (tarayicida, raporun istedigi bicimde):* `docker compose up -d --build` sonrasi
   gercek jpeg yuklendi -> `url` host'u `localhost:9000`; URL host'tan `curl` ile cekildi
   (`200`, `image/jpeg`, 2068 bayt, `sharp` ile 640x480 dogrulandi); ardindan **gercek
   tarayicida** (Playwright/Chromium) `http://localhost:5173/reports/<id>` acildi:
   `naturalWidth=640` (QA'nin gordugu `0` / `ERR_NAME_NOT_RESOLVED` yok). Ayrica dosya
   secme -> onizleme -> "Yukle" akisi tarayicida bastan kosuldu: yeni fotograf izgarada
   **sunucu damgasiyla ve goruntusu yuklenmis** halde belirdi (ekran goruntusu alindi).
   **Mobil/LAN yolu da dogrulandi:** `.env`'de `R2_PUBLIC_ENDPOINT=http://192.168.1.109:9000`
   yapilip `docker compose up -d api` ile yeniden kaldirildi, sayfa `http://192.168.1.109:5173`
   uzerinden acildi -> her uc fotograf da `192.168.1.109:9000` host'undan yuklendi
   (`naturalWidth=640`). Yani telefonun kullandigi yol bir cihaz olmadan da kanitlandi.
5. *Regresyon korumasi:* `r2-storage.adapter.spec.ts`'e uc test eklendi — imzalamanin
   `R2_PUBLIC_ENDPOINT` ile yapildigi, yazmanin ic endpoint uzerinden gittigi ve iki adres
   ayni oldugunda tek istemci kuruldugu. `env.schema.spec.ts`'e uc test: anahtar yoksa
   `R2_ENDPOINT`'e duser, verilince korunur, bicimsiz deger reddedilir. Bu hata artik
   sessizce geri gelemez (imzalama endpoint'i degisirse test kirmizi olur).

**Kapsam disi gorunen ama benim degisikligimin dusurdugu tek test:** `reports-list.e2e-spec.ts`
(T-011) uygulamayi ayaga kaldiriyor ama `R2_*` atamiyordu; bu ticket'in semasi bu anahtarlari
zorunlu yaptigi icin suite acilista patliyordu. Iade turu 2'deki ayni kalip (dort atama + ayni
gerekce yorumu) uygulandi; sema **gevsetilmedi**, baska hicbir sey degistirilmedi.

**Anayasa boslugu (yeni):** `R2_PUBLIC_ENDPOINT` §5.1 tablosunda yok. Sir **degildir**
(yalnizca adres; `R2_ENDPOINT` sir listesindedir cunku ic adresi ifsa etmemek istenmis).
Kendi adimi icat etmemek icin en yakin mevcut kalip izlendi (`R2_ENDPOINT` + `PUBLIC_APP_URL`
ikilisinin birlesimi) ve `.env.example`'a yerel varsayilaniyla yazildi. Retrospektif adayi:
§5.1 tablosuna `R2_PUBLIC_ENDPOINT | Mutlak http(s) URL, varsayilan = R2_ENDPOINT | on-imzali
fotograf URL'sinin tarayiciya donen adresi` satiri.

**Kosum sonucu:** `npm run lint` (--max-warnings=0) 0/0, `npm run typecheck` temiz,
`npm run format:check` temiz, `npm test` 25 (kok) + 226 (api) + 53 (web) = 304 test gecti,
`npm run test:e2e` (gercek Postgres) **9 suite / 130 test** gecti, `npm audit --audit-level=high`
gecti, `npm run build` temiz.

## Bilinen Sinirlamalar

- **E2E spec'leri env'i `process.env` uzerinden kurar; `--runInBand` altinda anahtarlar suite'ler arasi sizabilir.** Bu turda uc spec kendi kendine yeterli hale getirildi, ama yapisal koruma yok: zorunlu bir env anahtari eklendiginde onu ayaga kalkan TUM spec'lere eklemek hala elle yapilan bir istir (bu bulgunun kok nedeni). Anayasa boslugu / retrospektif adayi: e2e icin ortak bir `setupTestEnv()` yardimcisi (ya da jest `setupFiles`) — tek yerde tanimlanir, yeni zorunlu anahtar tum suite'lere otomatik iner. Bu ticket'in kapsami disinda oldugu icin YAPILMADI.
- **`ReportDetailPage` bu ticket'ta yalnizca fotograf bolumunu icerir.** Baslik/durum rozeti, PDF indirme (T-007), paylasim paneli (T-008) yok. Bunun sonucu: `canAddPhoto` su an sabit `true`; **onaylanmis** tutanakta ekleme arayuzunun gizlenmesi (design.md success durumu) tutanak detayini ceken cagri bu sayfaya eklendiginde baglanacak. Guvenlik/kanit butunlugu tarafi sunucuda **zaten** zorunlu: onaylanmis tutanakta yukleme `409 REPORT_ALREADY_APPROVED` ile reddedilir ve bu e2e'de testli (§3.10).
- **Playwright E2E senaryolari (§8.3) hala yok** — repoda Playwright kurulu degil ve kritik akisin diger halkalari (giris ekrani, tutanak olusturma ekrani) henuz yazilmadi. K7 icin oznitelik+akis bilesen testleriyle ve yukaridaki manuel senaryoyla dogrulanir; §8.3'un 4. senaryosu ekranlar tamamlandiginda kurulmalidir.
- Fotograf ust siniri UI'da **proaktif** olarak degil, sunucudan `PHOTO_LIMIT_REACHED` dondukten sonra kapatilir (esigi istemciye gommemek icin).
- **Telefondan denemek icin `R2_PUBLIC_ENDPOINT` elle LAN IP'sine cevrilmelidir** (`.env.example`'da bu not yazili). Otomatik tespit (istegin `Host` basligindan URL uretmek) bilincli olarak YAPILMADI: istemciden gelen basliga gore imza adresi secmek acik yonlendirme/onbellek zehirlenmesi yuzeyi acar; adres yapilandirmadan gelir (§5).
- `GET /reports/{id}/photos` sayfalamasizdir; tutanak basina ust sinir 30 oldugu icin bilincli tercihtir.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- `apps/api/test/jest-e2e.config.mjs` hala coverage esigi tanimlamiyor (T-004/T-005 devloglarinda da notlanmis).
- `common/errors/app-error.ts` hiyerarsisi tamamlandi denemez: bu ticket ihtiyaci olan `ConflictError`/`UnprocessableError`/`ExternalServiceError` siniflarini ekledi; `UnauthenticatedError`'in webhook kodlari T-012'ye kaliyor.
- Web tarafinda `LoginPage`/`RegisterPage`/`ReportListPage` yok; token elle `localStorage`'a yazilmak zorunda (yukarida). Kimlik ekranlari kendi ticket'larinda gelmeli.

## Test Kosum Ciktisi (ozet)

```
# 1) ONCE KIRMIZI (web bilesen/istemci specleri yazildi, uygulama dosyalari henuz yok):
Test Suites: 7 failed, 2 passed, 9 total   (Cannot find module './PhotoCaptureInput' ...)

# 2) Birim testler YESIL (npm test — kok + api + web):
kok:  Test Suites: 4 passed,  Tests: 22 passed
api:  Test Suites: 28 passed, Tests: 137 passed
web:  Test Suites: 11 passed, Tests: 53 passed
      web satir kapsami: %98.57 (esik %80); modules/photos ve features/photos %97-100

# 3) Entegrasyon/e2e (gercek Postgres, izole veritabani + migrate:deploy + seed, FakeStorage):
PASS test/photos.e2e-spec.ts   (24 test: K1..K6 + 400/401/403/404/409/502 yollari)
Test Suites: 6 passed, 6 total
Tests:       82 passed, 82 total

# 4) Statik analiz / kapilar:
npm run lint         -> 0 hata / 0 uyari (--max-warnings=0)
npm run typecheck    -> temiz (kok + api + web)
npm run format:check -> All matched files use Prettier code style!
npm audit --audit-level=high -> found 0 vulnerabilities
npm run build        -> api tsc + vite build (dist 88.44 kB gz; butce <=250 kB)
npm run verify:pwa   -> manifest + service worker + kayit kodu mevcut

# 5) Gelistirme vekili dogrulamasi (K7 manuel senaryosunun on kosulu):
curl http://localhost:5199/api/v1/reports/r-1/photos -> {"path":"/api/v1/reports/r-1/photos"}
```
