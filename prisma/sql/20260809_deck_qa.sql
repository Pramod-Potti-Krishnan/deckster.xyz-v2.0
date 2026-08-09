-- Rung 1 — grounded Q&A on published decks.
--
-- Applied via: Supabase SQL editor (or `npx prisma db execute --file
--   prisma/sql/20260809_deck_qa.sql --schema prisma/schema.prisma`).
-- NEVER `prisma db push` / `prisma migrate` — those reconcile the database to
-- schema.prisma and can DROP columns added manually in Supabase.
-- Run `npx prisma generate` after editing schema.prisma.
--
-- Additive and idempotent throughout: every statement is IF NOT EXISTS, so it is
-- safe to re-run and safe on a database that already has some of it.
-- Requires: 20260708_published_decks.sql already applied.

-- ---------------------------------------------------------------------------
-- 1. Q&A settings + corpus bookkeeping on the published deck
-- ---------------------------------------------------------------------------
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "researcher_session_id" TEXT;
-- Off by default: a public LLM endpoint on someone's client deck must be a
-- deliberate act, never a side effect of publishing.
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_enabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_corpus_status" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_corpus_version" INTEGER;
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_daily_cap" INTEGER NOT NULL DEFAULT 50;
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_monthly_cap" INTEGER NOT NULL DEFAULT 500;
-- Tone is STYLE ONLY. Enforced structurally in Researcher (stage 1 grounds with
-- the tone absent from its context), so no value here can move the refusal
-- threshold.
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_tone_preset" TEXT NOT NULL DEFAULT 'professional';
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_tone_instruction" TEXT;
-- Whether PUBLIC web sources may be named to viewers. Deck slides always are;
-- private uploads and internal research NEVER are.
ALTER TABLE "fe_published_decks" ADD COLUMN IF NOT EXISTS "qa_cite_web_sources" BOOLEAN NOT NULL DEFAULT true;

-- Backfill the explicit Researcher join key for decks published before this.
-- Safe: today ChatSession.id IS the Researcher session_id.
UPDATE "fe_published_decks"
   SET "researcher_session_id" = "session_id"
 WHERE "researcher_session_id" IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Questions — PRIVATE. No public read path; the API is the only reader.
--    Every public read is scoped by asker_token_hash, never by
--    published_deck_id alone: a deck sent to five clients must never let one
--    see another's questions.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fe_deck_questions" (
  "id" TEXT PRIMARY KEY,
  "published_deck_id" TEXT NOT NULL REFERENCES "fe_published_decks"("id") ON DELETE CASCADE,
  -- HMAC-SHA256 of the follow-up token; the raw token lives only in the asker's
  -- browser and return link, so a database read grants access to no thread.
  "asker_token_hash" TEXT NOT NULL UNIQUE,
  -- HMAC-SHA256(ip) keyed with the app secret: rate limiting only, never
  -- displayed. Keyed, not a bare digest — the IPv4 space is small enough to
  -- enumerate, so an unkeyed hash of an IP would be reversible.
  "asker_ip_hash" TEXT NOT NULL,
  "asker_email" TEXT,
  "asker_name" TEXT,
  "question" TEXT NOT NULL,
  "deck_version" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL DEFAULT 'deferred',
  "gate_reason" TEXT,
  "ai_answer" TEXT,
  -- The FULL, tier-blind citation set. Owner and audit see everything; only the
  -- viewer-facing projection is filtered.
  "ai_citations" JSONB,
  "confidence" DOUBLE PRECISION,
  "retrieval_top" DOUBLE PRECISION,
  "model_used" TEXT,
  "tokens_in" INTEGER,
  "tokens_out" INTEGER,
  "cost_cents" INTEGER,
  "owner_answer" TEXT,
  "owner_answered_at" TIMESTAMP(3),
  "owner_read_at" TIMESTAMP(3),
  "asker_seen_at" TIMESTAMP(3),
  -- Forward fields for rungs 3–4. Nullable, written by nobody in rung 1; added
  -- now so a later rung needs no migration against a table that by then holds
  -- production question history.
  "channel" TEXT DEFAULT 'text',
  "spoken" BOOLEAN DEFAULT false,
  "answer_audio_url" TEXT,
  "narration_session_id" TEXT,
  "live_session_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fe_deck_questions_deck_created_idx"
  ON "fe_deck_questions"("published_deck_id","created_at");
CREATE INDEX IF NOT EXISTS "fe_deck_questions_deck_status_idx"
  ON "fe_deck_questions"("published_deck_id","status");
CREATE INDEX IF NOT EXISTS "fe_deck_questions_ip_created_idx"
  ON "fe_deck_questions"("asker_ip_hash","created_at");

-- ---------------------------------------------------------------------------
-- 3. FAQ — the only text on a published deck carrying the publisher's name,
--    because a human approved it. AI answers never do.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fe_deck_faq_items" (
  "id" TEXT PRIMARY KEY,
  "published_deck_id" TEXT NOT NULL REFERENCES "fe_published_decks"("id") ON DELETE CASCADE,
  "source_question_id" TEXT UNIQUE REFERENCES "fe_deck_questions"("id") ON DELETE SET NULL,
  "question" TEXT NOT NULL,
  "answer" TEXT NOT NULL,
  -- Redacted INTERNAL citation shape (see redactCitationsForStorage): deck and
  -- public-web entries keep their data; private ones are a bare marker with no
  -- filename, page or quote. Never the viewer projection — the read path
  -- filters again, and a projected shape would type-confuse it.
  "citations" JSONB,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "published" BOOLEAN NOT NULL DEFAULT true,
  -- Denormalised so the public byline survives a later profile rename.
  "approved_by_name" TEXT NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "fe_deck_faq_items_deck_pub_order_idx"
  ON "fe_deck_faq_items"("published_deck_id","published","sort_order");

-- ---------------------------------------------------------------------------
-- 4. Per-document Q&A allowlist — publish's OWN decision.
--    Deliberately in the publish schema, NOT knowledge/KG: the two are owned by
--    different teams and must not collide. Keys on
--    published_qa_chunks.source_ref; no Researcher table is touched.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "fe_published_deck_sources" (
  "id" TEXT PRIMARY KEY,
  "published_deck_id" TEXT NOT NULL REFERENCES "fe_published_decks"("id") ON DELETE CASCADE,
  "source_ref" TEXT NOT NULL,
  -- 'deck' | 'web' | 'document' | 'research'
  "source_kind" TEXT NOT NULL,
  -- Owner-facing label only. NEVER serialised to /p/{slug}.
  "source_label" TEXT,
  "chunk_count" INTEGER NOT NULL DEFAULT 0,
  -- Defaults applied per KIND at freeze time (deck/web allow, uploads deny,
  -- research inherits its parent), not by this column default.
  "allowed_for_qa" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("published_deck_id", "source_ref")
);
CREATE INDEX IF NOT EXISTS "fe_published_deck_sources_deck_allowed_idx"
  ON "fe_published_deck_sources"("published_deck_id","allowed_for_qa");
