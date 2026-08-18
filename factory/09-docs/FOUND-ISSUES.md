# FOUND-ISSUES.md

Dokümantasyon hazırlanırken (kod çalıştırılıp doğrulanırken) fark edilen, ticket kapsamı
dışında kalan bulgular. Bu dosyanın amacı bulguyu kaydetmektir — **kod değiştirilmedi**.

> **Not (bu revizyon):** Bu dosyanın önceki sürümündeki 4 maddenin **tamamı**, bu
> dokümantasyon setinin ilk yazımından sonra mergelenen **T-023** tarafından koddan
> (root `README.md` + `docker-compose.yml`) çözüldü. Aşağıda hem "çözüldü" olarak
> işaretlenmiş eski maddeler hem de bu revizyonda yeni tespit edilen bulgular yer alır.

## 1. [ÇÖZÜLDÜ — T-023] `README.md`'deki `.env` kabuk yükleme komutu artık önerilmiyor

Önceki bulgu: kök `README.md`'nin `test:e2e` için önerdiği `set -a && . ./.env && set +a`
komutu, `EMAIL_FROM=Tutanak <noreply@localhost>` satırındaki tırnaksız `<...>` yüzünden
`parse error near \`\n'` ile patlıyordu (doğrulanmıştı).

**Durum:** T-023 ile kök `README.md`'nin "Testleri Çalıştırma" bölümü baştan yazıldı; bu
komut artık **hiç önerilmiyor**. Yeni yaklaşım: her e2e spec'i zorunlu ortam
değişkenlerini kendi `beforeAll`'ı içinde ayarlıyor, kabuğa `.env` yüklemeye gerek yok —
yalnızca `DATABASE_URL` dışarıdan verilmeli. Bu revizyonda `SETUP.md` bu yeni davranışa
göre güncellendi ve **doğrulandı**: temiz bir kabukta (`.env` yüklenmeden), yalnızca
`DATABASE_URL` tanımlıyken `npm run test:e2e` sıfır hatayla geçti (o revizyonda 198 test;
bu revizyonda, T-026'nın eklediği 2 yeni e2e testiyle **200 test**, yine sıfır hatayla).

## 2. [ÇÖZÜLDÜ — T-023] Mailpit servisi kaldırıldı

Önceki bulgu: `docker-compose.yml` bir `mailpit` servisi çalıştırıyordu ama uygulama
e-postayı Resend'in HTTPS API istemcisiyle gönderdiği için (SMTP değil) mailpit'e hiç
e-posta düşmüyordu; geliştirici `localhost:8025`'i açıp boş bulabiliyordu.

**Durum:** T-023, karar (b)'yi uyguladı: `mailpit` servisi `docker-compose.yml`'den
**tamamen kaldırıldı** (doğrulandı: `docker compose config --services` → `db, minio, api,
minio-init, web`, mailpit yok). Kök `README.md`'ye ayrı bir "Yerelde e-posta" bölümü
eklendi ("e-posta GÖNDERİLMEZ ve yakalanmaz" cümlesiyle). Bu revizyonda
`factory/09-docs/*` bu davranışa göre güncellendi (README.md, SETUP.md, ARCHITECTURE.md).

## 3. [ÇÖZÜLDÜ — T-023] Kök `README.md`'nin modül listesi güncellendi

Önceki bulgu: kök `README.md` satır 7 hâlâ "GET /health hazır, iş modülleri sonraki
ticketlarda" diyordu (T-001'den kalma), oysa 9 iş modülü tamamlanmıştı.

**Durum:** T-023 commit'i (`docs(readme): modul listesini guncelle ve calismayan e2e env
komutunu duzelt`, `44538df`) bu satırı günceledi; kök `README.md` artık 9 modülü
(auth, users, templates, reports, photos, pdf, sharing, approvals, billing) doğru listeler
(doğrulandı, satır 7-8).

## 4. [ÇÖZÜLDÜ] Yerel `main` git dalı artık `origin/main` ile senkron

Önceki bulgu: bu çalışma alanındaki yerel `main` dalı zaman zaman `origin/main`'in
gerisinde kalıyordu.

**Durum:** Bu revizyonun hazırlandığı çalışma alanında yerel `main`, `origin/main` ile
**birebir aynı** (doğrulandı: `git rev-parse HEAD` = `git rev-parse origin/main` =
`374cce906654cd4b26f32fb580a9f189e4a41f3a`, T-028 (fotoğraf küçültmesi istemciye taşındı)
dahil tüm mergelenmiş ticket'ları kapsıyor). Bu maddenin tekrar oluşup oluşmayacağı bu
ajan oturumunun kapsamı dışındadır.

---

## 5. (YENİ) `docker-compose.e2e.yml`'de kullanılmayan bir `mailpit` servisi kalmış

**Nerede:** `docker-compose.e2e.yml` satır 49-53.

**Sorun:** T-023, yerel geliştirme `docker-compose.yml`'inden `mailpit`'i kaldırdı, ama
devops/release aşamasında eklenen ayrı `docker-compose.e2e.yml` (duman testi/GATE3
kontrolü için, `factory/10-release/devops-report.md`'de belgeli) hâlâ bir `mailpit`
servisi tanımlıyor. Dosyadaki yorum bunu zaten "T-023 bekliyor" diye işaretlemiş
(`factory/10-release/devops-report.md`'nin T-023'ten **önce** yazıldığı görülüyor).
Uygulama bu servise de hiçbir zaman e-posta göndermez (aynı kök neden: Resend HTTPS API,
SMTP değil).

**Etki:** Düşük — bu dosya son kullanıcı/geliştirici kurulum akışının (`SETUP.md`) parçası
değildir, yalnızca devops/release duman testinde kullanılır; local dev deneyimini
etkilemez. Ancak `docker-compose.yml` ile `docker-compose.e2e.yml` arasında artık bir
tutarsızlık var.

**Önerilen düzeltme (kod değiştirilmedi):** `docker-compose.e2e.yml`'den de `mailpit`
servisinin kaldırılması, `docker-compose.yml` ile aynı desene getirilmesi.

## 6. (YENİ) Bu çalışma alanında bırakılmış `.worktrees/T-024`, `.worktrees/T-025` dizinleri kök `npm run lint`'i kırıyor

**Nerede:** repo kökü, `.worktrees/T-024/`, `.worktrees/T-025/` (git worktree kalıntıları,
versiyon kontrolünde değil — `git status` "Untracked files").

**Sorun:** `eslint.config.mjs`'in `ignores` listesi `factory/**`, `node_modules/**` vb.
içerir ama `.worktrees/**`'i içermez. Bu çalışma alanında (geçmiş ticket denemelerinden
kalma) `.worktrees/T-024` ve `.worktrees/T-025` dizinleri repo kökünde durduğu için kök
dizinde `npm run lint` çalıştırıldığında bu dizinlerin içindeki dosyalar da taranıyor ve
**112 sahte hata** üretiyor (`no-extraneous-class`, `consistent-indexed-object-style` vb.
— gerçek kod hatası değil, aynı dosyaların ikinci bir kopyası taranıyor).

**Doğrulama:** Aynı kod, `.worktrees/` içermeyen temiz bir kopyada (`rsync` ile
`node_modules`/`.worktrees`/`.git` hariç kopyalanıp `npm run lint` çalıştırıldığında)
**sıfır hatayla** geçti — CI de `.worktrees` içermeyen taze bir checkout kullandığı için
bu sorunu hiç görmez. `SETUP.md`'deki "npm run lint sıfır hatayla geçer" iddiası bu temiz
kopya üzerinde doğrulanmıştır. Bu revizyonda ayrıca `npm run format:check`'in **aynı kök
nedenden** aynı şekilde etkilendiği doğrulandı (`.worktrees/T-024/apps/web/src/api/schema.d.ts`
ve `.worktrees/T-025/.../schema.d.ts` için "Code style issues found in 2 files" uyarısı
verir); temiz kopyada `format:check`, `lint`, `build` ve `verify:pwa` hepsi hatasız geçti.

**Etki:** Yalnızca bu ajan çalışma alanını etkiler; gerçek CI/geliştirici ortamlarını
etkilemez, ama bu çalışma alanında elle `npm run lint` çalıştıran bir sonraki ajan/kişi
yanlışlıkla "kod bozuk" sonucuna varabilir.

**Önerilen düzeltme (kod değiştirilmedi):** Ya `.worktrees/**` `eslint.config.mjs`
`ignores` listesine eklenir (kalıcı çözüm, defans katmanı), ya da bu çalışma alanındaki
kalıntı worktree'ler pipeline tarafından temizlenir (`git worktree remove`).

---

## 7. (Bu revizyonda yeniden doğrulandı, çözülmedi) Madde 5 ve 6 hâlâ geçerli

Bu dokümantasyon turunda (`main` = `d619c8a`, T-027 dahil) madde 5 (`docker-compose.e2e.yml`
içindeki kullanılmayan `mailpit` servisi) ve madde 6 (`.worktrees/T-024`, `.worktrees/T-025`
kalıntılarının kök `npm run lint`'i kirletmesi) tekrar kontrol edildi — ikisi de **hâlâ
aynen mevcut**, T-027 bunlara dokunmadı. Ayrıca bu turda `docker-compose.e2e.yml`'ye T-027
kapsamında yalnızca bir yorum satırı eklendiği doğrulandı (`POSTGRES_PASSWORD` geçici
fixture şifresinin neden değiştirilmediğini açıklıyor); `mailpit` servisi bu yorumdan
etkilenmedi, hâlâ tanımlı duruyor.

## 8. (Bu revizyonda yeniden doğrulandı, çözülmedi) Madde 5 ve 6, T-028 sonrasında da geçerli

Bu dokümantasyon turunda (`main` = `374cce9`, T-028 dahil) madde 5 ve 6 yeniden kontrol
edildi. T-028 yalnızca `apps/web`'e (istemci tarafı fotoğraf küçültme) dokunduğu için
`docker-compose.e2e.yml` ve `.worktrees/` ile hiçbir ilgisi yok — beklendiği gibi ikisi de
**değişmeden hâlâ mevcut**: `.worktrees/T-024` ve `.worktrees/T-025` kalıntı dizinleri kök
`npm run lint`'i bu çalışma alanında yeniden **112 sahte hatayla** kirletiyor (doğrulandı,
bu revizyonda tekrar koşuldu); `.worktrees/` hariç tutulan temiz bir kopyada (`rsync` ile
`node_modules`/`.worktrees`/`.git`/`factory` hariç kopyalanıp `npm ci` çalıştırılarak
yeniden üretildi) `npm run lint`, `npm run format:check`, `npm run typecheck` ve
`npm run build` **sıfır hatayla** geçti (build çıktısı: web bundle 312,63 kB / gzip
97,30 kB — T-028 devlog'undaki sayıyla birebir). T-028 kod tabanına yeni bir sorun
eklemedi; birim test sayıları güncellendi (bkz. SETUP.md: `@tutanak/web` artık 55
suite/408 test, toplam 121 suite/853 test — T-028'in eklediği `downscale-photo.spec.ts`
[17 test] + `usePhotos.spec.tsx`'e 1 test dahil).

---

## 9. (Bu revizyonda yeniden doğrulandı) H-001..H-004 sonrası durum: madde 5 ÇÖZÜLDÜ, madde 6 bu çalışma alanında artık gözlenmiyor

Bu dokümantasyon turu (`main` = `5f86403`, T-028 üzerine H-001, H-002, H-003, H-004
mergelenmiş) sırasında bu çalışma alanı sıfırdan (`docker compose up`) ayağa kaldırıldı,
19 endpoint'in tamamı `curl` ile gerçekten çağrıldı, tüm kalite kapıları (`npm run test`,
`npm run test:e2e`, `lint`, `format:check`, `typecheck`, `build`, `verify:pwa`) baştan
çalıştırıldı. Sonuçlar:

- **Madde 5 [ÇÖZÜLDÜ]:** `docker-compose.e2e.yml` artık `mailpit` servisi
  **tanımlamıyor**; dosya başlığındaki yorum artık "SMTP yakalayıcısı YOKTUR, bu
  FOUND-ISSUES.md madde 2/5/7/8'e atıfla bilinçli bir tercihtir" diyor (release chore
  commit `43eddb7`'de düzeltilmiş). `docker-compose.yml` ile aynı deseni taşıyor,
  tutarsızlık kalmadı.
- **Madde 6:** Bu çalışma alanında `.worktrees/T-024`/`.worktrees/T-025` kalıntı
  dizinleri **bulunmuyor**; kök `npm run lint` bu oturumda **sıfır hatayla** geçti.
  Sorunun kök nedeni (`eslint.config.mjs`'in `ignores` listesinin `.worktrees/**`
  içermemesi) koddan hâlâ **düzeltilmedi** — bu yalnızca bu oturumun çalışma alanında
  kalıntı dizin bulunmadığı anlamına gelir, bir sonraki ajan/insan eski bir worktree
  bırakırsa sorun tekrar oluşabilir. Önerilen düzeltme (madde 6'daki) hâlâ geçerlidir.
- **Yeni ölçüm — build bundle boyutu:** bu revizyonda `npm run build` çıktısı web bundle
  **313,64 kB / gzip 97,81 kB** verdi (madde 8'deki 312,63/97,30'a göre küçük bir artış —
  H-004'ün eklediği masaüstü CSS kuralları kaynaklı, davranış hatası değildir).
- **Yeni ölçüm — PDF boyutu:** aynı test senaryosunda (1 küçük fotoğraf, kısa
  başlık/not) üretilen PDF artık **16.143 bayt / 2 sayfa** (önceki revizyonlarda 3.069
  bayt/3 sayfa idi) — H-001'in gömdüğü DejaVu Sans/Bold Unicode fontlarının (PDFKit alt
  küme/subset alsa da) standart WinAnsi fontuna göre daha büyük olmasından kaynaklanır;
  bu beklenen bir davranıştır, hata değildir.
- **Yeni açık bulgu — B-005 (bu FOUND-ISSUES listesine değil, `factory/bugs/B-005.md`'ye
  kayıtlıdır):** H-002 sonrası orkestratör tarafından bulundu, üç sabit şablonun
  `name`/`description` alanları (`apps/api/prisma/seed.ts`) hâlâ ASCII'ye katlanmış
  Türkçe'dir. Kod **değiştirilmedi** (bu ajanın yetkisi dışında); doküman setinde
  README.md "Bilinen sınırlamalar", API.md "templates" bölümü ve ARCHITECTURE.md §7.15/
  §7.18'de kayıt altına alındı.
