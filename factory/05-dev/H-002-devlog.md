# Devlog — H-002

> Uretici: dev-agent | Branch: ticket/H-002 | Tarih: 2026-08-18

## Kriter -> Plan Eslemesi (kod yazmadan once dolduruldu)

| Kabul kriteri | Karsilayacak kod | Karsilayacak test |
|---|---|---|
| 1. Yeniden uretim senaryosu duzelir (SharePanel e-posta hatasi, SubscriptionPage bekleme mesaji, ReportListPage bos durum, ReportDetailPage/API "bulunamadi") | `SharePanel.tsx`, `SubscriptionPage.tsx`, `ReportListPage.tsx`, `ReportDetailPage.tsx`; `share-link.service.ts` / `photos.service.ts` / `reports.service.ts` icindeki `NotFoundError('NOT_FOUND', 'Tutanak bulunamadı.')` | `SharePanel.spec.tsx`, `SubscriptionPage.spec.tsx`, `ReportListPage.spec.tsx`, `ReportDetailPage.spec.tsx` (sorgu/assert dizeleri guncel Turkce metnin KENDISI); API tarafinda `share-link.service.spec.ts`, `photos.service.spec.ts`, `reports.service.spec.ts` + `sharing/reports/approvals e2e` |
| 2. Kapsam genisligi: `apps/web/src` + `apps/api/src` (spec haric) kullaniciya donuk TUM dizeler | Web: 22 dosya (sayfa/bilesen/hook hata metinleri, aria-label/alt), API: 31 dosya (hata zarfi mesajlari, DTO dogrulama metinleri, e-posta konu/govdesi, WhatsApp on-metni, PDF etiketleri, odeme sepet kalemi) | Olcum asagida "Kapsam olcumu"; her dosyanin dizesi kendi birim/e2e testinde assert ediliyor |
| 3. PDF etiket sabitleri Turkce + PDF ciktisinda BOZULMADAN gorunur (`extractPdfText`) | `report-pdf.builder.ts`: `TEMPLATE_LABEL='Şablon: '`, `PHOTO_STAMP_LABEL='Fotoğraf tarihi: '`, `APPROVAL_HEADING='Taraf onayı'` (H-001 gomulu Unicode fontu bu harfleri tasiyor) | `report-pdf.builder.spec.ts` → "sabit etiketleri ASCII karsiligiyla degil, duzgun Turkce ile basar (H-002)"; `report-pdf.e2e-spec.ts` → "indirilen PDF'in sabit etiketleri duzgun Turkce basilir (H-002)" |
| 4. Regresyon: mevcut unit/e2e testler guncel Turkce metinlerle GECER | Test dosyalarindaki assert/sorgu dizeleri ASCII karsiligi ile degil, guncel metnin kendisiyle guncellendi | Tum paket yesil (asagidaki kosum ciktisi) |
| 5. `test`, `test:e2e`, `lint`, `typecheck` temiz | — | Kosum ciktisi bolumu |

## Kapsam olcumu (once/sonra)

Olcut: dosyanin **dize/JSX metni** icinde Turkce'ye ozgu karakter (`ş ğ ı ç ö ü` ve buyukleri)
gecmesi (yorumlar haric tutuldu — yorumdaki Turkce karakter kullaniciya donuk metni kanitlamaz).
Kapsam: `apps/web/src` + `apps/api/src`, `*.spec.*` haric.

| Olcum | Once (H-002 oncesi, `5b7662f`) | Sonra |
|---|---|---|
| `apps/web/src` | 0 / 63 dosya | **22 / 63** |
| `apps/api/src` | 0 / 99 dosya | **31 / 99** |

Geri kalan dosyalarda kullaniciya donuk dize ya yok (modul/port/mapper/repository, tip
tanimlari, teknik sabitler) ya da metin zaten aksan gerektirmiyor ("Yeni Tutanak",
"Abonelik durumu", "Tekrar Dene", "En az 8 karakter", "Pasif/Beklemede/Aktif"). Kalan tum
dosyalar tek tek tarandi (dize literalleri + JSX metin dugumleri + `aria-label/placeholder/
alt/title` oznitelikleri + `new *Error(...)` mesajlari); duzeltilmemis kullaniciya donuk
ASCII katlanmasi kalmadi.

## Alinan Kararlar ve Gerekceler

- **Duzeltme dizenin bulundugu yerde yapildi; i18n katmani EKLENMEDI.** Ticket kapsam disi
  diyor, CLAUDE.md §11 "coklu dil altyapisi v2+" diyor. Metin sabitleri bulunduklari
  bilesende/serviste kaldi.
- **Anlam ve ekran durumlari DEGISMEDI.** Yalnizca yazim duzeltildi; `design.md`
  sartnamesindeki loading/empty/error/success durumlari, metinlerin anlami, hata kodlari ve
  `code` degerleri aynen korundu (istemci `code` ile dallanir, metinle degil — §4.3).
- **PDF etiketleri H-001'den SONRA degistirildi.** Font gomme (`5b7662f`) branch'in
  atasindadir; dolayisiyla etiketler ciktida bozulmadan basiliyor ve bunu uctan uca test
  kanitliyor. Sira ticket'in istedigi gibi: once font, sonra metin.
- **Saglayicinin odeme sayfasindaki sepet kalemi adi da kullaniciya donuktur**
  (`iyzico-payment.adapter.ts` → `Aylık abonelik`); dizeyi gonderdigimiz yer disarisi olsa
  da metni goren kullanicidir. Makine tarafi kimlik (`basketId = 'aylik-abonelik'`) ASCII
  birakildi — bu bir tanimlayicidir, metin degil (§2).
- **Kullaniciya donuk OLMAYAN metinlere DOKUNULMADI** (kapsam disi): `config/env.schema.ts`
  ve `access-token-ttl.parser.ts` acilis dogrulama mesajlari (operator gorur, uygulama
  acilmaz), pino log mesajlari (`billing.service.ts`, `resend-email.adapter.ts`,
  `r2-storage.adapter.ts` ic hata metni), gelistiriciye donuk degismez ihlali mesajlari
  (`SessionProvider.tsx`, `main.tsx`). Ticket "kullaniciya donuk dizeler" diyor; bunlari da
  cevirmek kapsam kaymasi olurdu.
- **Test verisi dersi uygulandi** (`testing/yerellestirilmis-urunde-ascii-katlanmis-test-verisi.md`):
  yeni testler dizenin KENDISINI ariyor ve ayrica ASCII katlanmis halin ciktida
  KALMADIGINI (`not.toContain('Sablon: ')`) dogruluyor — yani test, metni tekrar ASCII'ye
  dusuren bir regresyonu yakalar.
- **Kirmizi-yesil disiplini:** PDF etiket testi once yazildi ve `Sablon: ` ciktisiyla
  KIRMIZI kosuldu; e2e etiket testi de etiket sabiti gecici olarak eski haline dondurulup
  kirmizi gorulduktan sonra yesile alindi. Ayni sey sepet kalemi testi icin de yapildi
  (`Received: "Aylik abonelik"`).
- **Verimlilik:** degisiklik yalnizca sabit dize icerigidir; algoritma, dongu, sorgu veya
  istek basina is miktari degismedi. Sicak yol (PDF uretimi) icin ek maliyet yok.

## Varsayimlar

- Kaynak dosyalar UTF-8 kodlanmis olarak okunuyor/derleniyor (mevcut `tsconfig`/Vite/Jest
  kurulumunda dogrulandi: testler Turkce dizeleri birebir esliyor).
- `design.md` metinleri sartname olarak ASCII yazilmis olsa da bunlar aksanli Turkce'nin
  katlanmis halidir; anlam degismedigi surece aksanli yazim sartnameye AYKIRI degildir.

## Anayasa (CLAUDE.md) Bosluklari

- Anayasa §2 "mesaj metinleri Turkce" diyor ama **yazim/aksan** beklentisini (ve bunun
  kullaniciya donuk/operatore donuk metin ayrimini) tanimlamiyor. Bu ticket'ta secilen
  kural: **kullaniciya (veya kiraciya/odeme sayfasindaki musteriye) gosterilen her metin
  tam aksanli Turkce**; log/env/gelistirici mesajlari oldugu gibi birakildi. Kalicilastirmak
  icin anayasa aday cumlesi: "Kullaniciya gosterilen metinler tam aksanli Turkce yazilir;
  tanimlayicilar ve makine tarafi degerler ASCII kalir."

## Bilinen Sinirlamalar

- **Regresyon kilidi (CI/lint kurali) UYGULANMADI — ticket bunu raporlamami istiyor.**
  Onerilen kural: kullaniciya donuk dize iceren dosyalarda ASCII'ye katlanmis Turkce'yi
  yakalayan bir kontrol. Uygulanabilir en ucuz bicim: `eslint.config.mjs` icine
  `no-restricted-syntax` ile `apps/web/src/**` ve `apps/api/src/**` (spec haric) icin
  bilinen katlanmis kaliplari (ornegin `/\b(bulunamadi|gecersiz|basarisiz|paylasim|
  goruntule|sifre|odeme|fotograf|sablon|tutanagi|henuz|degil|lutfen)\b/` gibi bir sozluk)
  reddeden bir kural; alternatif olarak `.github/workflows/ci.yml`'a bir tarama adimi.
  Iki dosya da (`eslint.config.mjs` kok lint yapilandirmasi, `.github/workflows/**`) bu
  ajanin yazma alani disinda oldugu icin ayri bir ticket/insan karari olarak
  degerlendirilmeli. Kural sozluk tabanli oldugu icin yanlis pozitif uretebilir; whitelist
  (log/env dosyalari) ile birlikte tasarlanmali.
- Metin ureten diger yuzeyler bu ticket'ta dogrulandi (PDF, e-posta konusu/govdesi,
  WhatsApp on-metni, API hata zarfi), ancak **PDF disindaki yuzeyler icin "gorsel
  render" dogrulamasi yoktur** — e-posta istemcisi/WhatsApp tarafi UTF-8 tasidigi icin
  ek onlem gerekmedi.

## Ticket Disi Fark Edilen Sorunlar (DOKUNULMADI)

- `apps/web/src/api/schema.d.ts` (uretilmis dosya) ve kaynagi `factory/04-architecture/
  api-contract.yaml` icindeki endpoint aciklamalari hala ASCII'ye katlanmis Turkce
  ("Tutanak bulunamadi (NOT_FOUND) VEYA ... henuz paylasim linki uretilmemis"). Bunlar
  kullaniciya degil, sozlesme okuyucusuna donuktur; ayrica `schema.d.ts` elle
  duzenlenmez (§3.6) ve `04-architecture/*` dev ajanina kapalidir (§11). Not birakildi.
- Kod yorumlari ve `factory/**` belgeleri genelinde ASCII katlamasi devam ediyor; bu
  bilincli uslup gorunuyor ve kullaniciya donuk degil — dokunulmadi.
- `SubscriptionPage`'in "odeme sonucu bekleniyor" ekraninin DAVRANISI (yoklama/yenileme
  yok) hala cikmaz sokak — B-003 kapsaminda, bu ticket yalnizca metni cevirdi.

## Test Kosum Ciktisi (ozet)

```
$ npm run test
Test Suites: 11 passed, 11 total     (kok / tools)
Tests:       74 passed, 74 total
Test Suites: 56 passed, 56 total     (apps/api birim)
Tests:       386 passed, 386 total
Test Suites: 55 passed, 55 total     (apps/web birim)
Tests:       408 passed, 408 total

$ DATABASE_URL=... npm run test:e2e   (izole Postgres 16 konteyneri)
Test Suites: 13 passed, 13 total
Tests:       202 passed, 202 total

$ npm run lint          -> 0 uyari (eslint --max-warnings=0)
$ npm run typecheck     -> temiz (kok + api + web)
$ npm run format:check  -> All matched files use Prettier code style!
```

Kirmizi-yesil kanitlari (yesile gecmeden once gorulen hatalar):

```
● ReportPdfBuilder › sabit etiketleri ASCII karsiligiyla degil, duzgun Turkce ile basar (H-002)
  Expected substring: "Şablon: "
  Received string:    "... Sablon: Giriş/Çıkış Teslim Tutanağı ... Fotograf tarihi: ... Taraf onayi ..."

● GET /reports/{id}/pdf › indirilen PDF"in sabit etiketleri duzgun Turkce basilir (H-002)
  Expected substring: "Şablon: "

● IyzicoPaymentAdapter.createCheckout › odeme sayfasinda gorunen sepet kalemi adini duzgun Turkce gonderir (H-002)
  Expected: "Aylık abonelik"  /  Received: "Aylik abonelik"
```
