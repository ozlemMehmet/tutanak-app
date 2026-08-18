# Ürün Geri Bildirimi (Launch-Prep Aşamasında Görülen Fikirler)

> Bu dosya öneri/fikir toplama amaçlıdır, bu görevde hiçbir ürün özelliği uygulanmadı. Reporter/
> product ekibi değerlendirir.

1. **In-app analitik yok.** Ürün içinde kullanıcı davranışı ölçen bir katman (huni, sayfa
   görüntüleme, oturum kaydı vb.) bulunmuyor. `launch-checklist.md`'de bunun yerine DB'den manuel
   sorgu + UTM linkleriyle idare edildi, ancak büyüme ölçeklendikçe (10'dan fazla kanal/kullanıcı)
   bu manuel yöntem sürdürülebilir olmaktan çıkar. Hafif, gizlilik dostu bir analitik entegrasyonu
   (ör. Plausible/self-hosted) v2 için değerlendirilebilir.
2. **Onay bekleyen tutanaklar için hatırlatma yok.** PRD zaten bunu kapsam dışı bırakmış
   (v2 madde 9), ama lansman sürecinde bu, SSS'de tekrar eden bir itiraz noktası olacak
   (bkz. `landing.md` §4) — talep sinyali güçlenirse önceliklendirilmeye değer.
3. **KVKK silme akışı yok** (security-audit.md S-09/S-17'de zaten kayıtlı) — pazarlama/satış
   sürecinde kurumsal müşteriler (özellikle ofis yöneticisi Selin) "verilerimi nasıl silerim"
   sorusunu sorabilir; şu an dürüst cevap "şu an silme özelliği yok" (bkz. `pricing.md`/`landing.md`
   SSS). Bu, KVKK uyumu iddiasıyla satış yapılmasını fiilen engelliyor — ürün tarafında bir açık
   soru olarak PRD'de zaten var, burada tekrar işaretleniyor çünkü lansman mesajlaşmasını
   doğrudan sınırlıyor.
4. **Tek plan, katmansız fiyatlandırma.** Şu an büyük/küçük ofis farkı gözetmeyen tek bir fiyat
   var. İleride "tek kullanıcı" ve "ekip" gibi bir ayrım gerekebilir, ama PRD bunu bilinçli olarak
   v2'ye bırakmış (kapsam dışı madde 7 — çoklu kullanıcı/rol yönetimi). Fiyatlandırma sayfası bu
   yüzden tek plan olarak yazıldı; bu satır sadece ileride tekrar gündeme gelebileceğini not eder.
