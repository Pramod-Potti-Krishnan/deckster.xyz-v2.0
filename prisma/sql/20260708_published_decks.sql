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
  "view_count" INTEGER NOT NULL DEFAULT 0,
  "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "republished_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "fe_published_decks_user_id_idx" ON "fe_published_decks"("user_id");
