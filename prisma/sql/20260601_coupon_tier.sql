-- Plan-aware coupons: add tier to fe_coupons
-- Applied via: npx prisma db execute --file prisma/sql/20260601_coupon_tier.sql --schema prisma/schema.prisma

ALTER TABLE "fe_coupons" ADD COLUMN IF NOT EXISTS "tier" TEXT NOT NULL DEFAULT 'starter';
