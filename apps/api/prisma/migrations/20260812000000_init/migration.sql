-- T-002 — Baslangic semasi. Kaynak: factory/04-architecture/data-model.sql (tek dogruluk
-- kaynagi). Tablo/sutun/index tanimlari `prisma migrate diff` ciktisiyla birebir ayni;
-- Prisma'nin ifade edemedigi uzanti, CHECK kisiti ve trigger tanimlari DDL'den alinmistir.

-- Uzantilar: citext (buyuk/kucuk harf duyarsiz e-posta), pg_trgm (T-011 arama)
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateEnum
CREATE TYPE "report_status" AS ENUM ('draft', 'shared', 'approved');

-- CreateEnum
CREATE TYPE "subscription_status" AS ENUM ('inactive', 'pending', 'active');

-- CreateEnum
CREATE TYPE "payment_status" AS ENUM ('initiated', 'succeeded', 'failed');

-- CreateEnum
CREATE TYPE "share_channel" AS ENUM ('email');

-- CreateEnum
CREATE TYPE "delivery_status" AS ENUM ('sent', 'failed');

-- updated_at'i her UPDATE'te sunucu saatiyle tazeler (uygulama koduna guvenilmez).
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- T-006 / T-010: sunucu tarafinda uretilen tarih-saat damgasi DEGISTIRILEMEZ.
CREATE OR REPLACE FUNCTION reject_timestamp_mutation()
RETURNS trigger AS $$
BEGIN
    RAISE EXCEPTION 'immutable column % cannot be modified on table %',
        TG_ARGV[0], TG_TABLE_NAME
        USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "users"
    ADD CONSTRAINT "users_email_length" CHECK (char_length("email") BETWEEN 3 AND 254),
    ADD CONSTRAINT "users_email_format" CHECK ("email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" SMALLINT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "templates"
    ADD CONSTRAINT "templates_name_not_blank" CHECK (btrim("name") <> '');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "status" "report_status" NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "reports"
    ADD CONSTRAINT "reports_title_not_blank" CHECK (btrim("title") <> ''),
    ADD CONSTRAINT "reports_title_length"    CHECK (char_length("title") <= 200),
    ADD CONSTRAINT "reports_note_length"     CHECK (char_length("note") <= 5000);

-- CreateTable
CREATE TABLE "report_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "content_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "width_px" INTEGER NOT NULL,
    "height_px" INTEGER NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "captured_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_photos_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "report_photos"
    ADD CONSTRAINT "report_photos_content_type_allowed"
        CHECK ("content_type" IN ('image/jpeg', 'image/png', 'image/webp')),
    ADD CONSTRAINT "report_photos_size_positive"
        CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
    ADD CONSTRAINT "report_photos_dimensions_pos"
        CHECK ("width_px" > 0 AND "height_px" > 0);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "share_links"
    ADD CONSTRAINT "share_links_token_length" CHECK (char_length("token") BETWEEN 32 AND 128);

-- CreateTable
CREATE TABLE "share_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "share_link_id" UUID NOT NULL,
    "channel" "share_channel" NOT NULL DEFAULT 'email',
    "recipient_email" CITEXT NOT NULL,
    "status" "delivery_status" NOT NULL,
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_deliveries_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "share_deliveries"
    ADD CONSTRAINT "share_deliveries_failed_needs_reason"
        CHECK ("status" <> 'failed' OR "error_message" IS NOT NULL);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "report_id" UUID NOT NULL,
    "share_link_id" UUID NOT NULL,
    "approver_email" CITEXT NOT NULL,
    "approved_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ip_address" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "approvals"
    ADD CONSTRAINT "approvals_email_format"
        CHECK ("approver_email" ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$');

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "status" "subscription_status" NOT NULL DEFAULT 'inactive',
    "price_amount" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "current_period_end" TIMESTAMPTZ(6),
    "provider" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "subscriptions"
    ADD CONSTRAINT "subscriptions_price_non_negative"
        CHECK ("price_amount" IS NULL OR "price_amount" >= 0),
    ADD CONSTRAINT "subscriptions_active_needs_period"
        CHECK ("status" <> 'active' OR "current_period_end" IS NOT NULL);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subscription_id" UUID NOT NULL,
    "provider_reference" TEXT NOT NULL,
    "status" "payment_status" NOT NULL DEFAULT 'initiated',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'TRY',
    "failure_reason" TEXT,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "payment_transactions"
    ADD CONSTRAINT "payment_transactions_amount_positive" CHECK ("amount" > 0),
    ADD CONSTRAINT "payment_transactions_failed_needs_reason"
        CHECK ("status" <> 'failed' OR "failure_reason" IS NOT NULL);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "templates_sort_order_idx" ON "templates"("sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "templates_code_key" ON "templates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "templates_name_key" ON "templates"("name");

-- CreateIndex
CREATE INDEX "reports_owner_id_idx" ON "reports"("owner_id");

-- CreateIndex
CREATE INDEX "reports_template_id_idx" ON "reports"("template_id");

-- CreateIndex
CREATE INDEX "reports_owner_created_at_idx" ON "reports"("owner_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "reports_title_trgm_idx" ON "reports" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "reports_note_trgm_idx" ON "reports" USING GIN ("note" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "report_photos_report_id_idx" ON "report_photos"("report_id");

-- CreateIndex
CREATE INDEX "report_photos_report_order_idx" ON "report_photos"("report_id", "sort_order", "captured_at");

-- CreateIndex
CREATE UNIQUE INDEX "report_photos_storage_key_key" ON "report_photos"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_report_id_key" ON "share_links"("report_id");

-- CreateIndex
CREATE INDEX "share_deliveries_share_link_id_idx" ON "share_deliveries"("share_link_id");

-- CreateIndex
CREATE INDEX "share_deliveries_created_at_idx" ON "share_deliveries"("created_at" DESC);

-- CreateIndex
CREATE INDEX "approvals_share_link_idx" ON "approvals"("share_link_id");

-- CreateIndex
CREATE UNIQUE INDEX "approvals_report_id_key" ON "approvals"("report_id");

-- CreateIndex
CREATE INDEX "subscriptions_status_idx" ON "subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");

-- CreateIndex
CREATE INDEX "payment_transactions_subscription_id_idx" ON "payment_transactions"("subscription_id");

-- CreateIndex
CREATE INDEX "payment_transactions_created_at_idx" ON "payment_transactions"("created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "payment_transactions_provider_ref_key" ON "payment_transactions"("provider_reference");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_photos" ADD CONSTRAINT "report_photos_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_deliveries" ADD CONSTRAINT "share_deliveries_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_share_link_id_fkey" FOREIGN KEY ("share_link_id") REFERENCES "share_links"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTrigger — updated_at tazeleme
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON "users"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER templates_set_updated_at
    BEFORE UPDATE ON "templates"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER reports_set_updated_at
    BEFORE UPDATE ON "reports"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER share_links_set_updated_at
    BEFORE UPDATE ON "share_links"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER subscriptions_set_updated_at
    BEFORE UPDATE ON "subscriptions"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER payment_transactions_set_updated_at
    BEFORE UPDATE ON "payment_transactions"
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- CreateTrigger — degistirilemez zaman damgalari (T-006 / T-010)
CREATE TRIGGER report_photos_captured_at_immutable
    BEFORE UPDATE OF captured_at ON "report_photos"
    FOR EACH ROW
    WHEN (OLD.captured_at IS DISTINCT FROM NEW.captured_at)
    EXECUTE FUNCTION reject_timestamp_mutation('captured_at');

CREATE TRIGGER approvals_approved_at_immutable
    BEFORE UPDATE OF approved_at ON "approvals"
    FOR EACH ROW
    WHEN (OLD.approved_at IS DISTINCT FROM NEW.approved_at)
    EXECUTE FUNCTION reject_timestamp_mutation('approved_at');

-- Seed — PRD'de tanimli 3 sabit sablon (T-002 kabul kriteri). Idempotenttir; ayni
-- degerler `prisma/seed.ts` icinde upsert ile de yazilir (data-model.sql: "Iki taraf da
-- idempotenttir"), boylece hem yalin `migrate deploy` hem de seed adimi 3 kaydi garanti eder.
INSERT INTO "templates" ("code", "name", "description", "sort_order") VALUES
    ('move_in_out',    'Giris/Cikis Teslim Tutanagi',
     'Kiraci giris veya cikis teslimi sirasinda mulkun genel durumunun foto ve notlarla kayit altina alinmasi.', 1),
    ('meter_fixture',  'Sayac/Demirbas Tespiti',
     'Elektrik, su, dogalgaz sayac degerleri ve mulkte birakilan demirbaslarin tespiti.', 2),
    ('periodic_check', 'Periyodik Durum Kontrolu',
     'Kira donemi icinde yapilan periyodik mulk durum kontrolunun belgelenmesi.', 3)
ON CONFLICT ("code") DO NOTHING;
