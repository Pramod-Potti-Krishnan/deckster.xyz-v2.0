-- Deck Q&A: owner-adjustable per-visitor rate limits.
--
-- Before this, the per-IP throttle was a hard-coded constant (5 questions per
-- 10 minutes) applied to every published deck. Two problems, both real:
--
--   1. A deck presented at a live event and a quiet client deck want very
--      different numbers, and only the owner knows which they have.
--   2. The owner testing their own deck hit the anonymous-visitor limiter and
--      locked themselves out of their own feature after five questions.
--
-- (2) is fixed in code — the signed-in owner of the deck is exempt from the
-- per-visitor limits, verified server-side against fe_published_decks.user_id.
-- (1) is these two columns.
--
-- The per-DECK caps (qa_daily_cap / qa_monthly_cap) are unchanged and still
-- apply to everyone including the owner: those are the spend ceiling. These new
-- columns only decide how much of that ceiling ONE client may take.
--
-- Additive only. No column is dropped, renamed, or retyped, and every existing
-- row lands on the new defaults.

ALTER TABLE fe_published_decks
  ADD COLUMN IF NOT EXISTS qa_visitor_burst_limit INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS qa_visitor_daily_limit INTEGER NOT NULL DEFAULT 40;

COMMENT ON COLUMN fe_published_decks.qa_visitor_burst_limit IS
  'Max questions ONE visitor may ask in a 5-minute window. Owner-adjustable. The deck owner is exempt.';
COMMENT ON COLUMN fe_published_decks.qa_visitor_daily_limit IS
  'Max questions ONE visitor may ask in a UTC day. Owner-adjustable. The deck owner is exempt.';

-- Verify:
--   SELECT column_name, data_type, column_default, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'fe_published_decks'
--      AND column_name IN ('qa_visitor_burst_limit', 'qa_visitor_daily_limit');
-- Expect two rows, integer, defaults 10 and 40, NOT NULL.
