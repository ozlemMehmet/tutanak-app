# Lansman Kontrol Listesi — Tutanak

> Kapsam: lansman günü + ilk 30 gün. Ürünün kendisinde bir analitik/telemetri katmanı **yoktur**
> (mimari/dev dokümanlarında GA/Plausible/PostHog gibi bir entegrasyon bulunmuyor) — bu yüzden
> aşağıdaki ölçüm planı, koda dokunmadan (UTM parametreleri, manuel sayım, mevcut admin/DB erişimi)
> yapılabilecek yöntemlere dayanıyor. Kalıcı bir in-app analitik ihtiyacı varsa bu bir ürün
> değişikliğidir → bkz. `product-feedback.md`.

## 0. Ön Koşullar (Lansmandan Önce Kontrol Edilecek)

- [ ] Prod ortam `runbook.md`'ye göre ayakta: `https://<domain>/health` 200 dönüyor.
- [ ] `iyzico` üye iş yeri hesabı aktif, gerçek ödeme testi (küçük tutar) yapıldı ve iade edildi.
- [ ] `Resend` gönderen alan adı doğrulanmış (paylaşım e-postaları spam'e düşmüyor).
- [ ] `SUBSCRIPTION_PRICE_AMOUNT` prod ortamda `pricing.md`'deki fiyatla **birebir aynı** değere
      ayarlı (tutarsızlık, ilk kullanıcıda güven kaybı riski taşır).
- [ ] Landing page (`landing.md` içeriği) prod'da yayında, CTA'lar gerçek `/register` adresine
      gidiyor.
- [ ] Geri bildirim kanalı hazır: kullanıcıların soru/şikayet/öneri gönderebileceği tek bir kanal
      (ör. kurucunun WhatsApp numarası veya bir e-posta adresi) landing/onboarding mesajında açık.

## 1. Analitik / Ölçüm Kurulumu (Koda Dokunmadan)

Ürün içinde native analitik olmadığından, aşağıdaki **düşük maliyetli, kod değişikliği
gerektirmeyen** yöntemler kullanılacak:

- [ ] Her kanal (Facebook, Instagram, LinkedIn, dernek daveti, kişisel ağ) için ayrı **UTM'li link**
      üretilir (ör. `https://<domain>/register?utm_source=facebook&utm_campaign=lansman`), tıklama
      sayısı sunucu erişim loglarından ya da paylaşılan bir kısaltma servisinden takip edilir.
- [ ] Kayıt (signup) sayısı: haftalık olarak `users` tablosundan (prod DB, salt-okunur sorgu) manuel
      sayılır — kaç kişi kaydoldu, hangi tarihte.
- [ ] Aktivasyon (ilk tutanak): haftalık olarak `reports` tablosunda kullanıcı başına en az 1 kayıt
      var mı sorgusu — PRD başarı metriği "5 dakikada ilk tutanak" ile ilişkili aktivasyon oranı.
- [ ] Paylaşım/onay oranı: `share_deliveries` ve `approvals` tablolarından, paylaşılan tutanakların
      48 saat içinde onaylanma oranı (PRD başarı metriği: ≥%50).
- [ ] Ödeme dönüşümü: `subscriptions.status = 'active'` sayısı — PRD hedefi: ilk 60 günde ≥1 ücretli
      abone.
- [ ] Bu sorguların tamamı **salt-okunur**; hiçbir üretim verisi bu süreçte değiştirilmez.
- [ ] (Opsiyonel, ücretsiz) `UptimeRobot` ile `/health` izleme zaten `runbook.md`'de var — bu aynı
      zamanda "site ayakta mı" temel güvencesini sağlar, ayrıca kurulum gerekmiyor.

**Not:** Kalıcı bir kullanıcı davranışı analitiği (huni, oturum kaydı vb.) gerekiyorsa bu bir ürün/
mühendislik kararıdır ve bu görevin kapsamı dışındadır → `product-feedback.md`'ye not edildi.

## 2. Geri Bildirim Kanalı

- [ ] Tek, açık ve düşük sürtünmeli bir kanal seçilir (öneri: WhatsApp — hedef kitle zaten orada
      aktif, bkz. `channel-plan.md`). E-posta ikincil kanal olarak tutulur.
- [ ] Bu kanal `/register` sonrası karşılama ekranında veya onboarding mesajında ("Sorun olursa
      buradan yazın") görünür kılınır.
- [ ] Her geri bildirim, basit bir tabloya (kullanıcı, tarih, konu, durum) kaydedilir — ayrı bir
      araç kurmaya gerek yok, bir e-tablo yeterli.
- [ ] Ürün eksikliği/isteği içeren geri bildirimler `factory/11-launch/product-feedback.md`'ye
      aktarılır (bu görevin sınırı: bug/istek toplamak, ürünü değiştirmek değil).

## 3. İlk 10 Kullanıcıya Bire Bir Ulaşma Planı

- [ ] Kullanıcının kendi kişisel ağından (bkz. `channel-plan.md` §1) en az 10 emlakçı/emlak ofisi
      belirlenir.
- [ ] Her biriyle **canlı, birlikte** ilk tutanak oluşturulur (telefon/ekran paylaşımı ya da yüz
      yüze) — sadece link gönderip beklenmez; PRD başarı metriği "5 dakikada ilk tutanak" bu
      oturumda gözlemlenir ve gerçekten 5 dakikada bitip bitmediği not edilir.
- [ ] Oturum sonunda 3 soru sorulur: (1) Bu size gerçekten zaman kazandırır mı? (2) Fiyatı nasıl
      buldunuz — pahalı/uygun/ucuz? (3) Eksik gördüğünüz bir şey var mı? Cevaplar not edilir.
- [ ] Bu 10 kullanıcıdan en az 3'ünün gerçekten en az 5 tutanak oluşturması PRD başarı metriği
      ile birebir eşleşir — 30 gün sonunda bu sayı raporlanır.
- [ ] Onboarding sonrası her kullanıcıya 48 saat içinde tek bir kontrol mesajı ("Kullanmaya devam
      ediyor musunuz, bir sorun var mı?") gönderilir — otomatik değil, elle.
- [ ] Bu 10 kullanıcıdan yazılı izin alınanlar, sosyal kanıt havuzuna eklenir (bkz. `landing.md`
      §3) — izinsiz hiçbir isim/logo kullanılmaz.

## 4. Haftalık Ölçüm Ritmi (İlk 30 Gün)

| Hafta | Hangi metrik | Nerede/nasıl ölçülür | Hedef (PRD'den) |
|---|---|---|---|
| 1 | Kayıt sayısı, aktivasyon (ilk tutanak) oranı | `users`/`reports` tablosu, manuel sorgu | En az birkaç aktif kullanıcı denemesi (nicel hedef yok, kalite gözlemi) |
| 1 | Onboarding oturumlarında "5 dakikada ilk tutanak" gözlemi | Bire bir oturum notları (§3) | 5 dk içinde tamamlanma |
| 2 | Paylaşım → onay oranı (48 saat içinde) | `share_deliveries`/`approvals` | ≥ %50 |
| 2 | Kanal bazlı tıklama/kayıt (UTM) | Erişim logu / kısaltma servisi | Hangi kanal işe yarıyor, sonraki hafta oraya ağırlık verilir |
| 3 | Aktif ofis/emlakçı sayısı (≥5 tutanak oluşturan) | `reports` tablosu, kullanıcı başına sayım | İlk 30 günde ≥3 ofis |
| 3 | Geri bildirim teması (§2 tablosu) | E-tablo | Tekrar eden 3+ şikayet varsa önceliklendirilir (product-feedback.md) |
| 4 | Ücretli abonelik dönüşümü | `subscriptions.status='active'` | İlk 60 günde ≥1 (haftada takip, 60 gün sonuna kadar) |
| 4 | Haftalık geri dönüş (retention) | Kullanıcı bazlı `reports.created_at` haftalık dağılımı | Pilot kullanıcıların ≥2'si haftada ≥1 kez geri dönüyor |

- [ ] Her hafta sonunda (Pazar/Pazartesi) bu tablo tek bir sayfada güncellenir, önceki haftayla
      karşılaştırılır.
- [ ] 30. günün sonunda PRD §5 "Başarı Metrikleri" ile bu tablo birebir karşılaştırılıp bir özet
      çıkarılır (hangi hedefe ulaşıldı, hangisine ulaşılamadı, neden).

## 5. Lansman Günü Sırası (Özet)

1. §0 ön koşullar tamamlanır.
2. Kişisel ağdan ilk 3-5 kullanıcı ile bire bir oturum yapılır (§3) — **herkese açık duyurudan
   önce**, ürün gerçek kullanıcıda sorunsuz çalıştığı doğrulanır.
3. Sorun çıkmazsa Facebook/Instagram/LinkedIn ilk gönderileri yayınlanır (`channel-plan.md`
   §2-3-5).
4. Dernek/oda temasları (§4) paralel başlatılır, yanıt beklenir.
5. Geri bildirim kanalı ve haftalık ölçüm ritmi (§4) ilk günden itibaren işletilir.
