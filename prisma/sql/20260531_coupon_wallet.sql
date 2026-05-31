-- Coupon authorization + credit wallet schema
-- Applied via: npx prisma db execute --file prisma/sql/20260531_coupon_wallet.sql --schema prisma/schema.prisma

ALTER TABLE "auth_users" ADD COLUMN IF NOT EXISTS "wallet_balance_cents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS "fe_coupons" (
  "id" TEXT PRIMARY KEY,
  "code" TEXT NOT NULL UNIQUE,
  "value_cents" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'usd',
  "max_redemptions" INTEGER,
  "times_redeemed" INTEGER NOT NULL DEFAULT 0,
  "per_user_limit" INTEGER NOT NULL DEFAULT 1,
  "expires_at" TIMESTAMP(3),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "note" TEXT,
  "created_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fe_coupons_active_idx" ON "fe_coupons"("active");

CREATE TABLE IF NOT EXISTS "fe_coupon_redemptions" (
  "id" TEXT PRIMARY KEY,
  "coupon_id" TEXT NOT NULL REFERENCES "fe_coupons"("id") ON DELETE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "amount_cents" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS "fe_coupon_redemptions_coupon_user_key"
  ON "fe_coupon_redemptions"("coupon_id","user_id");
CREATE INDEX IF NOT EXISTS "fe_coupon_redemptions_user_idx" ON "fe_coupon_redemptions"("user_id");

CREATE TABLE IF NOT EXISTS "fe_wallet_transactions" (
  "id" TEXT PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "type" TEXT NOT NULL,
  "amount_cents" INTEGER NOT NULL,
  "reason" TEXT NOT NULL,
  "balance_after_cents" INTEGER NOT NULL,
  "source_ref" TEXT UNIQUE,
  "metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fe_wallet_transactions_user_idx" ON "fe_wallet_transactions"("user_id");
CREATE INDEX IF NOT EXISTS "fe_wallet_transactions_reason_idx" ON "fe_wallet_transactions"("reason");
