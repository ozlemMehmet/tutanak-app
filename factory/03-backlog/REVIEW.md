# Backlog Review — Emlak Teslim Tutanağı Platformu (MVP)

> Denetçi: backlog-review-agent | Tur: 2 (backlog.md Tur 2 revizyonunun denetimi) | Girdi: `factory/02-prd/prd.md`, `factory/03-backlog/backlog.md`, `factory/03-backlog/tickets/T-001..T-012.md`, önceki `factory/03-backlog/REVIEW.md` (Tur 1)

## Sonuç: **APPROVED**

Tur 1 incelemesinde tespit edilen 3 bulgunun tamamı, ticket dosyalarının kendisi okunarak (backlog.md'deki iddialara güvenilmeden) doğrulandı ve fiilen kapatıldığı görüldü. Denetim listesindeki 6 maddenin tamamı bağımsız olarak yeniden üretildi; yeni bir bulgu tespit edilmedi.

---

## Tur 1 Bulgularının Doğrulanması (dosya bazlı, somut kanıt)

### Bulgu 1 (KRİTİK) — DoD kamera erişimi maddesi test edilmiyordu → KAPANDI
- **Kontrol:** `T-006.md` satır 24: yeni 7. kabul kriteri eklenmiş: "Fotoğraf ekleme arayüzü, mobil tarayıcıda cihaz kamerasını doğrudan açan bir giriş sunar (ör. `<input type='file' accept='image/*' capture>` veya `getUserMedia` tabanlı kamera görünümü); bu davranış mobil tarayıcıda manuel/E2E test senaryosuyla doğrulanır — kamera açılır, çekilen kare önizlenir ve 'yükle' ile sunucuya gönderilir."
- **Değerlendirme:** Bu kriter EVET/HAYIR ile gözlemlenebilir somut bir davranış tanımlıyor (kamera açılır / önizlenir / yüklenir). PRD §6 DoD son maddesi artık sahipli ve test edilebilir. **Kapandı.**

### Bulgu 2 — T-011'in T-006'ya gereksiz bağımlılığı → KAPANDI
- **Kontrol:** `T-011.md` satır 6: "Bagimli oldugu ticketlar: T-003, T-005" (T-006 kaldırılmış, revizyon notu eklenmiş). `backlog.md` §2 tablo satır 11: "T-003, T-005". `backlog.md` §3 mermaid: `T003 --> T011`, `T005 --> T011` (T006 --> T011 satırı yok).
- **Değerlendirme:** Ticket dosyası, tablo ve mermaid grafiği tutarlı şekilde güncellenmiş. T-011'in 5 kabul kriteri hâlâ yalnızca başlık/not arama, sahiplik filtresi, sıralama ve 401 kontrolüne dayanıyor — fotoğraf/damga verisine ihtiyaç yok, düzeltme doğru. **Kapandı.**

### Bulgu 3 — T-006 kriter #4 "ya da" belirsizliği → KAPANDI
- **Kontrol:** `T-006.md` satır 21: "Fotograf guncelleme/PATCH endpoint'i tanimli degildir (route mevcut degildir); tarih-saat damgasi yalnizca olusturma aninda sunucu tarafindan atanir ve hicbir endpoint uzerinden degistirilemez."
- **Değerlendirme:** Tek, net bir davranış seçilmiş (endpoint hiç yok). Artık tek bir EVET/HAYIR testiyle doğrulanabilir. **Kapandı.**

---

## Denetim Listesi (bağımsız olarak yeniden üretildi)

**1. Boyut denetimi:** 12 ticket'ın tamamı yeniden okundu, kabul kriteri sayıları sayıldı: T-001=5, T-002=5, T-003=6, T-004=4, T-005=5, T-006=7, T-007=5, T-008=6, T-009=4, T-010=6, T-011=5, T-012=5. Hiçbiri 8+ değil, hiçbiri L değil (backlog.md'nin iddia ettiği 3×S/9×M/0×L dağılımı ticket dosyalarıyla birebir doğrulandı: S={T-001,T-004,T-009}, M=diğer 9). T-006, en yüksek kriter sayısına (7) ve en geniş kapsama (upload+damga+değişmezlik+format+listeleme+kamera) sahip; sınırda ama eşiği aşmıyor ve her kriter ayrı, bağımsız test edilebilir — bölünme zorunluluğu yok. **PASS.**

**2. Test edilebilirlik:** Tüm 12 ticket'ın tüm kabul kriterleri tek tek okundu; "düzgün", "doğru" (adjective anlamında), "uygun" gibi öznel ifadeler için grep ile tarama yapıldı — bulunan tek eşleşmeler "doğrulanabilir/doğrulanır" (verify anlamında teknik fiil, yasak liste kapsamında değil) idi. Öznel/ölçülemez kriter tespit edilmedi. Bulgu 3'ün düzeltmesiyle "ya da" belirsizliği de kalktı. **PASS.**

**3. Kapsama matrisi doğrulaması (kendim yeniden çıkardım):** PRD §4 Kapsam İçinde 11 madde tek tek listelendi ve her biri en az bir ticket'a eşlendi: (1) Foto+başlık+not→T-005,T-006 (2) Otomatik/değiştirilemez damga→T-006 (3) 3 hazır şablon→T-002,T-004 (4) PDF→T-007 (5) E-posta/WhatsApp paylaşım→T-008 (6) Hesapsız görüntüleme→T-009 (7) Tek tıkla onay→T-010 (8) E-posta+şifre kayıt/giriş→T-003 (9) Abonelik ödeme→T-012 (10) Geçmiş listeleme/arama→T-011 (11) "Destekleyici kanıt" uyarısı→T-010. Sahipsiz PRD maddesi yok, sahipsiz ticket yok (T-001, T-002 açıkça altyapı/DoD gerekçesiyle bağlanmış). DoD'nin kamera erişimi maddesi artık T-006'da somut kriterle karşılanıyor (Bulgu 1 kapandı). **PASS.**

**4. Kapsam kayması:** 12 ticket'ın "Kapsam DIŞI" bölümleri ve "Kapsam"/"Kabul Kriterleri" bölümleri tek tek okundu; PRD §4 Kapsam DIŞINDA'daki 11 maddeden (otomatik karşılaştırma, e-imza/KEP, SMS/OTP, self-servis şablon, yeni sektör şablonları, envanter/sigorta, çoklu kullanıcı/rol, native mobil, bildirim/hatırlatma, raporlama/analitik, geniş mülk-yönetim) hiçbiri hiçbir ticket'ın fiili iş kalemi (Kapsam/Kabul Kriterleri) olarak yer almıyor; yalnızca sınır çizmek amacıyla "Kapsam DIŞI" bölümlerinde referans veriliyor. Sızma yok. **PASS.**

**5. Bağımlılık grafiği:** Tüm 12 ticket dosyasının "Bagimli oldugu ticketlar" alanı okunarak bağımsız bir topolojik kontrol yapıldı: T-001→yok, T-002→T-001, T-003→T-001,T-002, T-004→T-002,T-003, T-005→T-002,T-003,T-004, T-006→T-005, T-007→T-006, T-008→T-006, T-009→T-008, T-010→T-007,T-009, T-011→T-003,T-005, T-012→T-003. Her bağımlılık kendinden düşük ID'ye işaret ediyor, döngü yok, sıralama hatası yok. `backlog.md` §2 tablosu ve §3 mermaid grafiği ticket dosyalarıyla birebir tutarlı (T-011 satırı dahil, Bulgu 2 düzeltmesi doğrulandı). **PASS.**

**6. Kendine yeterlilik:** Rastgele seçilen T-002, T-007, T-012 (ve karşılaştırma amaçlı okunan diğer tüm ticket'lar) yalnızca kendi içerikleriyle anlaşılabiliyor — her biri "PRD baglami" alanında ilgili hikaye/kapsam maddesini doğrudan alıntılıyor, Kapsam/Kabul Kriterleri/Kapsam DIŞI net ve dışarıdan bağlam gerektirmiyor. **PASS.**

---

## Özet Tablo

| Kontrol Maddesi | Sonuç |
|---|---|
| 1. Boyut denetimi (L / 8+ kriter) | PASS |
| 2. Test edilebilirlik (EVET/HAYIR ile doğrulanabilirlik) | PASS |
| 3. Kapsama matrisi doğrulaması (bağımsız yeniden üretim) | PASS |
| 4. Kapsam kayması (v2+ sızıntısı) | PASS |
| 5. Bağımlılık grafiği (döngü / sıralama hatası) | PASS |
| 6. Kendine yeterlilik (rastgele örneklem) | PASS |
| Tur 1 Bulgu 1 (DoD kamera erişimi test edilmiyordu) | KAPANDI (T-006 kriter #7) |
| Tur 1 Bulgu 2 (T-011→T-006 gereksiz bağımlılık) | KAPANDI (T-011→T-003,T-005) |
| Tur 1 Bulgu 3 (T-006 kriter #4 "ya da" belirsizliği) | KAPANDI (tek davranış) |

**Genel Sonuç:** APPROVED — backlog dev-agent'a devredilebilir durumda.

## Notlar (bilgilendirme amaçlı, red gerekçesi değil)
- T-006 kapsam olarak en geniş ticket (upload API + damga değişmezliği + format doğrulama + listeleme + kamera UI); kriter sayısı eşiği (7/8) aşmasa da dev-agent oturumunda en uzun sürecek ticket olacaktır — mimari/dev-agent bunu göz önünde bulundurmalı, ancak bu bir REJECT gerekçesi değildir.
- KVKK/saklama-silme politikası PRD'de açık soru olarak kaldığı için backlog'a ticket olarak yansıtılmamış; bu doğru bir karar (PRD'de karar netleşmemiş bir konuyu ticket'laştırmak spekülatif kapsam ekler). PRD netleştiğinde yeni ticket açılmalı.
