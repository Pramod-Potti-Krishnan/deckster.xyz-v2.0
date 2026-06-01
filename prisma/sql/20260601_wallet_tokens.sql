-- Token quota: exact per-row token counts + fast windowed usage sums.
-- Applied via: npx prisma db execute --file prisma/sql/20260601_wallet_tokens.sql --schema prisma/schema.prisma

ALTER TABLE "fe_wallet_transactions" ADD COLUMN IF NOT EXISTS "tokens" INTEGER;

-- Supports getQuotaStatus: SUM over (user_id, reason='token_usage', created_at >= window).
CREATE INDEX IF NOT EXISTS "idx_fe_wallet_tx_user_reason_created"
  ON "fe_wallet_transactions" ("user_id", "reason", "created_at");
