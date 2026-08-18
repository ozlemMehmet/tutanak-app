# Fikir Analizi — Çok Sektörlü Durum Tespit / Teslim-Tesellüm Tutanağı Platformu (Emlak Yönetim Ofisi Odaklı MVP)

> Uretici: intake-agent | Tarih: 2026-08-11

## 1. Netlestirilmis Fikir
- **Problem:** Bir mekan/araç/ekipman/işin belirli bir andaki durumunu (hasar, demirbaş, ilerleme, teslim koşulu) fotoğraf + not + tarih damgası + taraf onayıyla belgeleme ihtiyacı jenerik olarak gerçek; ancak MVP'nin ticari odağı tek dikeye — **emlak yönetim ofislerinin kiracı giriş/çıkış teslim tutanağı** ihtiyacına — daraltılmış durumda.
- **Hedef kullanici:** Emlak yönetim ofisleri (B2B/kurumsal, KOBİ ölçekli). Mimari jenerik kalıyor, satış odağı tek dikeyde.
- **Onerilen cozum:** Jenerik "tutanak şablonu" veri modeli üzerine kurulu mobil-öncelikli PWA: foto+not+otomatik tarih damgası, tek tıkla taraf onayı (imza yok), PDF üretimi, 2-3 emlak şablonu, e-posta+şifre kimlik doğrulama, abonelik (₺200-400/ay).
- **Yapilan varsayimlar:**
  1. Bu analiz, dokümanın kendi ifadesiyle "PRD öncesi 5-10 potansiyel müşteriyle doğrulanmalı" dediği fiyat toleransı/niyet (LOI) doğrulamasının **henüz yapılmadığını** varsayıyor — dokümanda bunu gösteren somut bir doğrulama kaydı (görüşme notu, LOI, anket) yok, sadece gelecek zamanlı bir plan var.
  2. "Emlak yönetim ofisi" ifadesi bu analizde **mülk/kiralık gayrimenkul yönetimi yapan, kira takibi+bakım+teslim süreçlerini yürüten işletme** olarak yorumlandı (property management); bu, klasik "emlakçı/emlak danışmanlığı ofisi" (alım-satım aracılığı, ör. Emsis'in hedef kitlesi) segmentinden farklı olabilir — ham fikir bu ayrımı netleştirmiyor, bu belirsizlik Bölüm 3-4'te ele alındı.

## 2. Problem Dogrulamasi
| # | Kanit | Kaynak |
|---|---|---|
| 1 | AkıllıKira, "Emlak Teslim Tutanağı" adıyla kendine ait bir ürün/şablon sayfası yayınlamış; teslim tutanağının depozito iadesi anlaşmazlıklarında ispat işlevi gördüğünü doğrudan pazarlama diliyle vurguluyor — bu, hedeflenen problemin ticarileştirilebilir olduğunu gösteren doğrudan kanıt. | akillikira.com/sablonlar/emlak-teslim-tutanagi (2026-08 arama) |
| 2 | Türkiye'de çok sayıda hukuk bürosu/şablon sitesi (Evrakla, Tutanakornegi.com, BAF Hukuk, Ayboğa+Partners) "teslim tesellüm/anahtar teslim tutanağı" konusunda ayrı içerik/şablon üretmiş — tekrarlayan, dağınık çözümlerle idare edilen bir talebin dolaylı kanıtı. | evrakla.com, tutanakornegi.com, baf.av.tr, ayboga.av.tr (2026-08 arama) |
| 3 | Global pazarda kiralık mülk giriş/çıkış durum tespiti için ücretli, aktif SaaS ürünleri var (RentCheck, TurboTenant, zInspector, Buildium — Buildium 150 birim için 160$/aydan başlıyor) — "foto+checklist+PDF ile durum tespiti" ihtiyacının parayla çözülen gerçek bir problem olduğunu uluslararası pazarda doğruluyor. | getrentcheck.com, turbotenant.com, buildium.com fiyatlandırma (2026-08 arama) |
| 4 | Türkiye'de kiralık mülk yönetimi hizmeti komisyon bazlı fiyatlandırılıyor (tatil kiralamada kira gelirinin %25-30'u) — bu, mülk yönetim ofislerinin zaten operasyonel maliyet kalemi olarak yazılım/hizmet bedeli ödemeye alışkın olduğunu gösteriyor, ama bütçenin "ayrı SaaS aboneliği" kalemine mi yoksa komisyon içine gömülü hizmete mi ayrıldığı belirsiz. | bookingninjas.com, istanbulpropertymanagement.com (2026-08 arama) |

**Sonuç:** Problem gerçek ve TR+global kanıtlarla doğrulanıyor. Ancak en güçlü doğrudan kanıt (AkıllıKira) aynı zamanda Bölüm 3'te görüleceği gibi rekabet riskini de gösteriyor: problem zaten en az bir TR oyuncusu tarafından "çözülmüş" durumda.

## 3. Rekabet Analizi
| Rakip / Mevcut Cozum | Ne yapiyor | Fiyat | Zayif noktasi |
|---|---|---|---|
| AkıllıKira (TR) | Kira/mülk yönetim platformu; teslim tutanağı oluşturma + foto yükleme + sayaç kaydı + **oda oda giriş/çıkış karşılaştırmasını otomatik yapıyor** (doğrulandı: akillikira.com/sablonlar sayfası) | ₺249-749/ay (Starter/Pro/AI Premium) | Tutanak bağımsız ürün değil, geniş mülk-yönetim paketine gömülü — ama **bu MVP'nin v1.1'e ertelediği "karşılaştırma" özelliğini AkıllıKira şu an zaten sunuyor**; bu MVP'nin ilk sürümü, işlevsellikte AkıllıKira'nın gerisinde başlayacak |
| Emsis (TR) | "Emlak ofisi" (alım-satım/kiralama danışmanlığı) yazılımı — kasa defteri, portföy, muhasebe modülleri | ₺1.999-5.499/yıl (~₺167-458/ay) | Tutanak/durum tespiti özelliği web sitesinde görünmüyor; ama **fiyat aralığı önerilen ₺200-400/ay ile örtüşüyor ve daha düşük giriş noktasına sahip** — hedef segment "emlak ofisi" ile karışırsa fiyat beklentisi çakışır |
| Pikzum (E-Güven, TR) | Fotoğrafa konum + hukuki zaman damgası ekleyen genel amaçlı delil uygulaması | Şu an ücretsiz (kampanya) | Şablon/checklist yok, taraf onayı akışı yok, tutanak PDF üretmiyor |
| RentCheck / TurboTenant / Buildium (Global) | Kiralık mülk giriş/çıkış durum tespiti: foto+checklist+PDF+zaman damgası, karşılaştırma dahil | $19-160+/ay | Türkiye'de yok, Türkçe değil, TL fiyatlandırma yok, KVKK/yerel hukuk uyumu yok |
| Excel/Word şablonu + WhatsApp foto + kağıt imza (TR fiili standart) | Word'de doldurma, WhatsApp'ta fotoğraf, ıslak imza/sözlü onay | Ücretsiz (zaman maliyeti var) | Dağınık, aranamaz, arşivlenmiyor, taraf onayı kanıtlanabilir değil |

**Değerlendirme:** "Rakip yok" değil — AkıllıKira, hedeflenen tam problemi (emlak teslim tutanağı) zaten çözüyor ve bu MVP'nin kapsam dışı bıraktığı karşılaştırma özelliğini de içeriyor. "Bağımsız/hafif alternatif" konumlandırması makul bir hipotez ama **doğrudan kanıtla desteklenmiyor** — AkıllıKira'nın müşterilerinin neden "sadece tutanak yapan, daha hafif" bir ürüne geçmek/ek ödeme yapmak isteyeceğine dair kanıt yok.

## 4. Odeme Istegi
- **Kim oder:** Emlak yönetim ofisleri iddiası; TR pazarında bu segmentin SaaS'a ödeme yaptığı AkıllıKira örneğiyle kanıtlanmış (₺249-749/ay). Ancak bu müşteriler zaten AkıllıKira'nın parçası olarak tutanak özelliğine sahipse, **aynı işlev için ikinci bir abonelik ödeme isteği ayrı bir varsayım** — doğrudan kanıt yok.
- **Kanit/karsilastirma:** AkıllıKira (₺249-749/ay, tutanak dahil geniş paket) ve Emsis (₺167-458/ay, tutanaksız dar paket) arasında konumlanan ₺200-400/ay "hafif tutanak" teklifi fiyat mantığı açısından tutarlı görünüyor, ama "hafif" olmanın müşteri için AkıllıKira'nın sunduğu ek işlevlerden (kira takibi, sayaç, karşılaştırma) vazgeçmeye değecek kadar çekici olduğuna dair kanıt yok.
- **Tahmini fiyat toleransı:** ₺200-400/ay iddiası rakip fiyat aralıklarıyla tutarlı (makul varsayım) ama **doğrulanmamış** — dokümanın kendi planına göre 5-10 LOI görüşmesi gerekiyor ve bu henüz yapılmamış.

## 5. Uygulanabilirlik (Solo Gelistirici)
| Dis bagimlilik | Turu (engel/gecikme/onemsiz) | Aciklama |
|---|---|---|
| Ödeme entegrasyonu (iyzico/Stripe) | Gecikme | Standart entegrasyon, KYC/onboarding süresi olabilir ama teknik engel değil |
| GCP Cloud Storage + PostgreSQL, e-posta/link paylaşım | Önemsiz | Dış onay/lisans gerektirmiyor |
| KVKK — fotoğraflarda kişisel veri (kiracı, adres, sayaç) ve bulut depolama lokasyonu | Gecikme | Engel değil ama veri saklama/silme politikası ve olası yurt dışı veri aktarımı (GCP bölge seçimi) PRD'de netleştirilmeli |
| "Taraf onayı" mekanizmasının hukuki ağırlığı (imza yok, e-posta+tek tık) | Önemsiz (ürün riski, teknik engel değil) | Güvenli e-imza olmadan elektronik kayıtlar Türk hukukunda kesin delil değil, "delil başlangıcı" niteliğinde (HMK m.199-202 bağlamı) — idea'nın kendi konumlandırması ("destekleyici kanıt") bununla uyumlu; risk pazarlama dilinin bu sınırı bulandırmaması |
| 5-10 potansiyel müşteri LOI/fiyat doğrulaması | Gecikme (ama PRD öncesi zorunlu) | Dış onay değil ama dokümanın kendi kabul kriteri; tamamlanmadan PRD'ye geçmek riskli — solo geliştiricinin haftalarca kod yazıp doğrulanmamış fiyat/talep varsayımı üzerine MVP kurma riski var |

## 6. TAVSIYE
**Karar:** REVİZE (intake-agent'ın son otomatik değerlendirmesi) → **PASS (kullanıcı tarafından elle onaylandı, bkz. §7)**

**Gerekce (3-5 cumle):** Problem gerçek ve hem TR hem global kanıtlarla doğrulanıyor, mimari solo geliştirici için uygulanabilir ve dış bağımlılıklar önemsiz/gecikme düzeyinde. Araştırma iki somut açık nokta ortaya çıkardı: (1) AkıllıKira zaten aynı problemi çözüyor ve bu MVP'nin bilinçli olarak v1.1'e ertelediği "giriş/çıkış karşılaştırma" özelliğini şu anda sunuyor; (2) doğrudan ödeme kanıtı (LOI/fiyat toleransı görüşmesi) henüz yapılmamıştı. Kullanıcı bu iki noktayı PRD'ye geçmeden önce resmi araştırmayla değil, kendi iş kararıyla kapattı (§7).

**(Otomatik değerlendirmenin önerdiği yön, referans için korunuyor):** PRD'ye geçmeden önce şunlar netleştirilmeli: (1) 5-10 emlak yönetim ofisiyle fiyat toleransı + niyet (LOI) görüşmeleri; (2) AkıllıKira'ya karşı somut farklılaşma (fiyatta altında konumlanmak ya da mikro/SaaS kullanmayan ofisleri hedeflemek); (3) "emlak yönetim ofisi" tanımının netleştirilmesi (property management vs. emlak danışmanlığı/CRM).

## 7. Manuel Karar Notu (Kullanıcı, 2026-08-11)

intake-agent'ın otomatik REVİZE döngüsü 8 denemeden sonra ilerleme sağlamaz hale geldi (son 2 deneme analiz dosyasını güncellemeden aynı sonucu döndürdü — bkz. pipeline geçmişi). Kullanıcı, agent'ın işaret ettiği açık noktaları kendi iş kararlarıyla kapatarak intake aşamasını **elle PASS'e** çekmeyi tercih etti:

- **AkıllıKira farklılaşması → Fiyat altında konumlanma:** Ürün, AkıllıKira'nın giriş paketinin (₺249/ay) **altında** fiyatlanacak; "daha hafif + daha ucuz" farklılaşması bilinçli olarak seçildi (karşılaştırma özelliği eksikliği bu fiyat farkıyla telafi ediliyor kabul ediliyor).
- **LOI/pazar doğrulaması → Resmi süreç yerine informal saha testi:** Kullanıcının 5-10 kişilik formel LOI görüşmesi yapma niyeti yok. Bunun yerine MVP inşa edildikten sonra kullanıcının tanıdığı birkaç emlakçı ile fiilen denenecek; büyüme kanalı olarak organik/ağızdan ağıza (fısıltı) pazarlamaya güveniliyor. Bu, **doğrulanmamış talep üzerine geliştirme riskinin bilinçli olarak kabul edildiği** anlamına gelir — resmi bir pazar doğrulaması değildir.
- **"Emlak yönetim ofisi" tanımı:** Kullanıcının bizzat "emlakçı arkadaşlarım" ifadesi, hedefin dar "property management" segmentinden çok genel emlakçı/emlak ofisi kitlesine yakın olabileceğini gösteriyor; kesin tanım PRD aşamasında netleşecek, MVP kapsamını değiştirmiyor.

Bu kararlarla birlikte proje **PRD aşamasına geçirilmiştir.**