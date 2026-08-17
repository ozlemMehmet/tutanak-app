# Değişiklik Günlüğü

Bu proje [Anlamsal Sürümleme](https://semver.org/lang/tr/) kullanır.

## [1.0.0] - 2026-08-17

### Eklendi

- E-posta ve şifre ile hesap oluşturma ve giriş yapma.
- Hazır 3 emlak teslim şablonundan (giriş/çıkış teslimi, sayaç/demirbaş tespiti, periyodik
  durum kontrolü) birini seçerek yeni tutanak taslağı oluşturma.
- Tutanağa telefon kamerasıyla doğrudan fotoğraf ekleme; her fotoğraf otomatik ve
  değiştirilemez bir tarih-saat damgasıyla kaydedilir.
- Tutanağın fotoğraflar ve notlarla birlikte tek tıkla PDF çıktısını alma.
- Tutanağı e-posta veya WhatsApp linkiyle karşı tarafla (kiracı/mülk sahibi) paylaşma.
- Karşı tarafın hesap açmadan, yalnızca gönderilen linkle tutanağı görüntülemesi.
- Karşı tarafın linke tıklayarak tek adımda tutanağı onaylaması; onay ekranında kanıt
  bütünlüğünü koruyan bir uyarı metni ve onay anının (tarih-saat) PDF'e işlenmesi.
- Geçmiş tutanakları listeleme ve başlık/not içinde arama.
- Uygulamayı ana ekrana kurulabilir bir PWA (mobil öncelikli, kamera erişimli) olarak sunma.
- Ücretli abonelik akışı: ödeme başlatma ve abonelik durumunun (`inactive`/`pending`/`active`)
  hesap ekranında görüntülenmesi.

### Değişti

- Giriş uçlarına (`/auth/register`, `/auth/login`) ve genel onay ucuna hız sınırı eklendi;
  kısa sürede çok sayıda hatalı deneme artık `429` ile reddedilir.
- Giriş denemesi başarısız olduğunda da (kullanıcı bulunamasa dahi) yanıt süresi sabit
  tutularak zamanlama tabanlı hesap keşfi zorlaştırıldı.
- Fotoğraf yükleme performansı iyileştirildi: büyük fotoğraflar gönderilmeden önce cihazda
  otomatik olarak küçültülüyor; yükleme artık daha hızlı ve yoğun kullanımda daha güvenilir.

<!--
Ic surum notu (release notlarina girmez): T-001..T-012, T-014, T-015, T-016..T-028 (T-013 iptal
edildi; kapsami T-003'e alindi). Deployment yuzeyi (Dockerfile/compose/CI-CD/runbook)
release-prep turunde devops-agent tarafindan eklendi/dogrulandi; bu revizyonda ayrica
docker-compose.e2e.yml'deki kullanilmayan mailpit servisi kaldirildi (FOUND-ISSUES.md madde
5/7/8, docker-compose.yml ile ayni desene getirildi) ve tum deployment varliklari (Dockerfile
x2, compose x2, CI+CD workflow'lari, .env.example) bu oturumda ucdan uca yeniden dogrulandi
(bkz. factory/10-release/devops-report.md).
-->
