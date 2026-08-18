-- ============================================================================
-- Emlak Teslim Tutanagi Platformu (MVP) — Veri Modeli DDL
-- Hedef: PostgreSQL 16
-- Uretici: architect-agent | Tarih: 2026-08-12 | Tur: 5
-- Kaynak: factory/02-prd/prd.md, factory/03-backlog/backlog.md (T-002)
--
-- GENEL KURALLAR (architecture.md §8):
--  * Tum PK'lar uuid + gen_random_uuid() (tahmin edilebilir artan ID yok).
--  * Tum zaman alanlari timestamptz, sunucu tarafinda DEFAULT now().
--  * Her tabloda created_at; mutasyona ugrayan tablolarda updated_at (trigger).
--  * Para: numeric(12,2). float/double precision para icin YASAK.
--  * Her FK sutununda index vardir.
--  * SOFT DELETE KULLANILMIYOR (tek kural): hicbir tabloda deleted_at yoktur;
--    silme gerekirse hard delete + ON DELETE CASCADE.
--  * Bu dosya calistirilabilir DDL'in tek dogruluk kaynagidir; Prisma semasi
--    bu dosyaya birebir uyar (CLAUDE.md §3.6 — sozlesme onceligi).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Uzantilar
--  citext  : e-posta karsilastirmasi buyuk/kucuk harf duyarsiz olsun diye
--  pg_trgm : T-011 arama (baslik/not icinde gecen terim) icin GIN index
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- Enum tipleri — gecersiz durum degeri yazilmasi imkansiz olsun diye
-- ---------------------------------------------------------------------------

-- Tutanagin yasam dongusu: taslak -> paylasildi -> onaylandi (T-005, T-008, T-010)
CREATE TYPE report_status AS ENUM ('draft', 'shared', 'approved');

-- Abonelik durumu (T-012). GECIS KURALI (architecture.md §8.4 — baglayici tek kural):
--  POST /billing/checkout basarili -> 'pending';
--  webhook succeeded -> 'active' + current_period_end = now() + SUBSCRIPTION_PERIOD_DAYS gun;
--  webhook failed -> 'inactive' + current_period_end NULL;
--  'active' iken gelen failed bildirimi durumu DUSURMEZ.
CREATE TYPE subscription_status AS ENUM ('inactive', 'pending', 'active');

-- Odeme girisiminin sonucu (T-012)
CREATE TYPE payment_status AS ENUM ('initiated', 'succeeded', 'failed');

-- Paylasim kanali (T-008). MVP'de TEK deger: 'email'. Sebep: teslim kaydi yalnizca
-- SUNUCUNUN yaptigi bir gonderim icin yazilir; WhatsApp paylasimi sunucudan gonderim
-- degil, istemcinin actigi bir wa.me URL'sidir (architecture.md §2 "entegrasyon degil,
-- deep link") ve hicbir endpoint bu tabloya 'whatsapp' satiri yazmaz. Kullanilmayan
-- enum degeri bilincli olarak TANIMLANMAZ.
CREATE TYPE share_channel AS ENUM ('email');

-- Gonderim sonucu (T-008 kabul kriteri: "gonderim durumu yanitta belirtilir")
CREATE TYPE delivery_status AS ENUM ('sent', 'failed');

-- ---------------------------------------------------------------------------
-- Ortak trigger fonksiyonlari
-- ---------------------------------------------------------------------------

-- updated_at'i her UPDATE'te sunucu saatiyle tazeler (uygulama koduna guvenilmez).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- T-006 / T-010: sunucu tarafinda uretilen tarih-saat damgasi DEGISTIRILEMEZ.
-- Uygulama katmaninda PATCH endpoint'i zaten tanimli degildir; bu trigger
-- ikinci savunma katmanidir (dogrudan SQL erisimi dahil her yolu kapatir).
CREATE OR REPLACE FUNCTION reject_timestamp_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'immutable column % cannot be modified on table %',
        TG_ARGV[0], TG_TABLE_NAME
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------------
-- users — Urunun odeme yapan/uygulamaya giris yapan kullanicisi
-- (emlak ofisi yoneticisi Selin veya danisman Kaan). MVP tek rol modeli:
-- rol/yetki sutunu YOKTUR (PRD kapsam disi madde 7). T-003.
-- ---------------------------------------------------------------------------
CREATE TABLE users (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email         citext      NOT NULL,
    password_hash text        NOT NULL,  -- bcrypt cost 10; duz metin sifre ASLA saklanmaz
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT users_email_length  CHECK (char_length(email) BETWEEN 3 AND 254),
    CONSTRAINT users_email_format  CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- T-003: ayni e-posta ile ikinci kayit 409 dondurebilsin diye DB seviyesinde tekillik
CREATE UNIQUE INDEX users_email_key ON users (email);

CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- templates — PRD'de sabit 3 hazir emlak sablonu (T-002 seed, T-004 listeleme).
-- MVP'de kullanici sablon olusturamaz/duzenleyemez (PRD kapsam disi madde 4),
-- bu yuzden owner_id yoktur: sablonlar sistem geneli referans verisidir.
-- ---------------------------------------------------------------------------
CREATE TABLE templates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    code        text        NOT NULL,  -- stabil makine adi (seed idempotansi + UI ikonu icin)
    name        text        NOT NULL,  -- PRD'deki ad ile birebir eslesmeli (T-002 kabul kriteri)
    description text        NOT NULL,
    sort_order  smallint    NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT templates_name_not_blank CHECK (btrim(name) <> '')
);

CREATE UNIQUE INDEX templates_code_key ON templates (code);
CREATE UNIQUE INDEX templates_name_key ON templates (name);
CREATE INDEX templates_sort_order_idx ON templates (sort_order);

CREATE TRIGGER templates_set_updated_at
    BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- T-002 kabul kriteri: migration sonrasi TAM OLARAK 3 kayit, adlari birebir.
-- NOT (tek dogruluk kaynagi): asagidaki INSERT blogu REFERANSTIR; calistirilabilir
-- seed `apps/api/prisma/seed.ts` dosyasidir (CLAUDE.md §1) ve degerleri buradan
-- birebir alir. Iki taraf da idempotenttir (ON CONFLICT (code) / upsert).
INSERT INTO templates (code, name, description, sort_order) VALUES
    ('move_in_out',    'Giris/Cikis Teslim Tutanagi',
     'Kiraci giris veya cikis teslimi sirasinda mulkun genel durumunun foto ve notlarla kayit altina alinmasi.', 1),
    ('meter_fixture',  'Sayac/Demirbas Tespiti',
     'Elektrik, su, dogalgaz sayac degerleri ve mulkte birakilan demirbaslarin tespiti.', 2),
    ('periodic_check', 'Periyodik Durum Kontrolu',
     'Kira donemi icinde yapilan periyodik mulk durum kontrolunun belgelenmesi.', 3)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- reports — Tutanak. Urunun cekirdek kaydi: bir kullaniciya (owner) ve bir
-- sablona zorunlu olarak baglidir (T-002 kabul kriteri). Baslik + not burada,
-- fotograflar report_photos'ta, onay approvals'ta tutulur. T-005, T-010, T-011.
-- ---------------------------------------------------------------------------
CREATE TABLE reports (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id    uuid          NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
    template_id uuid          NOT NULL REFERENCES templates(id) ON DELETE RESTRICT,
    title       text          NOT NULL,
    note        text          NOT NULL DEFAULT '',
    status      report_status NOT NULL DEFAULT 'draft',
    created_at  timestamptz   NOT NULL DEFAULT now(),
    updated_at  timestamptz   NOT NULL DEFAULT now(),

    CONSTRAINT reports_title_not_blank CHECK (btrim(title) <> ''),
    CONSTRAINT reports_title_length    CHECK (char_length(title) <= 200),
    CONSTRAINT reports_note_length     CHECK (char_length(note)  <= 5000)
);

-- FK index'leri (kural: her FK'ye index)
CREATE INDEX reports_owner_id_idx    ON reports (owner_id);
CREATE INDEX reports_template_id_idx ON reports (template_id);

-- T-011: kullanicinin kendi listesi, en yeni once
CREATE INDEX reports_owner_created_at_idx ON reports (owner_id, created_at DESC);

-- T-011: baslik/not icinde gecen terim aramasi (ILIKE '%terim%') icin trigram GIN.
-- Postgres'te yerlesik Turkce stemmer olmadigi icin tsvector yerine trigram secildi
-- (bkz. architecture.md §4 Merdiven Kurali).
CREATE INDEX reports_title_trgm_idx ON reports USING gin (title gin_trgm_ops);
CREATE INDEX reports_note_trgm_idx  ON reports USING gin (note  gin_trgm_ops);

CREATE TRIGGER reports_set_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- report_photos — Tutanaga eklenen fotograf. captured_at, sunucu tarafinda
-- uretilen ve DEGISTIRILEMEZ tarih-saat damgasidir (T-006 / PRD kapsam madde 2).
-- Ikili icerik DB'de tutulmaz; obje depolamadaki (R2/MinIO) anahtar saklanir.
-- KANIT BUTUNLUGU (architecture.md §8.1): tutanak 'approved' ise yeni satir eklenmez
-- (API 409 REPORT_ALREADY_APPROVED doner); kural uygulama katmanindadir cunku
-- ilgili durum baska bir tabloda (reports.status) yasar.
-- ---------------------------------------------------------------------------
CREATE TABLE report_photos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id    uuid        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    storage_key  text        NOT NULL,  -- obje depolama anahtari; kullanici dosya adi KULLANILMAZ
    content_type text        NOT NULL,  -- sihirli bayt dogrulamasi sonrasi belirlenen gercek tip
    size_bytes   integer     NOT NULL,
    width_px     integer     NOT NULL,
    height_px    integer     NOT NULL,
    -- Siralama SUNUCUDA atanir: ayni report_id icin mevcut en buyuk + 1 (ilki 0),
    -- ekleme ile ayni transaction icinde. Istemci gonderemez, yeniden siralama
    -- endpoint'i yoktur (architecture.md §8, CLAUDE.md §3.14).
    -- (report_id, sort_order) uzerinde UNIQUE kisit BILINCLI OLARAK YOKTUR: ayni
    -- tutanaga es zamanli iki yukleme ayni degeri alabilir; bu CAKISMA TOLERE
    -- EDILIR cunku siralama her yerde (sort_order, captured_at) ikilisiyle
    -- yapilir ve tie-break captured_at'tir — sonuc yine deterministiktir.
    -- Unique kisit eklemek, es zamanli yuklemede kullaniciya 409 dondurmek
    -- (veya seri hale getirmek) demek olurdu; T-006'da bunun karsiligi yok.
    sort_order   smallint    NOT NULL DEFAULT 0,
    -- Sunucu saatiyle atanan, degistirilemez damga. Istemciden gelen hicbir
    -- tarih degeri okunmaz (T-006 kabul kriteri).
    captured_at  timestamptz NOT NULL DEFAULT now(),
    created_at   timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT report_photos_content_type_allowed
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT report_photos_size_positive   CHECK (size_bytes > 0 AND size_bytes <= 10485760), -- <= 10 MB
    CONSTRAINT report_photos_dimensions_pos  CHECK (width_px > 0 AND height_px > 0)
);

CREATE INDEX report_photos_report_id_idx ON report_photos (report_id);
CREATE INDEX report_photos_report_order_idx ON report_photos (report_id, sort_order, captured_at);
CREATE UNIQUE INDEX report_photos_storage_key_key ON report_photos (storage_key);

-- T-006: damga hicbir yoldan degistirilemez (endpoint yok + DB reddi)
CREATE TRIGGER report_photos_captured_at_immutable
    BEFORE UPDATE OF captured_at ON report_photos
    FOR EACH ROW
    WHEN (OLD.captured_at IS DISTINCT FROM NEW.captured_at)
    EXECUTE FUNCTION reject_timestamp_mutation('captured_at');

-- ---------------------------------------------------------------------------
-- share_links — Tutanak icin kimlik dogrulamasi gerektirmeyen yetenek
-- (capability) linki. Token 32 bayt kriptografik rastgele deger olup
-- T-008 kabul kriteri geregi ikinci istekte AYNI token geri dondurulmelidir;
-- bu yuzden hash degil, degerin kendisi saklanir (bkz. architecture.md §7).
-- Tutanak basina en fazla bir aktif link bulunur.
-- ---------------------------------------------------------------------------
CREATE TABLE share_links (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id  uuid        NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
    token      text        NOT NULL,  -- base64url, 32 bayt entropiden uretilir
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT share_links_token_length CHECK (char_length(token) BETWEEN 32 AND 128)
);

CREATE UNIQUE INDEX share_links_token_key ON share_links (token);
-- Idempotans: ayni tutanak icin ikinci link uretilemez (T-008 kabul kriteri)
CREATE UNIQUE INDEX share_links_report_id_key ON share_links (report_id);

CREATE TRIGGER share_links_set_updated_at
    BEFORE UPDATE ON share_links
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- share_deliveries — Paylasim linkinin karsi tarafa SUNUCUDAN iletim denemesi kaydi.
-- E-posta gonderiminin basarili/basarisiz sonucunu (T-008) denetlenebilir birakir.
-- Satir YALNIZCA POST /reports/{id}/share-link/email cagrisinda yazilir; wa.me URL
-- uretimi bu tabloya satir YAZMAZ (sunucudan gonderim yoktur).
-- ---------------------------------------------------------------------------
CREATE TABLE share_deliveries (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    share_link_id       uuid            NOT NULL REFERENCES share_links(id) ON DELETE CASCADE,
    channel             share_channel   NOT NULL DEFAULT 'email',
    -- Tek kanal 'email' oldugu icin alici adresi HER satirda zorunludur (tautolojik
    -- CHECK yerine dogrudan NOT NULL; kanal cesitlenirse kural yeniden yazilir).
    recipient_email     citext          NOT NULL,
    status              delivery_status NOT NULL,
    provider_message_id text            NULL,  -- e-posta saglayicisinin mesaj kimligi
    error_message       text            NULL,  -- basarisizlik nedeni (saglayici hatasi, ozetlenmis)
    created_at          timestamptz     NOT NULL DEFAULT now(),

    CONSTRAINT share_deliveries_failed_needs_reason
        CHECK (status <> 'failed' OR error_message IS NOT NULL)
);

CREATE INDEX share_deliveries_share_link_id_idx ON share_deliveries (share_link_id);
CREATE INDEX share_deliveries_created_at_idx    ON share_deliveries (created_at DESC);

-- ---------------------------------------------------------------------------
-- approvals — Karsi tarafin (kiraci) tek tikla onayi. Onay; zaman damgasi +
-- e-posta kimligi ile kaydedilir ve PDF'e islenir (T-010). Tutanak basina
-- TEK onay: unique index mukerrer onayi DB seviyesinde imkansiz kilar.
-- ---------------------------------------------------------------------------
CREATE TABLE approvals (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id      uuid        NOT NULL REFERENCES reports(id)      ON DELETE CASCADE,
    share_link_id  uuid        NOT NULL REFERENCES share_links(id)  ON DELETE CASCADE,
    approver_email citext      NOT NULL,
    -- Sunucu saatiyle atanan, degistirilemez onay damgasi
    approved_at    timestamptz NOT NULL DEFAULT now(),
    ip_address     inet        NULL,  -- delil degeri: onayin geldigi ag adresi
    user_agent     text        NULL,
    created_at     timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT approvals_email_format
        CHECK (approver_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')
);

-- T-010: ayni tutanak icin ikinci onay kaydi olusamaz
CREATE UNIQUE INDEX approvals_report_id_key   ON approvals (report_id);
CREATE INDEX        approvals_share_link_idx  ON approvals (share_link_id);

CREATE TRIGGER approvals_approved_at_immutable
    BEFORE UPDATE OF approved_at ON approvals
    FOR EACH ROW
    WHEN (OLD.approved_at IS DISTINCT FROM NEW.approved_at)
    EXECUTE FUNCTION reject_timestamp_mutation('approved_at');

-- ---------------------------------------------------------------------------
-- subscriptions — Kullanicinin aylik abonelik durumu (T-012). Kullanici basina
-- TEK satir; odeme girisimleri ayri tabloda tutulur. Fiyat PRD'de acik soru
-- oldugu icin yapilandirilabilir tutulur (kesin tutar burada sabitlenmez):
-- price_amount, SUBSCRIPTION_PRICE_AMOUNT yapilandirmasindan yazilir.
-- YASAM DONGUSU (architecture.md §8.3): satir kayit sirasinda OLUSMAZ; yalnizca
-- POST /billing/checkout icinde user_id unique kisitina dayali get-or-create ile
-- olusur. GET /me satir yoksa varsayilan 'inactive' nesnesini doner, satir yazmaz.
-- DURUM GECISI (architecture.md §8.4 — baglayici tek kural): checkout basarili ->
-- 'pending'; webhook succeeded -> 'active'; webhook failed -> 'inactive'.
-- ---------------------------------------------------------------------------
CREATE TABLE subscriptions (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid                NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status              subscription_status NOT NULL DEFAULT 'inactive',
    price_amount        numeric(12,2)       NULL,   -- PARA: numeric — float YASAK
    currency            char(3)             NOT NULL DEFAULT 'TRY',
    -- Aktif donemin bitisi. KAYNAK (architecture.md §8.4): saglayici bildiriminde
    -- donem bilgisi YOKTUR; deger webhook 'succeeded' islenirken sunucuda
    -- now() + SUBSCRIPTION_PERIOD_DAYS gun olarak hesaplanir (CLAUDE.md §5.1).
    -- 'failed' bildiriminde NULL birakilir. Kod icine gomulu gun sayisi YASAK.
    current_period_end  timestamptz         NULL,
    -- Deger DB varsayilanindan degil, PAYMENT_PROVIDER yapilandirmasindan yazilir
    -- (CLAUDE.md §5.1): yerel/testte 'fake', uretimde 'iyzico'. Varsayilan bilincli
    -- olarak YOKTUR ki sahte adapter'la dogan satir 'iyzico' diye etiketlenmesin.
    provider            text                NOT NULL,
    -- NOT: 'provider_customer_ref' sutunu tur 5'te KALDIRILDI — hicbir normatif
    -- kuralda yazani/okuyani yoktu ve sozlesmede karsiligi yok (YAGNI). Ihtiyac
    -- dogarsa (ornegin saglayici tarafinda tekrarlayan abonelik) ayri ticket ile eklenir.
    created_at          timestamptz         NOT NULL DEFAULT now(),
    updated_at          timestamptz         NOT NULL DEFAULT now(),

    CONSTRAINT subscriptions_price_non_negative CHECK (price_amount IS NULL OR price_amount >= 0),
    CONSTRAINT subscriptions_active_needs_period
        CHECK (status <> 'active' OR current_period_end IS NOT NULL)
);

CREATE UNIQUE INDEX subscriptions_user_id_key ON subscriptions (user_id);
CREATE INDEX subscriptions_status_idx ON subscriptions (status);

CREATE TRIGGER subscriptions_set_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- payment_transactions — Her odeme girisiminin denetlenebilir kaydi (T-012).
-- YASAM DONGUSU (architecture.md §8.5 / CLAUDE.md §3.13 — baglayici tek kural):
-- satir POST /billing/checkout icinde dogar (status='initiated', processed_at NULL);
-- webhook YENI SATIR YAZMAZ, satiri provider_reference ile bulur ve yalnizca
--   UPDATE ... WHERE provider_reference = $1 AND processed_at IS NULL
-- kosuluyla isler. IDEMPOTANSIN MEKANIZMASI: provider_ref unique index yalnizca
-- referansin TEKILLIGINI garanti eder; tekrarlanan bildirimin ikinci kez
-- islenmesini engelleyen sey processed_at IS NULL kosuludur (etkilenen satir 0
-- ise abonelik alanlarina dokunulmaz, API yine 200 doner).
-- ---------------------------------------------------------------------------
CREATE TABLE payment_transactions (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id    uuid           NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    provider_reference text           NOT NULL,  -- saglayicinin islem kimligi (idempotans anahtari)
    status             payment_status NOT NULL DEFAULT 'initiated',
    amount             numeric(12,2)  NOT NULL,  -- PARA: numeric — float YASAK
    currency           char(3)        NOT NULL DEFAULT 'TRY',
    failure_reason     text           NULL,      -- reddedilen odemede saglayicinin gerekcesi
    -- IDEMPOTANS DAMGASI: NULL = bildirim henuz islenmedi. Webhook yalnizca
    -- NULL iken gunceller ve bu alani now() ile doldurur (architecture.md §8.5).
    processed_at       timestamptz    NULL,
    created_at         timestamptz    NOT NULL DEFAULT now(),
    updated_at         timestamptz    NOT NULL DEFAULT now(),

    CONSTRAINT payment_transactions_amount_positive CHECK (amount > 0),
    CONSTRAINT payment_transactions_failed_needs_reason
        CHECK (status <> 'failed' OR failure_reason IS NOT NULL)
);

CREATE INDEX        payment_transactions_subscription_id_idx ON payment_transactions (subscription_id);
CREATE UNIQUE INDEX payment_transactions_provider_ref_key    ON payment_transactions (provider_reference);
CREATE INDEX        payment_transactions_created_at_idx      ON payment_transactions (created_at DESC);

CREATE TRIGGER payment_transactions_set_updated_at
    BEFORE UPDATE ON payment_transactions
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;

-- ============================================================================
-- ROLLBACK (T-002 kabul kriteri: down/rollback tum tablolari kaldirir)
-- Prisma Migrate kendi down stratejisini uretir; asagidaki blok referanstir.
-- ----------------------------------------------------------------------------
-- BEGIN;
-- DROP TABLE IF EXISTS payment_transactions;
-- DROP TABLE IF EXISTS subscriptions;
-- DROP TABLE IF EXISTS approvals;
-- DROP TABLE IF EXISTS share_deliveries;
-- DROP TABLE IF EXISTS share_links;
-- DROP TABLE IF EXISTS report_photos;
-- DROP TABLE IF EXISTS reports;
-- DROP TABLE IF EXISTS templates;
-- DROP TABLE IF EXISTS users;
-- DROP FUNCTION IF EXISTS reject_timestamp_mutation();
-- DROP FUNCTION IF EXISTS set_updated_at();
-- DROP TYPE IF EXISTS delivery_status;
-- DROP TYPE IF EXISTS share_channel;
-- DROP TYPE IF EXISTS payment_status;
-- DROP TYPE IF EXISTS subscription_status;
-- DROP TYPE IF EXISTS report_status;
-- COMMIT;
-- ============================================================================
