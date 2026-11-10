-- Narration: the voice a deck is spoken in.
--
-- TABLE NAME: `fe_chat_sessions`, not `chat_sessions`. Every frontend table in
-- this database carries the `fe_` prefix (fe_published_decks, fe_deck_questions,
-- fe_uploaded_files, ...) and the Prisma model name is NOT the table name — the
-- mapping is `model ChatSession { ... @@map("fe_chat_sessions") }`. An earlier
-- version of this file got that wrong and failed with 42P01.
--
-- Stores OUR voice id (lib/narration/voices.ts), never the vendor's model or
-- voice string. The model behind a voice is an implementation detail we expect
-- to change — a cheaper vendor, a faster one, a deprecated preview — and a
-- deck's choice has to survive that. Storing "alloy" survives; storing
-- "fish-audio/s2.1-pro" does not.
--
-- Nullable rather than defaulted, so "never chose" stays distinguishable from
-- "chose the default". The two want different UI: one shows a prompt, the
-- other shows a selection.
--
-- Additive only. No column is dropped, renamed or retyped.

ALTER TABLE fe_chat_sessions
  ADD COLUMN IF NOT EXISTS narration_voice_id TEXT;

COMMENT ON COLUMN fe_chat_sessions.narration_voice_id IS
  'Narration voice id from lib/narration/voices.ts (our id, not the vendor''s). NULL = default voice.';

-- Verify:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'fe_chat_sessions' AND column_name = 'narration_voice_id';
-- Expect one row: narration_voice_id | text | YES
