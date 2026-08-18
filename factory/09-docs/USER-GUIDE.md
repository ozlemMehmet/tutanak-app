# Kullanım Kılavuzu

Bu kılavuz, teknik bilgi gerektirmeden **Tutanak** uygulamasını kullanmanızı anlatır.
Uygulama mobil tarayıcınızdan (telefon veya bilgisayar) çalışır, kurulum gerektirmez.

## Bu uygulama ne işe yarar?

Bir mülkü (daire, ev, ofis) kiracıya teslim ederken veya kiracıdan geri alırken,
mülkün o anki durumunu **fotoğraf + not** ile kayıt altına almanızı sağlar. Kayıt
oluşturduktan sonra kiracıya bir link gönderirsiniz; kiracı bu linki açıp kaydı
inceler ve tek tıkla onaylar.

> **Önemli:** Bu onay bir e-imza değildir ve resmi hukuki delil sayılmaz. Uygulama
> bunu her onay ekranında açıkça belirtir: *"Bu tutanak resmi hukuki delil değildir,
> destekleyici kanıttır."* Amaç, anlaşmazlık durumunda elinizde tarihli bir kayıt
> bulunmasıdır.

## Kimler kullanır?

- **Siz (emlak danışmanı / ofis yöneticisi):** Hesap açar, tutanak oluşturur, kiracıya
  gönderir, geçmiş kayıtlarınızı görürsünüz.
- **Kiracı:** Hiçbir hesap açmaz. Sadece kendisine gönderilen linki açar, kaydı görür,
  onaylar.

---

## 1. Hesap oluşturma

1. Uygulamanın adresini tarayıcınızda açın. Kayıtlı değilseniz **"Kayıt olun"** linkine
   tıklayın (`/register`).
2. E-posta adresinizi ve en az 8 karakterli bir şifre girin, şifreyi tekrar yazın.
3. **"Hesap Oluştur"**a tıklayın.
4. Giriş ekranına yönlendirilirsiniz ("Hesabınız oluşturuldu, giriş yapın" mesajıyla).
   Kayıt sırasında otomatik giriş yapılmaz — e-posta ve şifrenizle **ayrıca giriş
   yapmanız** gerekir.

## 2. Giriş yapma

1. `/login` ekranında e-posta ve şifrenizi girin, **"Giriş Yap"**a tıklayın.
2. Başarılı girişte tutanaklarınızın listesine yönlendirilirsiniz.
3. Yanlış şifre girerseniz "E-posta veya şifre hatalı" uyarısı görürsünüz.
4. Oturumunuz açık kaldığı sürece (varsayılan 7 gün) tekrar giriş yapmanız gerekmez.
   Ekranın üst kısmındaki **"Çıkış"** butonuyla oturumu kapatabilirsiniz.

## 3. Yeni tutanak oluşturma

1. Üst menüden **"Yeni Tutanak"**a tıklayın.
2. **Adım 1 — Şablon seçin.** Üç hazır şablondan birini seçin:
   - **Giriş/Çıkış Teslim Tutanağı** — kiracı taşınırken/çıkarken mülkün genel durumu
   - **Sayaç/Demirbaş Tespiti** — elektrik/su/doğalgaz sayaçları ve demirbaşlar
   - **Periyodik Durum Kontrolü** — kira dönemi içinde ara kontrol
3. **Adım 2 — Bilgileri girin.** Bir başlık yazın (örn. "Atatürk Cd. No:5 Daire 3 —
   Giriş Tutanağı") ve isterseniz bir not ekleyin (opsiyonel, en fazla 5000 karakter).
4. **"Taslak Oluştur"**a tıklayın. Tutanağın detay sayfasına yönlendirilirsiniz;
   durumu **"Taslak"** olarak görünür.

> Not: Başlık ve not, taslak oluşturulduktan sonra **düzenlenemez**. Yanlış yazdıysanız
> yeni bir tutanak oluşturmanız gerekir.

## 4. Fotoğraf ekleme

1. Tutanak detay sayfasında **"Fotoğraf Ekle"** alanını kullanın: dosya seçin veya
   telefondaysanız doğrudan kamerayı açın.
2. Fotoğrafı önizleyip **"Yükle"** ile onaylayın.
3. Yüklenen her fotoğrafa, siz veya telefonunuz hiçbir şey yapmadan, **sunucu
   tarafından üretilen ve değiştirilemeyen** bir tarih-saat damgası eklenir. Bu damga
   fotoğrafın telefonunuzdaki tarihinden değil, sunucunun o anki saatinden gelir ve
   sonradan değiştirilemez.
4. Bir tutanağa en fazla **30 fotoğraf**, her biri en fazla **10 MB** boyutunda
   eklenebilir; sınıra ulaşınca ekleme alanı otomatik kapanır.
5. Yalnızca JPEG, PNG veya WEBP biçimindeki resimler kabul edilir.

> Tutanak **onaylandıktan sonra** fotoğraf ekleme alanı tamamen kaybolur — onaylanmış
> bir kaydın içeriği bilerek dondurulur, böylece onaydan sonra fotoğraf eklenip kanıtın
> değiştirilmesi mümkün olmaz.

## 5. PDF indirme

1. Tutanak detay sayfasında **"PDF İndir"** butonuna tıklayın (en az 1 fotoğraf
   eklenmiş olmalı; yoksa buton pasif olur ve altında "PDF oluşturmak için en az
   1 fotoğraf ekleyin" ipucu görünür).
2. PDF, başlığı, şablon adını, notu, tüm fotoğrafları (tarih damgalarıyla) ve varsa
   onay bilgisini içerir; tarayıcınız dosyayı indirir.

## 6. Kiracıyla paylaşma

1. Detay sayfasında **"Paylaş"**a tıklayın; bir panel açılır ve size özel bir link
   üretilir (örn. `https://.../t/AbCdEf...`).
2. Üç paylaşım yolu vardır:
   - **Kopyala** — linki panoya kopyalar, istediğiniz kanaldan (SMS, e-posta
     istemciniz vb.) gönderebilirsiniz.
   - **WhatsApp ile Paylaş** — WhatsApp'ı önceden doldurulmuş bir mesajla açar.
   - **E-posta Gönder** — kiracının e-postasını yazıp uygulamanın kendisi üzerinden
     gönderebilirsiniz.
3. Aynı tutanak için tekrar "Paylaş"a tıklarsanız **aynı link** tekrar gösterilir —
   yeni bir link üretilmez, eski link geçersizleşmez.
4. Tutanak paylaşıldığı anda durumu **"Paylaşıldı"**ya döner.

> E-posta gönderimi başarısız olursa (örn. kiracının adresi geçici olarak
> ulaşılamazsa) panelde bir uyarı görürsünüz, ama **link her zaman geçerlidir** —
> kopyalayarak veya WhatsApp ile devam edebilirsiniz.

## 7. Kiracının linki açması ve onaylaması (kiracı perspektifi)

1. Kiracı, kendisine gönderilen linki tıklar. **Hiçbir hesap açması veya giriş yapması
   gerekmez.**
2. Sayfanın en üstünde, her zaman görünür bir uyarı satırı vardır: *"Bu tutanak resmi
   hukuki delil değildir, destekleyici kanıttır."* Bu uyarı onay formundan **önce**
   gelir ve sayfa kaydırılsa da yerinde kalır.
3. Kiracı; başlığı, şablon adını, notu, tüm fotoğrafları ve tutanağın oluşturulma
   tarihini görür.
4. Sayfanın altında **"Tutanağı onayla"** formu vardır: kiracı e-posta adresini yazar
   ve **"Onayla"**ya tıklar.
5. Onaydan sonra sayfa "Onaylandı — kiraci@ornek.com, 15.08.2026 21:55" şeklinde bir
   başarı mesajına döner. Aynı link ikinci kez açılıp tekrar onaylanmaya çalışılırsa
   uygulama bunu engeller (mükerrer onay kaydedilmez).

## 8. Geçmiş tutanakları listeleme ve arama

1. Üst menüden **"Tutanaklarım"**a tıklayın.
2. Tüm tutanaklarınız, en yeni en üstte olacak şekilde listelenir; her kartta başlık,
   şablon adı ve durum rozeti (Taslak / Paylaşıldı / Onaylandı) görünür.
3. Üstteki arama kutusuna başlık veya not içinde geçen bir kelime yazarak listeyi
   daraltabilirsiniz.
4. Sonuçlar sayfalar halinde gösterilir; ok butonlarıyla sayfalar arasında gezinin.

## 9. Abonelik ödemesi

1. Üst menüden **"Abonelik"**e gidin.
2. Aboneliğiniz **"Pasif"** ise **"Ödeme Yap"** butonu görünür; tıklayınca ödeme
   sağlayıcısının ödeme sayfasına yönlendirilirsiniz.
3. Ödeme sonrası uygulamaya geri döndüğünüzde durum **"Ödeme sonucu bekleniyor"**
   şeklinde görünebilir — ödeme sağlayıcısının onayı bazen birkaç saniye gecikebilir.
   Ekran bu sürede **kendiliğinden**, artan aralıklarla arka planda durumu yeniler; siz
   hiçbir şey yapmadan onay geldiğinde otomatik olarak **"Aboneliğiniz aktif"**a döner.
4. Beklerken ekranda her zaman görünür bir **"Durumu yenile"** butonu da vardır;
   isterseniz beklemeden buna tıklayıp durumu hemen elle sorgulayabilirsiniz.
5. Bekleme belirli bir süreyi (yaklaşık 1,5 dakika) aşarsa ekran mesajı değişir: ödeme
   alındıysa kısa süre içinde aktifleşeceğini, alınmadıysa ne yapmanız gerektiğini
   söyler. Bu durumda da **"Durumu yenile"** butonuyla tekrar sorgulayabilirsiniz.
6. Aktif abonelikte tutar ve bir sonraki yenileme tarihi gösterilir.

> Şu an abonelik durumu uygulamayı kullanmanızı **engellemez** — pasif/beklemede
> abonelikle de tutanak oluşturmaya, fotoğraf eklemeye, PDF indirmeye devam
> edebilirsiniz. Bu ekran sadece ödeme durumunuzu takip etmek içindir.

---

## Sık Sorulan Sorular (SSS)

**Kiracının hesap açması gerekiyor mu?**
Hayır. Kiracı yalnızca kendisine gönderilen linki açar; kayıt/giriş gerekmez.

**Onay, resmi bir imza mıdır?**
Hayır. Uygulama bunu açıkça belirtir: onay "destekleyici kanıt"tır, resmi hukuki delil
değildir.

**Fotoğraftaki tarih değiştirilebilir mi?**
Hayır. Tarih-saat damgası fotoğraf yüklendiği anda sunucu tarafından üretilir ve hiçbir
kullanıcı (siz dahil) bunu sonradan değiştiremez.

**Tutanağın başlığını/notunu sonradan düzenleyebilir miyim?**
Hayır. Tutanak oluşturulduktan sonra metin alanları düzenlenemez; yalnızca fotoğraf
eklenebilir (onaylanana kadar).

**Kiracı onayladıktan sonra tutanağa fotoğraf ekleyebilir miyim?**
Hayır. Onaydan sonra tutanağın içeriği dondurulur; fotoğraf ekleme alanı tamamen
kaybolur. Bu, onaylanan kanıtın sonradan değiştirilememesini garanti eder.

**Kiracıya gönderdiğim e-posta ulaşmazsa ne olur?**
Paylaşım linki her durumda geçerli kalır. E-posta gönderimi başarısız olursa panelde
bir uyarı görürsünüz; WhatsApp butonuyla veya linki kopyalayıp başka bir kanaldan
(SMS, mesajlaşma uygulaması) göndererek devam edebilirsiniz.

**Başka bir kullanıcının tutanaklarını görebilir miyim?**
Hayır. Her kullanıcı yalnızca kendi oluşturduğu tutanakları görür ve yönetir.

**Bir tutanağı silebilir miyim?**
Hayır, şu anda silme/güncelleme özelliği yoktur.

**Uygulamayı telefonuma "yüklemem" gerekiyor mu?**
Hayır, tarayıcıdan doğrudan kullanılır (bir web sitesi gibi). İsterseniz tarayıcınızın
"Ana ekrana ekle" seçeneğiyle bir uygulama simgesi gibi telefonunuza ekleyebilirsiniz
(PWA desteği).
