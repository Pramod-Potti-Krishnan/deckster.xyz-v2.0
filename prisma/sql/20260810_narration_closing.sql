-- Narration: the closing segment.
--
-- TABLE: fe_published_decks (the `fe_` prefix — see 20260810_narration_voice.sql
-- for what happens when that is forgotten).
--
-- The closing exists so a session that runs out of time still ENDS. Its words
-- are written to make sense from any point in the deck: "that's the core of it,
-- the detail is in the deck, and I'm happy to take questions" works after slide
-- 4 or slide 20. "And finally..." does not, which is why this is a separate
-- script rather than the last slide's.
--
-- Its duration is reserved in every budget calculation, so the deck can be
-- consumed to zero but never past the point where there is no ending.
--
-- Additive only.

ALTER TABLE fe_published_decks
  ADD COLUMN IF NOT EXISTS narration_closing_script TEXT;

COMMENT ON COLUMN fe_published_decks.narration_closing_script IS
  'The closing segment. Written to make sense from ANY point, so a session cut short still ends rather than stopping.';
