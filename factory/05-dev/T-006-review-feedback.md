# qa-agent sent T-006 back (CHANGES)

QA VERDICT: FAIL (mapped to CHANGES). Ortam docker compose ile ayağa kaldırıldı (worktree: .worktrees/T-006, `cp .env.example .env && docker compose up -d --build`), tüm servisler (db/minio/mailpit/api/web) sağlıklı kalktı, smoke test (`GET http://localhost:3000/health` -> 200 `{"status":"ok"}`) PASS.

KABUL KRİTERLERİ (K1-K6 gerçek curl istekleriyle doğrulandı, hepsi PASS):
- K1 PASS: `POST /api/v1/reports/{id}/photos` (multipart, gerçek jpeg) -> 201 + `{id, capturedAt, ...}`.
- K2 PASS: `capturedAt` sunucu saatiyle otomatik dolduruluyor (istekteki hiçbir alan olmadan).
- K3 PASS: multipart body'ye `capturedAt=2000-01-01...` eklense de görmezden gelindi, kaydedilen damga yine sunucu saatiydi.
- K4 PASS: PATCH/PUT/DELETE `/reports/{id}/photos/{photoId}` ve PATCH `/reports/{id}/photos` hepsi 404. Ayrıca DB seviyesinde doğrulandı: `UPDATE report_photos SET captured_at=...` -> `ERROR: immutable column captured_at cannot be modified` (trigger `report_photos_captured_at_immutable`).
- K5 PASS: `.txt` -> 400 `UNSUPPORTED_MEDIA_FORMAT`; içeriği metin olup `.jpg`/`image/jpeg` beyan edilen dosya da 400 (beyana güvenilmiyor, içerik sniff ediliyor); `.gif` -> 400. PNG kabul edildi (201).
- K6 PASS: aynı tutanağa 9 fotoğraf eklendi (ardışık + 5 eşzamanlı istek dahil), `GET /reports/{id}/photos` hepsini kendi `capturedAt` değerleriyle sıralı döndürdü.
- K7 KISMİ DOĞRULANDI: Gerçek mobil cihaz bu ortamda yok (dev-agent'ın devlog'unda da belirtilmiş bir sınırlama), bu yüzden gerçek kamera açılışı test edilemedi. Bunun yerine Playwright ile canlı DOM'da doğrulandı: `input[type=file]` üzerinde `accept="image/*" capture="environment"` mevcut (kaynak koddaki gibi gerçekten render ediliyor), dosya seçilince önizleme gösteriliyor, "Yükle" butonu tıklanınca `POST .../photos` 201 dönüyor.

BLOCKER BULGU (K7'nin kendi manuel doğrulama senaryosunun 5. adımını FAIL ediyor — devlog T-006-devlog.md bu adımı açıkça QA'ya devretmiş: "'Yükle' ile gönderilir ve fotoğraf, sunucu damgasıyla ızgarada görünür"):
Yüklenen fotoğraflar API'den dönen `url` alanı üzerinden TARAYICIDA HİÇ GÖRÜNTÜLENMİYOR. Presigned URL'ler `http://minio:9000/...` (Docker içi servis adı) host'unu kullanıyor; bu host yalnızca container ağından çözümlenebilir, ne geliştirme makinesindeki tarayıcı ne de LAN'daki gerçek bir mobil cihaz bu adresi çözemez. Playwright ile canlı doğrulandı: rapor detay sayfasında 4 fotoğraf thumbnail'i gri kutu olarak kaldı, konsolda her biri için `net::ERR_NAME_NOT_RESOLVED`, `naturalWidth: 0`. Ekran görüntüsü: `/tmp/qa-pw/screenshot.png` (damga metinleri doğru görünüyor ama görsel hiçbirinde yüklenmiyor).

YENİDEN ÜRETİM ADIMLARI (branch: ticket/T-006, ~2 dk):
1. `cp .env.example .env && docker compose up -d --build` (proje kökünde).
2. `curl -X POST localhost:3000/api/v1/auth/register -H 'Content-Type: application/json' -d '{"email":"x@x.com","password":"Secret123!"}'` sonra `/auth/login` ile `accessToken` al.
3. `curl -X POST localhost:3000/api/v1/reports -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"templateId":"<templates listesinden bir id>","title":"t"}'` ile `reportId` al.
4. `curl -X POST localhost:3000/api/v1/reports/$reportId/photos -H "Authorization: Bearer $TOKEN" -F "file=@herhangi_bir.jpg;type=image/jpeg"` -> yanıttaki `url` alanına bak: `http://minio:9000/tutanak-photos/...` şeklinde.
5. Bu URL'yi (veya `http://localhost:5173/reports/$reportId` sayfasını) bir tarayıcıda aç: görsel hiç yüklenmiyor / `ERR_NAME_NOT_RESOLVED`.

Beklenen: presigned URL, tarayıcının çözümleyebileceği bir host kullanmalı (yerelde ör. `http://localhost:9000`, üretimde public R2 domaini) — böylece fotoğraf gerçekten ızgarada görünsün. Muhtemel kök neden (yalnızca konum işareti, düzeltme yapılmadı): `apps/api/src/infra/storage/r2-storage.adapter.ts` presigned URL üretirken server-to-server bağlantı için kullanılan aynı `R2_ENDPOINT` değerini (docker-compose'ta `http://minio:9000` ile ezilen) tarayıcıya dönen URL için de kullanıyor; internal S3 client endpoint'i ile public/browser-facing endpoint ayrı bir env değişkeniyle ayrıştırılmamış.

KEŞİF TESTİ (kriter dışı, ek bulgu — FAIL nedeni değil ama raporlanmalı): Yetkisiz erişim (token'sız -> 401), boş body (-> 400 "fotoğraf zorunludur"), geçersiz UUID / var olmayan report id (-> 404), başka kullanıcının tutanağına yükleme/listeleme denemesi (-> 403 doğru şekilde), aşırı büyük dosya ~11MB (-> 400 FILE_TOO_LARGE), 5 eşzamanlı yükleme isteği (hepsi 201, veri bozulması yok) — bunların hepsi doğru davrandı, sorun yok.

REGRESYON: `/api/v1/me`, `/api/v1/reports/{id}` (GET), `/api/v1/templates` -> hepsi 200, önceki ticket'lar (T-003 auth, T-005 report) kırılmamış.

Ortam temizlendi (`docker compose down -v`). Sonraki denemede maker: presigned URL'nin tarayıcıdan (host makine / gerçek mobil cihaz) gerçekten erişilebilir olduğunu bizzat bir tarayıcıda açarak doğrulamalı, yalnızca API 201 dönüşüne bakmamalı.
