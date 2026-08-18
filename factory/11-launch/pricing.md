# Fiyat Sayfası — Tutanak

> Ürün mimarisi tek bir abonelik planı üzerine kurulu (`subscriptions` tablosu, tek
> `SUBSCRIPTION_PRICE_AMOUNT` konfigürasyonu — bkz. `factory/04-architecture/data-model.sql:311`).
> **Birden fazla paket (Starter/Pro/Premium gibi) yoktur ve bu sayfa bunu uydurmaz.** PRD bu fiyatı
> "Açık Soru" olarak işaretlemiştir (§7); aşağıdaki rakam bu görevin **gerekçeli önerisidir**, kesin
> karar ürün sahibine aittir — bkz. §4.

## 1. Plan (Tek Plan)

### Tutanak — Aylık Abonelik

**Önerilen fiyat: ₺199/ay** (KDV dahil/hariç bilgisi ödeme sağlayıcısı ayarına göre netleştirilir)

Tüm özellikler tek planda, ek ücretli katman yok:

- Sınırsız tutanak oluşturma
- 3 hazır emlak şablonu (Giriş/Çıkış Teslim Tutanağı, Sayaç/Demirbaş Tespiti, Periyodik Durum
  Kontrolü)
- Tutanak başına 30 fotoğrafa kadar, otomatik ve değiştirilemez tarih-saat damgasıyla
- PDF çıktısı (sınırsız indirme)
- E-posta / WhatsApp / link ile paylaşma
- Kiracı tarafında hesapsız görüntüleme + tek tıkla onay
- Geçmiş tutanakları listeleme ve arama
- Mobil tarayıcıdan çalışır (PWA), kurulum gerekmez

**Ödeme durumu kullanımı kısıtlamaz:** Abonelik "Pasif" durumdayken de tutanak oluşturma, fotoğraf
ekleme, PDF indirme gibi işlevlere erişiminiz devam eder — ödeme ekranı yalnızca fatura/ödeme
durumunuzu takip etmek içindir (bu, ürünün fiilen çalışma şekli; bkz. `USER-GUIDE.md` §9). Bu satırı
"sonsuza kadar bedava kullanılır" diye pazarlamıyoruz — gelecekte bu davranış değişebilir, bu sayfa
yalnızca **bugünkü fiili durumu** anlatır.

## 2. Fiyat Gerekçesi

- İntake analizinin rekabet tablosuna göre (`factory/01-intake/analysis.md` §3): AkıllıKira giriş
  paketi ₺249/ay (tutanak dahil ama geniş mülk-yönetim paketine gömülü), Emsis ₺167-458/ay
  (tutanak özelliği yok). PRD, ürünü bilinçli olarak **AkıllıKira'nın giriş paketinin altında**
  konumlandırmayı karar verdi (PRD §1, §7).
- ₺199/ay, hem bu "AkıllıKira'nın altında" kararına uyuyor hem de intake'in genel tolerans
  aralığının (₺200-400/ay) alt sınırına yakın duruyor — ürün, geniş paketlerin sunduğu
  karşılaştırma/kira takibi/sayaç otomasyonu gibi işlevleri **kasıtlı olarak sunmadığından**,
  fiyatın da "hafif ürün, hafif fiyat" mantığıyla düşük tutulması tutarlı.
- **Dürüstlük notu:** Bu fiyat toleransı, PRD'nin kendi kabulüyle (§7 Varsayımlar) formel LOI/
  anket görüşmesiyle değil, ürün sahibinin iş kararıyla belirlendi — **doğrulanmamış bir
  varsayımdır**. Bu sayfa bunu gizli tutmuyor; §4'te doğrulama planı var.

## 3. SSS (Fiyat)

**Neden abonelik, neden tutanak başına ücret değil?**
Ürün, tutanak sayısını sınırlamıyor — sınırsız kullanım tek aylık ücrete dahil. Bu, yoğun ay/sakin
ay farkı gözetmeden öngörülebilir bir maliyet ister diye tercih edildi.

**Yıllık ödemede indirim var mı?**
Şu an yalnızca aylık abonelik akışı vardır (bkz. `USER-GUIDE.md` §9); yıllık plan/indirim
uygulamada yok — bu sayfa olmayan bir seçeneği vaat etmez.

**Ücretsiz deneme var mı?**
PRD bunu açık soru olarak bırakmış (§7) ve şu an uygulamada ayrı bir "deneme süresi" mekanizması
yok — ancak yukarıda belirtildiği gibi, ödeme yapılmadan da (pasif abonelikle) tüm işlevler
kullanılabiliyor; bu fiilen bir "süresiz deneme" gibi işliyor. Bu durumu netçe böyle anlatıyoruz,
"ücretsiz deneme" diye ayrı bir kampanya adı vermiyoruz çünkü bu ürün davranışı her an
değişebilir bir varsayılan, resmi bir taahhüt değil.

**Fiyat ileride değişir mi?**
Evet, değişebilir — bu ilk fiyat, doğrulanmamış bir varsayıma dayanıyor (§2). Mevcut abonelerin
fiyatı korunup korunmayacağı ürün sahibinin ayrı bir kararıdır, bu sayfa bunu şimdiden vaat etmez.

**Gizli ücret var mı?**
Hayır. Tek plan, tek aylık tutar; ek katman/ek modül ücreti yoktur çünkü böyle bir katman/modül
şu an ürünte mevcut değildir.

**AkıllıKira'dan neden daha ucuz, eksik bir şey mi var?**
Evet, kasıtlı olarak var: giriş/çıkış karşılaştırma, kira takibi, sayaç otomasyonu gibi geniş
paket özellikleri bu üründe yok (bkz. `landing.md` §2.3, §4). Fiyat farkı bu kapsam farkını
yansıtıyor, gizlenmiyor.

## 4. Doğrulama Planı (Bu Fiyat Kesin Değil)

- İlk 10 kullanıcı görüşmesinde (bkz. `launch-checklist.md` §3) doğrudan soru: "₺199/ay size
  pahalı mı, uygun mu, ucuz mu geldi?" — cevaplar not edilir.
- İlk 60 gün sonunda gerçek dönüşüm sayısı (PRD hedefi: ≥1 ücretli abone) ve bu geri bildirimler
  birlikte değerlendirilip fiyat gerekirse revize edilir. Bu görev bu revizyonu yapmaz, sadece
  ölçüm planını kurar.
