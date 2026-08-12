-- T-002 kabul kriteri 4: geri alma (rollback) — migration'in olusturdugu TUM tablolar,
-- tipler ve fonksiyonlar kaldirilir. Calistirma: `npm run migrate:down --workspace @tutanak/api`
-- (prisma db execute). Prisma Migrate down migration uretmedigi icin bu dosya elle tutulur;
-- kaynak: factory/04-architecture/data-model.sql ROLLBACK blogu.
-- Trigger'lar tablolariyla birlikte dusar; fonksiyonlar ve enum tipleri ayrica birakilmaz.

DROP TABLE IF EXISTS "payment_transactions";
DROP TABLE IF EXISTS "subscriptions";
DROP TABLE IF EXISTS "approvals";
DROP TABLE IF EXISTS "share_deliveries";
DROP TABLE IF EXISTS "share_links";
DROP TABLE IF EXISTS "report_photos";
DROP TABLE IF EXISTS "reports";
DROP TABLE IF EXISTS "templates";
DROP TABLE IF EXISTS "users";

DROP FUNCTION IF EXISTS reject_timestamp_mutation();
DROP FUNCTION IF EXISTS set_updated_at();

DROP TYPE IF EXISTS "delivery_status";
DROP TYPE IF EXISTS "share_channel";
DROP TYPE IF EXISTS "payment_status";
DROP TYPE IF EXISTS "subscription_status";
DROP TYPE IF EXISTS "report_status";

-- Migration gecmisi de silinir ki geri alinan veritabaninda `migrate deploy` bastan kosabilsin.
DROP TABLE IF EXISTS "_prisma_migrations";
