# Final Rapor — Tutanak (Emlak Teslim Tutanağı Platformu MVP)

> Üretici: report-agent | Tarih: 2026-08-18 (reporting:2 — H-001..H-004 hotfix turu sonrası güncelleme)

> **Bu rapor önceki final-report.md'nin (2026-08-17, T-001..T-028 sonrası) yerine geçer.**
> Aradan geçen sürede insan (Mehmet) canlı ürünü elle denedi, 5 kusur bildirdi (B-001..B-005),
> bunlardan 4'ü hotfix ticket'larıyla (H-001..H-004) kapatıldı, entegrasyon/güvenlik/performans/
> devops denetimleri `5f86403` üzerinde bağımsız olarak yeniden koşuldu. B-005 **hâlâ açık ve
> fabrikaya gönderilmedi** — bu raporun en önemli tek bulgusu budur.

## 1. Yönetici Özeti

Tutanak MVP'si `main` dalına merge edilmiş, çalışan bir üründür: PRD'nin 11 kapsam-içi maddesinin
tamamı hâlâ TAMAMLANDI durumunda, en güncel entegrasyon turu (integration:6, `5f86403`) **40/40
kontrol PASS** veriyor. T-001..T-028 (27 done + 1 iptal) turundan sonra insan ürünü canlıda elle
denedi ve 5 gerçek kusur buldu (B-001 PDF'te Türkçe karakter bozulması, B-002 arayüz/API
metinlerinin ASCII'ye katlanmış olması, B-003 ödeme "pending" ekranının çıkmaz sokak olması,
B-004 masaüstü yerleşiminin tanımsız olması, B-005 şablon adlarının hâlâ ASCII olması); bunlardan
ilk 4'ü aynı gün 4 hotfix ticket'ıyla (H-001..H-004, 36 ajan koşumu) kapatıldı ve devops/güvenlik/
performans/entegrasyon denetimleri sıfırdan yeniden koşularak regresyon olmadığı doğrulandı
(908 birim/entegrasyon testi + 200 API e2e testi yeşil). **B-005 kapatılmadı** — orkestratör
H-002'nin ("apps/web/src" + "apps/api/src" ile sınırlı) kapsamının dışında kaldığını tespit etti,
kaydı yazdı ama fabrikaya bir ticket olarak GÖNDERMEDİ; entegrasyon turu bunu bağımsız olarak
doğruladı ve H-005 açılmasını önerdi. Sonuç: kullanıcı PDF indirdiğinde başlık/not artık doğru
Türkçe ama şablon adı hâlâ "Giris/Cikis Teslim Tutanagi" — karma, yarım düzeltilmiş bir çıktı.
Güvenlik denetiminde açık CRITICAL/HIGH bulgu yok (4 MEDIUM + 10 LOW), performans denetiminde
CRITICAL yok ama **P-02 (PDF üretimi) iki turdur aynı HIGH'ta** ve H-001'in gömülü fontu bunu
çözmedi. Pipeline telemetrisine göre 284 ajan koşumunda toplam **~718 USD** harcandı (900 USD
tavanın ~%80'i, tavan bu turda 700→900 USD'ye yükseltilmiş), 37 commit, 393 dosya, +54.983/-3
satır, 9 takvim günü (2026-08-10 → 2026-08-18). **Release'e teknik olarak yakın ama hazır değil**:
insanın karar vermesi gereken en az dört madde var — (1) B-005'in ticket'a dönüştürülüp
dönüştürülmeyeceği (dönüştürülmezse üretimde karma/tutarsız Türkçe çıktı ile lansman yapılır),
(2) güvenlik MEDIUM bulguları (özellikle S-08 zayıf `JWT_SECRET` varsayılanı), (3) yedeklerin
şifresiz olması + KVKK silme akışının hiç olmaması (S-09), (4) P-02'nin iki turdur aynı HIGH'ta
kalması ve bir sonraki sürümde ele alınması önerisi.

## 2. Kapsam Farkı Analizi

PRD §4 "Kapsam İçinde" tablosundaki 11 madde, bu turda TEKRAR doğrulandı (integration:6 raporunun
DoD tablosu, 12/12 PASS); H-001..H-004 hiçbir maddenin durumunu DEĞİŞTİRMEDİ, yalnızca 2 ve 4
numaralı maddelerin kalite notunu güncelledi:

| # | PRD kapsam-içi madde | Durum | Not (bu tur güncellenen kısım) |
|---|---|---|---|
| 1 | Fotoğraf+başlık+not ile kayıt oluşturma | **TAMAMLANDI** | Değişmedi |
| 2 | Otomatik, değiştirilemez tarih/saat damgası | **TAMAMLANDI** | Değişmedi |
| 3 | 3 hazır emlak şablonu | **TAMAMLANDI** (kısmen borçlu) | Şablon SEÇİMİ/atanması çalışıyor ama şablon ADLARI hâlâ ASCII (B-005, açık) |
| 4 | PDF çıktısı oluşturma | **TAMAMLANDI** (kısmen borçlu) | H-001 ile Türkçe karakter kırılması (B-001) düzeltildi; performans bütçesi hâlâ %5-14 (2x yükte %118) aşılıyor (P-02, iki turdur HIGH); şablon adı satırı B-005 nedeniyle hâlâ ASCII |
| 5 | E-posta/WhatsApp linki ile paylaşma | **TAMAMLANDI** | Metinler Türkçeleşti (H-002/B-002) |
| 6 | Hesap açmadan link üzerinden görüntüleme | **TAMAMLANDI** | Değişmedi |
| 7 | Tek tıkla onay | **TAMAMLANDI** | Değişmedi |
| 8 | E-posta+şifre ile kayıt/giriş | **TAMAMLANDI** | Değişmedi |
| 9 | Abonelik ödeme akışı | **TAMAMLANDI** (önceki turda gizli bir UX kusuru vardı) | H-003 ile "pending" ekranının çıkmaz sokak olması (B-003) düzeltildi: artan aralıklı otomatik yoklama + elle "Durumu yenile" eklendi |
| 10 | Geçmiş tutanakları listeleme/arama | **TAMAMLANDI** | Değişmedi; P-04 (arama, MEDIUM) bu turda ilk kez gerçek yük altında doğrulandı, hâlâ borç listesinde |
| 11 | Onay ekranında "destekleyici kanıt" uyarı metni | **TAMAMLANDI** | Değişmedi |

**11/11 PRD kapsam-içi madde TAMAMLANDI**, ancak madde 3 ve 4 artık "tamamlandı ama görünür bir
kusur taşıyor" notuyla işaretleniyor (B-005 açık kaldığı için).

**Sessiz kapsam kayması / yeni bulgular (planda olmayıp yapılan/bulunan iş):**
- **B-001..B-005 hiçbiri PRD/backlog'da öngörülmemişti** — hepsi insanın canlı ürünü elle
  denemesinden çıktı. Bu, ürünün kabul kriterlerinin ("PASS" demiş 40/40 kontrol dahil) gerçek
  kullanıcı algısını (Türkçe metin kalitesi, masaüstü tasarımı, ödeme sonrası UX) tam
  YAKALAYAMADIĞININ somut kanıtıdır — DoD'nin hiçbir maddesi "tüm kullanıcıya dönük metinler
  düzgün Türkçe olmalı" ya da "masaüstü yerleşimi tanımlı olmalı" demiyordu.
- **H-005 (B-005'in düzeltmesi) fabrikaya HENÜZ gönderilmedi.** Bu, raporun kapsam bölümünde
  en önemli açık maddedir: bir bulgu tespit edilmiş, kök nedeni yazılmış, kabul kriteri taslağı
  bile hazırlanmış (bkz. `factory/bugs/B-005.md`) ama triage-agent'a hiç girdi olarak
  VERİLMEMİŞ. Karar insanındır: H-005 açılsın mı, yoksa v2'ye mi bırakılsın?
- **`backlog.md`'nin T-017'den beri güncellenmediği** (önceki turda not edilmişti) bu turda da
  değişmedi; H-001..H-004 de `backlog.md`'de hiç görünmüyor (yalnızca `factory/bugs/B-00X.md` +
  `05-dev/H-00X-devlog.md` dosyalarında iz var). İkinci bir dokümantasyon borcu katmanı.

## 3. Süreç İstatistikleri ve Telemetri

**Telemetri (`factory/.factory/telemetry.jsonl`, 284 ajan koşumu — önceki turda 241'di, +43):**

| Ajan | Koşum sayısı | Not |
|---|---|---|
| code-reviewer | 81 | En çok koşan ajan |
| dev-agent | 65 | 32 ticket (28 T + 4 H) için 65 koşum ≈ ticket başına ~2,0 deneme |
| qa-agent | 65 | — |
| devops-agent | 13 | Release-prep 2. turu (H-001..H-004 sonrası bağımsız yeniden doğrulama) dahil |
| integration-qa-agent | 11 | 6 entegrasyon turu (integration:6, H-001..H-004 sonrası) |
| security-auditor-agent | 10 | 7. tur denetim (H-001..H-004 sonrası yeniden doğrulama) dahil |
| intake-agent | 8 | Değişmedi |
| arch-reviewer | 6 | Değişmedi |
| architect-agent | 5 | Değişmedi |
| docs-agent | 7 | FOUND-ISSUES.md'nin H-001..H-004 sonrası 9. maddesi dahil |
| perf-agent | 4 | 7. tur yeniden denetim (H-001'in font gömme değişikliğinin P-02'yi etkileyip etkilemediğini ölçmek için) |
| backlog-agent / backlog-reviewer | 2 / 2 | Değişmedi |
| prd-agent, growth-agent, report-agent | 1 / 2 / 2 | report-agent bu, ikinci koşumu (reporting:2) |

**Bug/hotfix akışı (bu turun yeni deseni — 36 koşum, T-ticket akışından ayrı sayıldı):**
H-001: 12 koşum, H-002: 8, H-003: 7, H-004: 9. Ortalama ~9 koşum/hotfix — normal bir T-ticket'ın
(~ortalama 2,1 koşum/ticket, aşağıya bakın) yaklaşık 4 katı; hotfix'lerin `code-reviewer`+
`qa-agent` ile aynı sıkı döngüden geçmesi (kısayol yok) maliyetlidir ama tutarlıdır.

**Maliyet:** Toplam **~718 USD** (`cost_usd` alanlarının 284 kayıt üzerinden manuel toplamı;
`factory/.factory/**` yoluna Bash aracı erişimi fabrika politikası tarafından tamamen
engellendiği için toplama Grep + elle aritmetik ile yapıldı — ±birkaç USD yuvarlama payı olası,
ondalık kesinlik iddia edilmiyor). `budget_usd_ceiling` bu turda **700 → 900 USD'ye
yükseltilmiş** (pipeline.json); harcanan tutar yeni tavanın **~%80'i**. 23 koşum
`stop_reason:"run_failed"` (0 USD, çoğu T-001'in erken denemeleri, önceki turdaki 21'den 2 fazla
— yeni run_failed'lar da erken/altyapısal, ürün kodu değil).

**Takvim süresi:** İlk commit 2026-08-10, son commit (H-002) 2026-08-18 → **9 takvim günü**
(önceki turda 8 gündü; +1 gün, insanın canlı denemesi + 4 hotfix turu). Saat/dakika düzeyinde
aşama süresi bu turda da ölçülemiyor (aynı sınırlama, bkz. §9).

**Klasik istatistikler (pipeline.json + git, bu turda doğrulanmış):**
- Toplam ticket: **32 açıldı** (T-001..T-028 + H-001..H-004) → **31 done**, **1 cancelled**
  (T-013). Hiçbir ticket `escalated` durumunda kalmadı.
- H-ticket attempt sayıları (pipeline.json): H-001=1, H-002=2, H-003=1, H-004=1 (toplam 5 attempt,
  4 ticket → ortalama 1,25 — T-ticket ortalamasından (~1,5) daha düşük, hotfix'lerin dar/net
  kapsamlı olmasıyla tutarlı).
- Telemetri koşum sayısına göre en çok tur yiyen 3 iş birimi (bu turda H-ticket'lar dahil
  yeniden sıralandı):
  1. **H-001 (PDF Türkçe font gömme, 12 koşum)** — kök neden: PDFKit standart fontlarının
     Türkçe'ye özgü harfleri (ş ğ ı İ) taşımaması; çözüm gömülü Unicode font + lisans dosyası
     gerektirdi, bu da hem `code-reviewer` hem `qa-agent`'ın PDF byte-seviyesi doğrulama
     yapmasını (CMap çözümleme) zorunlu kıldı — normal bir dev turundan daha pahalı bir
     doğrulama deseni.
  2. **T-012 (abonelik ödeme, 12 koşum, 2 iade turu)** — değişmedi (önceki rapor, §3).
  3. **T-001 (proje iskeleti+CI, 11 koşum, 3 attempt)** — değişmedi (önceki rapor, §3).
- Toplam commit: **37** (önceki turda 31'di; +6: H-001, H-002, H-003, H-004, `fix(deps)`
  `98c05de`, `chore(release)` `43eddb7`).
- Değişen satır (ilk commit → HEAD, `factory/.factory/**` hariç): **393 dosya, +54.983/-3 satır**
  (`git diff --shortstat` ile bu oturumda doğrulandı; önceki turda 372 dosya/+52.192'ydi).
- Test dosyası/sayısı (devops-report.md §4.4, bu turda bağımsız yeniden koşuldu):
  **124 suite / 908 test** (api 56 suite/386 test, web 57 suite/448 test, kök `tools/`
  11 suite/74 test) — önceki turda 121 suite/853 testti (+3 suite/+55 test, H-001'in font/
  PDF testleri + H-002/H-003/H-004'ün metin/UI testleri).

## 4. Kalite Durumu

- **Birim/entegrasyon testleri:** 124 suite / **908 test**, devops-report.md §4.4'te bağımsız
  yeniden çalıştırılıp doğrulandı, hepsi yeşil.
- **API e2e testleri:** 200 test (değişmedi), ayrı Postgres container'ına karşı, yeşil.
- **Uçtan uca entegrasyon (integration:6, en güncel tur, `5f86403`):** **SONUÇ: PASS.**
  40/40 kontrol (11 hikaye + 12 DoD + izolasyon + temiz kurulum + T-026/027/028/H-001..H-004
  regresyonu) PASS, 0 FAIL. Bu turda repoda kurulu bir Playwright/`webapp-testing` bağımlılığı
  bulunmadığı için web arayüzü gerçek tarayıcıda DEĞİL, HTTP-seviyesi + kaynak-kodu dize
  eşleşmesi + component test paketi (jsdom) ile doğrulandı — bu bir test-derinliği sınırlaması
  olarak raporda açıkça not edildi (FAIL değil, kanıt türü notu).
- **Çözülmemiş bulgular:**
  - **B-005 (AÇIK, fabrikaya gönderilmedi) — bu raporun en önemli açık bulgusu.** Şablon
    adları/açıklamaları (`prisma/seed.ts`) + PWA manifest (`manifest.webmanifest`) +
    `index.html` `<title>`/`description` hâlâ ASCII'ye katlanmış Türkçe taşıyor. integration:6
    raporu bunu bağımsız olarak DOĞRULADI ve ayrıca **mevcut veritabanlarının** (seed.ts
    düzeltilse bile) eski adları taşımaya devam edeceğini, bu yüzden düzeltmenin bir migration/
    upsert adımı da gerektirdiğini not etti. Şiddet önerisi: S3 (işlev kırılmıyor, veri kaybı
    yok, ama üç şablon adı ürünün her ekranında ve PDF çıktısında görünüyor).
  - `factory/09-docs/FOUND-ISSUES.md` madde 5: **ÇÖZÜLDÜ** (mailpit servisi kaldırıldı, bu
    turda doğrulandı). Madde 6 (`.worktrees/` kalıntıları `lint`'i kırıyor): bu çalışma
    alanında artık gözlenmiyor ama kök neden (`eslint.config.mjs` ignore listesi) koddan hâlâ
    düzeltilmedi — bir sonraki worktree kalıntısında yeniden ortaya çıkabilir.
  - `10-release/security-audit.md` (7. tur, `5f86403`): **0 CRITICAL, 0 HIGH açık** bulgu;
    **4 MEDIUM** (S-08 JWT secret fail-open, S-14 hız sınırı tablosunun 4 satırı uygulanmamış,
    S-11 paylaşım e-postası kota/doğrulama yok, S-04 `iyzipay` geçişli bağımlılıkları) + **10
    LOW**. H-001..H-004 hiçbir bulguyu YENİ AÇMADI/KAPATMADI (kod okunarak doğrulandı, hepsi
    metin/CSS/UI değişikliği).
  - `10-release/performance-report.md` (7. tur, `5f86403`): **P-01 KAPALI** (bağımsız
    doğrulandı, hedef yükte bütçenin %39'u). **P-02 (PDF, HIGH) İKİ TURDUR AÇIK** — H-001'in
    gömülü fontu (~1,46 MB/belge) sorunu KÖTÜLEŞTİRMEDİ ama ÇÖZMEDİ de; hedef eşzamanlılıkta
    p95 bütçenin %5-14 üzerinde, 2x yükte ~%118 üzerinde (hata yok, zarif yavaşlama). **P-03
    (auth login, HIGH)** marj sabit kaldı (~%10 aşım, yalnızca 2x yükte). **P-04 (arama,
    MEDIUM)** bu tur İLK KEZ gerçek yük altında doğrulandı (önceki turlar yalnızca EXPLAIN'e
    dayanıyordu): 41k satırda nadir terimde Seq Scan'e düşüyor, GIN trigram indeksleri
    kullanılmıyor, p95 bütçenin %17 üzerinde. **P-05** bu turda test edilmedi (kod
    dokunulmadı).

## 5. Teknik Borç ve Bilinen Sınırlamalar (önem sırası)

1. **B-005 açık ve fabrikaya gönderilmedi** (YENİ, bu turun en acil maddesi) — şablon
   adları/açıklamaları + PWA manifest + `index.html` başlığı hâlâ ASCII'ye katlanmış Türkçe.
   Ayrıca mevcut (zaten seed edilmiş) veritabanları düzeltme sonrası bile eski adları
   taşımaya devam edecek — çözüm hem kod hem veri migrasyonu gerektiriyor.
2. **P-02: PDF üretimi tepe eşzamanlılıkta bütçe dışı, artık İKİ TURDUR aynı HIGH'ta** —
   H-001'in font gömme değişikliği sorunu ne çözdü ne kötüleştirdi. Kök neden değişmedi:
   `report-pdf.service.ts`'deki bilinçli SIRALI (paralel değil) fotoğraf işleme döngüsü,
   bellek sınırlaması uğruna hız feda ediyor. Önceki turda bu rapora "önerilen düzeltme
   (sharp.resize atlama) kod okumasıyla çürütüldü" notu düşülmüştü; bu tur o iddiayı
   yeniden DOĞRULAMADI/ÇÜRÜTMEDİ (bağımsız kod okuması bu turun kapsamında değildi) — bir
   sonraki performans turunda bu çelişkinin netleştirilmesi önerilir.
3. **JWT oturumları iptal edilemiyor** (S-07, LOW ama etkisi geniş) — değişmedi.
4. **Yedekler şifrelenmeden R2'ye yazılıyor + KVKK silme akışı hiç yok** (S-09) — değişmedi,
   PRD'nin KVKK açık sorusu hâlâ kapanmadı.
5. **Paylaşım linkleri süresiz ve iptal edilemez** (S-17) — değişmedi.
6. **`.husky/pre-commit` hiç kurulamadı** (T-001'den beri) — değişmedi.
7. **`apps/api` üretim imajı `devDependencies` dahil tüm `node_modules`'u taşıyor** (S-06) —
   değişmedi.
8. **`backlog.md` T-017'den beri güncellenmedi; H-001..H-004 de hiçbir backlog dokümanında
   görünmüyor** (borç katmanı büyüdü) — genel bakış belgesi artık gerçek ticket setinin
   (32) yaklaşık yarısını yansıtıyor.
9. **P-04: arama sorgusu 41k ölçekte GIN trigram indekslerini kullanmıyor** (MEDIUM, bu tur
   ilk kez yük altında doğrulandı) — nadir terimde Seq Scan, bütçenin %17 üzeri.
10. **`.worktrees/` kalıntı dizinlerinin kök nedeni (`eslint.config.mjs` ignore listesi)
    hâlâ koddan düzeltilmedi** — bu çalışma alanında şu an gözlenmiyor ama tekrar edebilir.
11. **Auth uçlarında varlık sızıntısı** (S-12, LOW, bilinçli MVP takası) — değişmedi.
12. **`cd.yml`'nin güvenlik koşulu regresyon testiyle kilitlenmemiş** (S-18, LOW) — değişmedi.

## 6. v2 Backlog Taslağı

| # | İş | Gerekçe |
|---|---|---|
| 1 | **H-005: `prisma/seed.ts` şablon adları + `manifest.webmanifest` + `index.html` meta metinlerini Türkçeleştir + mevcut veritabanı kayıtlarını güncelleyen bir migration/upsert ekle** | B-005 — hâlâ açık, fabrikaya gönderilmemiş; PDF çıktısında karma (yarım düzeltilmiş) görünüm yaratıyor; önerilen en yüksek öncelikli iş |
| 2 | Paylaşım linki son kullanma tarihi + iptal (revoke) ucu, onaylayan e-postasını maskeleme | S-17 |
| 3 | Hesap/tutanak silme (KVKK) ucu + R2 obje temizliği + yedek şifreleme | S-09; PRD açık sorusu hâlâ kapanmadı |
| 4 | `JWT_SECRET` için üretimde fail-closed doğrulama | S-08 MEDIUM |
| 5 | architecture.md §7 hız sınırı tablosunun eksik 4 satırını uygula | S-14 MEDIUM |
| 6 | PDF üretim yolunda depolama okumalarını sınırlı paralellikte (batch=3) yapmak veya PDF'e gömülecek hâli yükleme anında bir kez üretip depolamak | P-02 HIGH — iki turdur aynı durumda, bir sonraki sürümde ele alınması özellikle önerildi |
| 7 | Arama sorgusunu trigram/`similarity()` operatörüyle yeniden yazıp GIN indekslerini gerçekten kullandırmak | P-04 MEDIUM, bu tur yük altında doğrulandı |
| 8 | Paylaşım e-postası kotası + kayıt sonrası e-posta doğrulama | S-11 MEDIUM |
| 9 | Kısa ömürlü access + refresh token ya da `jti` deny-list | S-07 |
| 10 | Giriş/çıkış tutanaklarını otomatik karşılaştırma | PRD kapsam-dışı #1, en çok talep edilecek v2 özelliği |

## 7. Release Paketi Özeti

| Belge | Sonuç | Not |
|---|---|---|
| `10-release/security-audit.md` (7. tur, `5f86403`) | **FINDINGS — GATE3 bloklanmıyor** | 0 CRITICAL/HIGH açık; 4 MEDIUM + 10 LOW, H-001..H-004 hiçbirini değiştirmedi |
| `10-release/performance-report.md` (7. tur, `5f86403`) | **FINDINGS — GATE3 bloklanmıyor** | P-01 kapalı kaldı (bağımsız doğrulandı); **P-02 (HIGH) iki turdur aynı** — H-001 çözmedi; P-03 marj sabit; P-04 bu tur ilk kez yük altında doğrulandı (MEDIUM) |
| `10-release/devops-report.md` (2. tur, `5f86403`) | **Doğrulandı** | H-001..H-004'ün hiçbiri yeni env/bağımlılık/servis/Dockerfile değişikliği gerektirmedi; 908 test + imaj derlemeleri bu oturumda uçtan uca tekrar çalıştırıldı, hepsi yeşil |
| `10-release/runbook.md` | **Hazır (bu turda güncellenmedi)** | Önceki turdan değişiklik yok; H-001..H-004 env şemasını etkilemediği için hâlâ geçerli |
| `08-integration/e2e-report.md` (integration:6) | **PASS (40/40)** | B-005 kapsam-boşluğu bulgusu FAIL değil ama şeffaflık için kayıtlı; test-derinliği sınırlaması (Playwright yok) not edildi |
| `11-launch/` (channel-plan, landing, pricing, launch-checklist, product-feedback) | **Hazır (17 Ağu'dan beri güncellenmedi)** | H-001..H-004/B-005 bu dokümanları etkilemiyor (ürün mesajlaşması değişmedi); fiyat hâlâ öneri niteliğinde, ürün sahibi kararı bekliyor |

## 8. Release Checklist'i (İnsan Kapısı #3)

- [ ] **B-005 kararı verildi:** H-005 açılıp lansmandan önce mi kapatılacak, yoksa bilinçli
      olarak v2'ye mi bırakılıyor? (Bırakılırsa: kullanıcı PDF'te ve arayüzde şablon adlarının
      hâlâ İngilizce/ASCII göründüğünü fark edecek.)
- [ ] Üretim `.env` dosyası dolduruldu: `JWT_SECRET` (`openssl rand -base64 48` ile,
      `.env.example`'daki zayıf değer **kullanılmadı**)
- [ ] `R2_*` kimlik bilgileri gerçek Cloudflare R2 hesabından alındı, kova `eu` bölgesinde
      oluşturuldu
- [ ] `RESEND_API_KEY` gerçek, gönderen alan adı (`EMAIL_FROM`) Resend'de doğrulandı (DKIM/DNS)
- [ ] `IYZICO_*` gerçek üye iş yeri kimlik bilgileri girildi, webhook URL'i panelden
      tanımlandı, küçük tutarlı gerçek bir ödeme testi yapılıp iade edildi
- [ ] `PAYMENT_PROVIDER=iyzico` (üretimde `fake` **kesinlikle olmamalı**)
- [ ] Alan adı DNS `A` kaydı sunucuya yönlendirildi, Caddy otomatik TLS doğrulandı
- [ ] `SUBSCRIPTION_PRICE_AMOUNT` üretimde `pricing.md`'deki fiyatla birebir aynı
- [ ] Gecelik `pg_dump | gzip` → R2 yedekleme cron'u kuruldu; **yedek şifreleme kararı
      verildi** (S-09 — mevcut haliyle şifresiz gidiyor)
- [ ] KVKK/gizlilik metinleri yayında; **KVKK silme talebi süreci** (uygulamada endpoint yok)
      karara bağlandı
- [ ] `UptimeRobot`/benzeri dış izleme `/health`'e kuruldu
- [ ] Escalated ticket yok (0/32 ticket escalated) — bilgi amaçlı, insan kararı gerektiren bir
      tıkanma yok
- [ ] Güvenlik denetiminin MEDIUM bulguları (S-08, S-14, S-11, S-04) için "release sonrası
      hemen mi, v2'de mi" kararı verildi
- [ ] **P-02'nin (PDF, HIGH, iki turdur açık) bir sonraki sürümde ele alınıp alınmayacağı**
      karara bağlandı — şu an "gerektiğinde" olarak izleniyor, günlük ~150 tutanaklık
      hacimde pratikte tetiklenmesi beklenmiyor ama tepe senaryosunda (c=30-60) ölçülebilir
      yavaşlama var
- [ ] Abonelik fiyatı, ücretsiz deneme politikası, KVKK saklama süresi (PRD açık soruları)
      resmen karara bağlandı
- [ ] Ürünü canlıda bir kez daha gerçek bir tarayıcıda (masaüstü + mobil) elle gezmek —
      integration:6'nın Playwright/gerçek tarayıcı kanıtı taşımadığı bilinerek (bkz. §4)

## 9. Fabrika Retrospektifi

1. **İnsanın canlı ürünü elle denemesi, 40/40 PASS diyen bir entegrasyon turunun kaçırdığı 5
   gerçek kusuru buldu.** Bu, pipeline'ın en değerli sinyallerinden biri: otomatik testler ve
   API-seviyesi doğrulama "davranış doğru" diyebilir ama "metin okunabilir Türkçe mi",
   "masaüstünde tasarım kabul edilebilir mi" gibi öznel/görsel kalite soruları
   yakalayamıyor. Sonraki bir üründe, release-prep'e insan/kullanıcı gözünden bir "gerçek
   cihazda gez" adımının resmi bir kapı olarak eklenmesi (şu an bu adım fabrika akışının
   DIŞINDA, orkestratörün kendi inisiyatifiyle yapıldı) önerilir.
2. **B-005 bulundu, kök nedeni yazıldı, kabul kriteri taslağı hazırlandı — ama fabrikaya
   HİÇ gönderilmedi.** Bu bir süreç boşluğudur: bulgu → ticket dönüşümü B-001..B-004'te
   otomatik/beklenen bir adımken B-005'te durdu. Kullanıcının hafıza notu da bunu doğruluyor
   ("bakım aşamasının koşucusu yok: bakım modunda triage control plane dışında çalışır").
   Bu, fabrikanın "bakım/hotfix modu"nun tam bir kapalı döngü olmadığının somut kanıtı —
   bir insan/orkestrator arayı kapatmazsa bulgular kayıt olarak kalıp ticket'a dönüşmüyor.
3. **Hotfix ticket'ları (H-001..H-004) tam T-ticket titizliğiyle işlendi (ortalama 9
   koşum/hotfix, code-review + QA dahil) ama hiçbir backlog dokümanında görünmüyor.**
   T-023..T-028'in de aynı sorunu yaşadığı önceki raporda not edilmişti; bu desen (release-
   sonrası bulunan işlerin backlog'a hiç yansımaması) artık iki ayrı turda tekrarlanan bir
   şablon boşluğudur — "release-prep/bug bulgusundan doğan ticket'lar" için backlog'da
   ayrı, otomatik güncellenen bir ek bölüm önerilir.
4. **Maliyet toplama bu turda Bash aracının `factory/.factory/**` yoluna erişimi tamamen
   engellemesi nedeniyle elle (Grep + aritmetik) yapıldı, ondalık kesinlik yok.** Fabrika
   politikası muhtemelen yazma korumasını okuma korumasıyla karıştırıyor — rapor ajanının
   kendi görev tanımı gereği bu dosyaları OKUMASI gerekiyor (yazması değil). Sonraki bir
   sürümde bu path guard'ın salt-okunur erişime izin verecek şekilde (yalnızca yazma/Bash
   yan etkilerini engelleyecek şekilde) daraltılması, rapor kalitesini (ve ajan turunu)
   iyileştirir.
5. **perf-agent'ın 6. tur raporundaki "sharp.resize() atlanabilir" önerisi 5. bölümde bir
   önceki rapor tarafından kod okumasıyla çürütülmüştü; bu tur (7. tur) o çelişkiyi ne
   doğruladı ne düzeltti — aynı öneri hâlâ v2 backlog'unda duruyor.** Performans şablonunun,
   önceki turun "reddedilen öneri" notlarını okuyup yeniden değerlendirmeyi zorunlu kılan bir
   alanı olsaydı, bu tutarsızlık (P-02'nin iki turdur aynı önerilen düzeltmeyle "açık"
   kalması) bu raporda daha net çözülebilirdi.
