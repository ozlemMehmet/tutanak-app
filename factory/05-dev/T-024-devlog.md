# Devlog — T-024

> Uretici: dev-agent | Branch: ticket/T-024 | Tarih: 2026-08-16

Kapsam: guvenlik denetimi raporundaki S-01 (HIGH), S-02 ve S-03 bulgulari.
LOW bulgulara (S-04..S-09) DOKUNULMADI.

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Iki farkli istemci (farkli XFF son hop) KENDI sayacini tuketir | `main.ts` `trust proxy = 1` + `ClientIpThrottlerGuard.getTracker → req.ip` + `app.module.ts` guard degisimi | `test/auth-rate-limit.e2e-spec.ts` → "iki farkli istemci kendi sayacini tuketir: biri 429 alirken digeri istek yapmaya devam eder" |
| 2. Davranis e2e testiyle dogrulanir (iki XFF degeri, sayac bagimsizligi assert) | ayni | ayni e2e testi (iki istemci de yalnizca KENDI limitini asinca 429 alir) |
| 3. Vekil basligi TAKLIT EDILEMEZ; keyfi XFF zinciri sayaci sifirlamaz | `TRUSTED_PROXY_HOP_COUNT = 1` (`true` degil) + tracker `req.ips[0]`'i KULLANMAZ | e2e "istemcinin uydurdugu XFF onek zinciri sayaci SIFIRLAMAZ" + birim `client-ip-throttler.guard.spec.ts` (3 test) |
| 4. Uretim imajinda `GET /` ve statik varliklar CSP + HSTS + nosniff + Referrer-Policy doner | `apps/web/Dockerfile` Caddyfile statik `handle` blogundaki `header` blogu | Uretim imajiyla canli dogrulama (asagida "Test Kosum Ciktisi") — Dockerfile'a birim test yazilamaz |
| 5. CSP obje depolama kokenini `img-src`/`connect-src` icinde barindirir; mevcut akislari kirmaz | CSP metninde `{$R2_PUBLIC_ENDPOINT}` yer tutucusu (ham string YOK) + `blob:` (fotograf onizlemesi) | Canli: baslikta koken goruldu; headless Chrome ile SPA render + 0 CSP ihlali; `/t/*`, `/sw.js`, vekillenen `/health` regresyon kontrolu |
| 6. `PAYMENT_PROVIDER` ZORUNLU; tanimsizken uygulama ACILMAZ, hata degisken adini soyler | `env.schema.ts`: `z.enum([...])` (`.default('fake')` KALDIRILDI) | `env.schema.spec.ts` → "PAYMENT_PROVIDER tanimsizken VARSAYILANA DUSMEZ", "eksik ... hangi degiskenin eksik oldugunu soyler" |
| 7. `NODE_ENV=production` iken `fake` REDDEDILIR; yerel/test'te calisir, billing e2e degismeden gecer | `env.schema.ts` `superRefine` (`PRODUCTION_NODE_ENV` kontrolu) | `env.schema.spec.ts` → "NODE_ENV=production iken PAYMENT_PROVIDER=fake REDDEDILIR", "... iyzico kabul edilir", "yerel/test ortaminda fake calismaya devam eder" + `billing.e2e-spec.ts` (dokunulmadan gecti) |

## Alinan Kararlar ve Gerekceler

- **S-01 iki parcali cozuldu.** Yalniz `trust proxy` yeterli gorunuyordu (`@nestjs/throttler` 6.5
  varsayilani `req.ip`), ama sayac anahtari acikca `ClientIpThrottlerGuard` ile sabitlendi:
  kutuphane varsayilani surumler arasinda `req.ips[0]`'a (ISTEMCININ gonderdigi zincirin ilk
  halkasi) donerse hiz siniri SESSIZCE etkisiz kalirdi. Birim test bu secimi kilitler.
- **`trust proxy` degeri `1`, `true` degil** (ticket teknik notu): `true` ile Express zincirin en
  soldaki halkasini gercek istemci sayar ve saldirgan her istekte yeni bir sahte onek yazarak
  sayaci sifirlar. Deger yeni bir env anahtari yapilmadi — §5.1 tablosunda karsiligi yok ve
  anayasa "kendi env adini icat etme" diyor; topoloji (Caddy tek hop) mimaride sabit.
- **CSP basliklari yalnizca statik `handle` blogunda.** Ticket "API tarafindaki helmet
  yapilandirmasi degistirilmez" diyor; site seviyesine konsaydi vekillenen API yanitlari IKINCI
  bir CSP basligi tasirdi. Canli dogrulandi: `/health` yaniti yalnizca helmet'in basligini tasiyor.
- **CSP'ye `blob:` eklendi.** `PhotoCaptureInput` onizlemede `URL.createObjectURL` kullaniyor;
  `blob:` olmadan CSP mevcut bir akisi kirardi (kriter 5). `'unsafe-inline'` hicbir yonergede
  verilmedi — kod tabaninda inline script/style yok (arandi, sifir kullanim).
- **S-03'te `NODE_ENV` `.env.example`'a EKLENMEDI.** Uretim imaji `NODE_ENV=production` tasiyor;
  compose'da `env_file` degerleri imaj ENV'ini EZER. Anahtar ornek dosyaya konsaydi, `.env`'ini
  ornekten kopyalayan operator uretimi sessizce `development`'a dusurup bu korumayi kapatirdi.
  Ornek dosyaya yalnizca aciklama satiri yazildi (deger yok).
- **Zorunlu env anahtari ekleyen commit, app boot eden TUM e2e suitlerini ayni commit'te
  guncelledi** (12 suite; bilgi tabani dersi `testing/zorunlu-env-anahtari-tum-e2e-suitleri.md`).
  Dogrulama CI paritesiyle yapildi: yalnizca `DATABASE_URL` tanimliyken tam paket yesil.
- **Verimlilik:** eklenen kod yollarinda dongu/DB/HTTP cagrisi yok; tracker O(1) alan okumasi,
  CSP basligi Caddy tarafinda statik metin. Sicak yol maliyeti degismedi.

## Varsayimlar

- Uretimde istemci ile API arasinda TEK ters vekil vardir (Caddy). Bu degisirse
  `TRUSTED_PROXY_HOP_COUNT` guncellenmelidir; sabit bu gerekce ile yorumlanmistir.
- Caddy'nin varsayilan davranisi olculdu (kanit asagida): gelen `X-Forwarded-For` GUVENILMEZ
  kabul edilip gercek istemci adresiyle DEGISTIRILIYOR (eklenmiyor bile). Yani istemcinin
  uydurdugu zincir API'ye hic ulasmiyor; `trust proxy = 1` ikinci savunma katmanidir.
- Web container'ina `R2_PUBLIC_ENDPOINT` ayni degerle verilecektir (bkz. Bilinen Sinirlamalar).

## Anayasa (CLAUDE.md) Bosluklari

- **`NODE_ENV` §5/§5.1 listelerinde yok.** Anayasa "bu iki listede olmayan bir env anahtari kodda
  okunamaz" diyor, ancak kriter 7 acikca `NODE_ENV=production` davranisi istiyor. Secim: sema
  `NODE_ENV`'i okur (varsayilan `development`), `.env.example`'a anahtar olarak EKLENMEZ (gerekce
  yukarida). Anayasa guncellemesi gerekiyorsa: "platform degiskeni" kategorisi.
- **`trust proxy` hop sayisi §5.1 tablosunda yok.** Env adi icat edilmedi; `main.ts`'te
  adlandirilmis sabit + gerekce olarak durur.
- **Desen sozlugunde "framework guard'ini genisletme" karsiligi yok.** En basit duz cozum
  uygulandi (tek metod override, yeni katman/soyutlama yok).

## Bilinen Sinirlamalar

- **`apps/web/Dockerfile` depoda IZLENMIYORDU.** S-02'nin yeri ticket'ta bu dosya olarak veriliyor
  ama dosya `origin/main`'de YOK; release-prep asamasinin ciktisi olarak yalnizca workspace'te
  (untracked) duruyor. Bu yuzden once BIREBIR (degistirmeden) commit'lendi, guvenlik basliklari
  ayri commit'te eklendi — T-024'un fiili degisikligi tek basina okunabilsin diye. Ayni durumdaki
  diger release-prep ciktilarina (`docker-compose.e2e.yml`, cok asamali `apps/api/Dockerfile`,
  `.github/workflows/cd.yml`, `CHANGELOG.md`) DOKUNULMADI; bunlarin surum kontrolune alinmasi
  devops/release sahipligindedir ve merge sirasinda workspace'teki untracked kopyalarla
  cakisabilir (devops'un dikkatine).
- **`R2_PUBLIC_ENDPOINT` web container'ina VERILMELIDIR.** CSP'deki obje depolama kokeni bu
  degerden turer. Verilmezse yer tutucu bos genisler: CSP gecerli kalir (olculdu) ama fotograflar
  tarayicida engellenir. Degeri gecirecek iki dosya da depoda izlenmiyor
  (`docker-compose.e2e.yml`'in `web` servisi ve runbook §1 uretim compose'u) — devops hand-off:
  `web` servisine `R2_PUBLIC_ENDPOINT`, API ile AYNI deger.
- Fotograf goruntulemenin gercek tarayicida ucdan uca dogrulanmasi (giris → tutanak → fotograf)
  tam uretim yigini ister; bu turda SPA kabugu + varliklar + `/t/*` + vekillenen `/health` gercek
  tarayici ve curl ile dogrulandi, CSP metninde koken goruldu. QA icin dogrulama yolu:
  `docker compose -f docker-compose.e2e.yml up --build -d` sonrasi fotograf yukleyip
  `img.naturalWidth > 0` ve konsolda "Refused to load the image" OLMAMASI.
- `X-Frame-Options` eklenmedi: `frame-ancestors 'none'` modern tarayicilarda ayni korumayi verir
  ve kriter listesinde yok.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- Guvenlik denetiminin prova ortami HALA AYAKTA: `secaudit-*` container'lari (`docker ps`)
  calisir durumda; rapor `down -v` yapildigini soyluyor. Temizlik devops'un.
- S-05..S-09 raporda acik (source map yayini, root ile calisan imajlar, sunucu tarafi oturum
  sonlandirma yoklugu, `.env.example`'daki zayif varsayilanlar, yedek sifreleme/KVKK silme).
  Kapsam disi; dokunulmadi.
- `docker-compose.yml`'in `web` servisi Vite dev sunucusu kullanir; guvenlik basliklari yalnizca
  uretim imajindaki Caddy'de vardir. Yerel gelistirme yaninda bilincli fark.

## Test Kosum Ciktisi (ozet)

```
# Birim (CI paritesi: env -i)
Test Suites: 53 passed, 53 total
Tests:       390 passed, 390 total

# E2E (yalnizca DATABASE_URL tanimli — ders: zorunlu-env-anahtari-tum-e2e-suitleri)
Test Suites: 13 passed, 13 total
Tests:       198 passed, 198 total

# Yeni testlerin "once kirmizi" kanidi (duzeltme geri alinarak olculdu)
✕ iki farkli istemci kendi sayacini tuketir ...        Expected: 401  Received: 429
✕ istemcinin uydurdugu XFF onek zinciri sayaci SIFIRLAMAZ
→ duzeltme ile: 7 passed (auth-rate-limit.e2e-spec.ts)

# Lint / format / typecheck
eslint . --max-warnings=0        → 0 hata, 0 uyari
prettier --check .               → All matched files use Prettier code style!
tsc --noEmit (api + web + kok)   → temiz

# S-02 canli dogrulama (uretim imaji: docker build -f apps/web/Dockerfile)
GET /            → 200 + Content-Security-Policy: default-src 'self'; script-src 'self';
                   object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';
                   img-src 'self' data: blob: http://localhost:9000;
                   connect-src 'self' http://localhost:9000
                 + Strict-Transport-Security: max-age=31536000; includeSubDomains
                 + X-Content-Type-Options: nosniff + Referrer-Policy: no-referrer
GET /assets/index-*.js → ayni dort baslik
GET /t/abc       → X-Robots-Tag: noindex + Referrer-Policy korunuyor (regresyon yok)
GET /sw.js       → Cache-Control: no-cache korunuyor (regresyon yok)
GET /health      → API'ye vekillendi; YALNIZCA helmet'in CSP'si var (API basliklari degismedi)
R2_PUBLIC_ENDPOINT verilmeden → CSP hala gecerli (koken bos genisler)
Headless Chrome (gercek tarayici) → #root render oldu, konsolda CSP ihlali/hata YOK

# Vekil davranisi olcumu (Caddy → sahte upstream, header yansitma)
istemci: X-Forwarded-For: 203.0.113.9, 198.51.100.1  → API'ye ulasan: X-Forwarded-For: <gercek IP>
istemci: X-Forwarded-For: 10.9.9.9                   → API'ye ulasan: X-Forwarded-For: <gercek IP>
(Caddy istemcinin zincirini GUVENMEYIP degistiriyor; trust proxy=1 ikinci katman)
```
