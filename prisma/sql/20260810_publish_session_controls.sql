-- Publish: the master switches and the session's time budget.
--
-- TABLE NAME: `fe_published_decks`. Every frontend table carries the `fe_`
-- prefix; the Prisma model name is not the table name (@@map). Getting this
-- wrong once already cost a live bug — see 20260810_narration_voice.sql.
--
-- qa_auto_answer   ON  = the machine answers what it can and defers the rest
--                        (the behaviour that shipped first, hence the default)
--                  OFF = nothing is answered automatically; every question
--                        waits for the owner
--
-- narration_*      The deck speaking its own script. Off by default for the
--                  same reason Q&A is: publishing must never silently attach
--                  generated speech to someone's client deck.
--
-- narration_budget_minutes and qa_reserve_minutes are NULLABLE on purpose:
--   budget  NULL = no slot set, so the script runs to its natural length
--   reserve NULL = not chosen, so derive it (a fifth of the budget)
-- Defaulting either to 0 would mean "a deck budgeted at zero minutes" and
-- "no time at all for questions", which are decisions nobody made.
--
-- Additive only. No column is dropped, renamed or retyped.

ALTER TABLE fe_published_decks
  ADD COLUMN IF NOT EXISTS qa_auto_answer BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS narration_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS narration_budget_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS qa_reserve_minutes INTEGER;

COMMENT ON COLUMN fe_published_decks.qa_auto_answer IS
  'OFF routes every viewer question to the owner instead of answering it.';
COMMENT ON COLUMN fe_published_decks.narration_enabled IS
  'Whether this published deck speaks its own script.';
COMMENT ON COLUMN fe_published_decks.narration_budget_minutes IS
  'The session slot in minutes. NULL = no budget; script runs to natural length.';
COMMENT ON COLUMN fe_published_decks.qa_reserve_minutes IS
  'Minutes held back for questions. NULL = derive (20% of the budget).';

-- Verify: expect 4 rows.
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'fe_published_decks'
--      AND column_name IN ('qa_auto_answer','narration_enabled',
--                          'narration_budget_minutes','qa_reserve_minutes');
