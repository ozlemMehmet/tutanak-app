# PRD — Emlak Teslim Tutanağı Platformu (MVP)

> Uretici: prd-agent | Tarih: 2026-08-11 | Kaynak: 01-intake/analysis.md

## 1. Urun Ozeti
Bu ürün, emlak yönetim ofisleri ve emlakçıların kiracı giriş/çıkış teslim süreçlerinde mülkün durumunu fotoğraf + not + otomatik tarih damgası ile belgelemesini ve karşı tarafın (kiracı) tek tıkla onaylamasını sağlayan mobil öncelikli bir web uygulamasıdır (PWA). Ürün, dağınık WhatsApp fotoğrafları ve statik Word şablonlarının yerine, hazır emlak şablonları (giriş/çıkış teslim tutanağı, sayaç/demirbaş tespiti, periyodik durum kontrolü) üzerinden kayıt oluşturma ve PDF çıktısı sunar. Onay mekanizması e-imza değildir; ürün arayüzünde ve pazarlamasında "destekleyici kanıt / delil başlangıcı" olarak konumlanır, "resmi hukuki delil" ifadesi kullanılmaz. MVP, en güçlü doğrudan rakip AkıllıKira'nın giriş paketinin (₺249/ay) altında fiyatlanan, aylık abonelikli, tek işleve odaklı hafif bir alternatif olarak konumlanır. Veri modeli jenerik "tutanak şablonu" kavramı üzerine kurulu olsa da bu MVP'nin satış odağı ve kapsamı yalnızca emlak dikeyine kilitlidir.

## 2. Personalar

### Persona 1: Selin — Emlak Ofisi Yöneticisi
- Baglam/yas/meslek: 38 yaşında, 4 kişilik bir emlak yönetim/kiralama ofisinin sahibi.
- Teknik seviye: Orta — WhatsApp, e-posta ve temel web formlarını rahat kullanır, yeni bir yazılıma abone olurken ek IT desteği gerektirmeyen bir kurulum bekler.
- Motivasyon: Depozito iadesi anlaşmazlıklarında kanıt eksikliğinden kaynaklanan zaman kaybını azaltmak, dağınık WhatsApp fotoğraf arşivinden kurtulmak.
- Kullanim ani: Ofisten, ay sonunda abonelik ödemesini yaparken ve ekibinin oluşturduğu tutanakları haftalık olarak gözden geçirirken uygulamayı kullanır.

### Persona 2: Kaan — Emlak Danışmanı (Saha Görevlisi)
- Baglam/yas/meslek: 27 yaşında, Selin'in ofisinde çalışan saha danışmanı; günde 2-4 mülk ziyareti yapar.
- Teknik seviye: Yüksek — akıllı telefonu aktif kullanır, kamera uygulamalarına ve form doldurmaya aşinadır.
- Motivasyon: Mülk teslim sırasında ek bir adım eklemeden, tek elle telefon üzerinden kayıt almak; ofise dönünce ayrıca rapor hazırlamak zorunda kalmamak.
- Kullanim ani: Kiracı ile birlikte mülkte, teslim anında, telefon kamerasıyla oda oda fotoğraf çekerken uygulamayı kullanır.

### Persona 3: Ayşe — Kiracı (Karşı Taraf)
- Baglam/yas/meslek: 31 yaşında, kiraladığı daireye yeni taşınan veya dairesinden çıkan kiracı; ürünün doğrudan müşterisi değil, onay akışının tarafı.
- Teknik seviye: Temel — akıllı telefonuyla link açıp okuyabilir, hesap açma/şifre hatırlama gibi ek adımlardan kaçınmak ister.
- Motivasyon: Teslim anındaki mülk durumunun kayıt altına alındığından emin olmak, depozito iadesinde mağdur olmamak, süreci imza atmadan tamamlamak.
- Kullanim ani: Kaan'ın gönderdiği e-posta/WhatsApp linkini açıp tutanağı incelerken ve tek tıkla onaylarken uygulamayı kullanır.

## 3. Kullanici Hikayeleri
| ID | Persona | Hikaye ("X olarak Y istiyorum cunku Z") | Oncelik |
|---|---|---|---|
| H-01 | Kaan | Emlak danışmanı olarak, mülkte foto+not ile kayıt oluşturmak istiyorum, çünkü saha ziyareti sırasında zaman kaybetmeden durumu belgelemek istiyorum. | Must |
| H-02 | Kaan | Emlak danışmanı olarak, kaydettiğim her fotoğrafa otomatik tarih/saat damgası eklenmesini istiyorum, çünkü tutanağın ne zaman oluşturulduğu tartışmasız olsun. | Must |
| H-03 | Kaan | Emlak danışmanı olarak, önceden tanımlı emlak şablonlarından (giriş/çıkış teslim, sayaç/demirbaş tespiti, periyodik kontrol) birini seçmek istiyorum, çünkü her seferinde alanları sıfırdan oluşturmak istemiyorum. | Must |
| H-04 | Kaan | Emlak danışmanı olarak, tamamladığım tutanağı PDF olarak indirmek istiyorum, çünkü arşivleyip gerektiğinde yazdırabileyim. | Must |
| H-05 | Kaan | Emlak danışmanı olarak, tutanağı e-posta veya WhatsApp üzerinden kiracıya paylaşmak istiyorum, çünkü onay sürecini sahada hemen başlatabileyim. | Must |
| H-06 | Ayşe | Kiracı olarak, bana gönderilen linkten hesap açmadan tutanağı görüntülemek istiyorum, çünkü ek bir kayıt sürecine girmeden kontrol edebileyim. | Must |
| H-07 | Ayşe | Kiracı olarak, tutanağı inceledikten sonra tek tıkla onaylamak istiyorum, çünkü imza atmadan sürecimi tamamlayayım. | Must |
| H-08 | Selin | Emlak ofisi yöneticisi olarak, e-posta+şifre ile hesap oluşturup giriş yapmak istiyorum, çünkü ofisimin tutanak kayıtlarına güvenli erişimim olsun. | Must |
| H-09 | Selin | Emlak ofisi yöneticisi olarak, abonelik ödemesi yapmak istiyorum, çünkü uygulamayı kesintisiz kullanmaya devam edeyim. | Must |
| H-10 | Kaan | Emlak danışmanı olarak, geçmiş tutanaklarımı listeleyip arayabilmek istiyorum, çünkü belirli bir mülk veya kiracı için önceki kaydı bulabileyim. | Should |
| H-11 | Ayşe | Kiracı olarak, onaylamadan önce tutanağın "resmi hukuki delil değil, destekleyici kanıt" olduğunu görmek istiyorum, çünkü neyi onayladığımı doğru anlayayım. | Must |

## 4. Kapsam Tablosu

### Kapsam ICINDE (MVP)
| # | Ozellik | Iliskili hikayeler |
|---|---|---|
| 1 | Fotoğraf + başlık + not ile kayıt oluşturma akışı | H-01 |
| 2 | Otomatik, değiştirilemez tarih/saat damgası | H-02 |
| 3 | 3 hazır emlak şablonu (giriş/çıkış teslim, sayaç/demirbaş tespiti, periyodik durum kontrolü) | H-03 |
| 4 | PDF çıktısı oluşturma | H-04 |
| 5 | E-posta / WhatsApp linki ile paylaşma | H-05 |
| 6 | Hesap açmadan link üzerinden tutanak görüntüleme | H-06 |
| 7 | Tek tıkla taraf onayı (zaman damgası + e-posta kimliği ile kaydedilir, PDF'e işlenir) | H-07 |
| 8 | E-posta + şifre ile kayıt/giriş | H-08 |
| 9 | Abonelik ödeme akışı (aylık, AkıllıKira giriş paketinin altında fiyatlanır) | H-09 |
| 10 | Geçmiş tutanakları listeleme ve arama | H-10 |
| 11 | Onay ekranında "destekleyici kanıt, resmi hukuki delil değildir" uyarı metni | H-11 |

### Kapsam DISINDA (v2+)
| # | Ozellik | Neden ertelendi (tek cumle) |
|---|---|---|
| 1 | Giriş/çıkış tutanaklarını otomatik karşılaştırma (yan yana fark gösterimi) | MVP'nin temel değer önermesi (kayıt oluşturma) karşılaştırma olmadan da teslim edilebilir, bu bilinçli olarak v1.1'e bırakıldı. |
| 2 | E-imza / KEP entegrasyonu | Dış entegratör bağımlılığı ve maliyet getirir; MVP'nin "destekleyici kanıt" konumlandırmasında henüz gerekli değil. |
| 3 | SMS/OTP doğrulama | Hedef kitle (KOBİ ölçekli emlak ofisleri) için kurumsal düzeyde kimlik doğrulama ihtiyacı kanıtlanmadı. |
| 4 | Self-servis şablon oluşturucu (kullanıcı kendi alanlarını tanımlar) | Talep doğrulanana kadar sabit 3 şablon MVP için yeterli kabul edildi. |
| 5 | Yeni sektör şablonları (oto/ekipman kiralama, inşaat, hukuk bürosu, kargo vb.) | MVP satış/pazarlama odağı bilinçli olarak emlak dikeyine daraltıldı. |
| 6 | Ev eşyası envanteri / sigorta hasar dosyası modülü | Ayrı bir kullanım senaryosu olduğundan bağımsız bir v2 modülü olarak planlandı. |
| 7 | Çoklu kullanıcı/rol yönetimi (ofis içi ekip, yetkilendirme) | MVP tek kullanıcı hesabı modeliyle başlıyor; ekip yönetimi ihtiyacı henüz doğrulanmadı. |
| 8 | Native mobil uygulama (App Store/Play Store) | PWA ile kamera erişimi MVP için yeterli kabul edildi, native geliştirme süreyi uzatır. |
| 9 | Bildirim/hatırlatma sistemi (onay bekleyen tutanak için otomatik hatırlatma) | Temel paylaş+onay akışı MVP için yeterli, otomasyon sonraki aşamaya bırakıldı. |
| 10 | Raporlama/analitik gösterge paneli (ofis performans metrikleri) | MVP çekirdek işlevi (kayıt oluşturma) önceliklidir, analitik ayrı bir değer önerisidir. |
| 11 | Depozito/kira takibi, sayaç okuma otomasyonu gibi geniş mülk-yönetim modülleri | Ürün bilinçli olarak "hafif tutanak aracı" konumunda kalıyor, geniş paket rakiplerle (AkıllıKira) doğrudan rekabet MVP hedefi değil. |

## 5. Basari Metrikleri
- [ ] Kullanıcı kayıttan sonra 5 dakika içinde ilk tutanağını (şablon seçimi + foto + not) oluşturur.
- [ ] Tamamlanan bir tutanak 2 dakika içinde PDF olarak indirilebilir veya paylaşılabilir.
- [ ] Paylaşılan tutanakların en az %50'si gönderildikten sonra 48 saat içinde karşı taraf tarafından onaylanır.
- [ ] İlk 30 gün içinde en az 3 emlak ofisi/emlakçı en az 5'er tutanak oluşturarak ürünü fiilen kullanır.
- [ ] İlk 60 gün içinde en az 1 kullanıcı ücretli aboneliğe geçer.
- [ ] Pilot kullanıcıların en az 2'si, 30 günlük dönem boyunca haftada en az 1 kez uygulamaya geri döner.

## 6. MVP Definition of Done
- [ ] Kullanıcı e-posta + şifre ile kayıt olup giriş yapabiliyor.
- [ ] Kullanıcı 3 hazır emlak şablonundan (giriş/çıkış teslim, sayaç/demirbaş tespiti, periyodik durum kontrolü) birini seçebiliyor.
- [ ] Kullanıcı seçtiği şablonda başlık + fotoğraf + not ekleyerek tutanak kaydı oluşturabiliyor.
- [ ] Her kayda otomatik tarih-saat damgası ekleniyor ve bu damga kullanıcı tarafından değiştirilemiyor.
- [ ] Tamamlanan tutanak PDF olarak indirilebiliyor.
- [ ] Tutanak e-posta veya WhatsApp linki ile paylaşılabiliyor.
- [ ] Karşı taraf hesap açmadan, paylaşılan linkten tutanağı görüntüleyebiliyor.
- [ ] Karşı taraf tek tıkla onaylayabiliyor; onay zaman damgası + kimliği (e-posta) PDF'e işleniyor.
- [ ] Onay ekranında "resmi hukuki delil değildir, destekleyici kanıttır" uyarısı görünüyor.
- [ ] Kullanıcı geçmiş tutanaklarını listeleyip arayabiliyor.
- [ ] Kullanıcı abonelik ödemesi yapabiliyor ve ödeme durumu hesabına yansıyor.
- [ ] Uygulama mobil tarayıcıda kamera erişimiyle çalışıyor (PWA, kurulum gerektirmeden).

## 7. Varsayimlar ve Acik Sorular
- Varsayım: "Emlak yönetim ofisi" tanımı, intake analizinin dar "property management" segmentinden ziyade kullanıcının "emlakçı arkadaşlarım" ifadesine dayanarak genel emlakçı/emlak ofisi kitlesine genişletildi; kesin tanım saha testinde netleşecek.
- Varsayım: Fiyat toleransı (₺200-400/ay) ve AkıllıKira'nın altında konumlanma kararı, formel LOI/anket görüşmeleriyle değil kullanıcının iş kararıyla doğrulandı — bu doğrulanmamış talep riski MVP boyunca geçerliliğini koruyor.
- Açık Soru: Kesin abonelik fiyatı (₺/ay) henüz belirlenmedi; pazarlama/gelir modeli çalışmasında netleştirilmeli.
- Açık Soru: Karşı taraf (kiracı) tutanağı reddederse veya hiç yanıt vermezse akış nasıl ilerleyecek (hatırlatma, zaman aşımı, ret nedeni girme)? MVP'de tanımlanmadı.
- Açık Soru: Bir tutanağa yalnızca tek taraf (kiracı) onayı mı yeterli, yoksa çok taraflı onay (ör. hem kiracı hem ev sahibi) senaryosu MVP'de destekleniyor mu?
- Açık Soru: Fotoğraf ve kişisel veri (kiracı adı, adres, sayaç bilgisi) saklama süresi ve silme politikası (KVKK uyumu) henüz netleştirilmedi.
- Açık Soru: Ücretsiz deneme süresi sunulacak mı, sunulacaksa kaç gün / kaç tutanak ile sınırlı olacak?
