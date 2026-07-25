-- Published decks — public snapshot links served at deckster.xyz/p/{slug}
-- Applied via: npx prisma db execute --file prisma/sql/20260708_published_decks.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "fe_published_decks" (
  "id" TEXT PRIMARY KEY,
  "slug" TEXT NOT NULL UNIQUE,
  "user_id" TEXT NOT NULL REFERENCES "auth_users"("id") ON DELETE CASCADE,
  "session_id" TEXT NOT NULL UNIQUE REFERENCES "fe_chat_sessions"("id") ON DELETE CASCADE,
  "source_presentation_id" TEXT NOT NULL,
  "snapshot_presentation_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "slide_count" INTEGER NOT NULL,
  "visibility" TEXT NOT NULL DEFAULT 'unlisted',
  "passcode_hash" TEXT,
  "allow_pdf" BOOLEAN NOT NULL DEFAULT true,
  "allow_pptx" BOOLEAN NOT NULL DEFAULT true,
  -- The SOURCE deck's Layout `updated_at` at the last publish/republish/rotate.
  -- Exact staleness signal: differs from the live deck's current updated_at =>
  -- the frozen copy viewers see is out of date. NULL = couldn't be read.
  "source_updated_at" TEXT,
  -- Snapshot ids whose Layout-side delete failed; retried on the next
  -- publish/rotate/unpublish so revocation isn't silently lost.
  "stale_snapshot_ids" TEXT[] NOT NULL DEFAULT '{}',
  -- Optimistic-concurrency token: publish/rotate/unpublish CAS on this so
  -- concurrent lifecycle ops can't lose stale ids or orphan snapshots.
  "version" INTEGER NOT NULL DEFAULT 0,
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "republished_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3)
);

-- Idempotent column adds so this single file upgrades a table created by an
-- earlier version of this migration (which lacked these columns): CREATE TABLE
-- IF NOT EXISTS is skipped on a pre-existing table, so the columns above would
-- never be added without these. No-ops when the column already exists.
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "stale_snapshot_ids" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "source_updated_at" TEXT;

CREATE INDEX IF NOT EXISTS "fe_published_decks_user_id_idx" ON "fe_published_decks"("user_id");
