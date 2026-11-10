-- Narration: the rendered-audio ledger.
--
-- TABLE NAME: `fe_media_segments` — every frontend table carries the `fe_`
-- prefix (see 20260810_narration_voice.sql for what happens when it doesn't).
--
-- This table is what makes narration affordable. Audio is rendered per SLIDE
-- and per VARIANT, never per deck, and each row is content-addressed:
--
--   script_hash      sha256 of the exact words spoken
--   render_spec_hash sha256 of voice id + model + provider voice + format
--
-- Edit slide 7's script and exactly one hash changes, so exactly one segment
-- re-renders and the other nineteen are untouched. Change the voice and
-- render_spec_hash changes for everything, so the whole deck re-renders — and
-- the UI must quote that price before charging it.
--
-- The UNIQUE constraint IS the cache. A lookup that finds a `ready` row for
-- (slide, variant, script_hash, render_spec_hash) has proof that this exact
-- audio already exists, without trusting a timestamp or a status flag.
--
-- cost_cents is recorded per row so a deck's narration spend is auditable
-- segment by segment, rather than being a number that appeared on an invoice.
--
-- c2pa_manifest_id and watermark_id are present and NULL. Provenance marking is
-- in scope for rung 2 (D-AV29) but needs a signing certificate that does not
-- exist yet; the columns are here so adding it later is a backfill, not a
-- migration.
--
-- Additive only — a NEW table. Nothing existing is touched.

CREATE TABLE IF NOT EXISTS fe_media_segments (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  presentation_id   TEXT NOT NULL,
  slide_id          TEXT NOT NULL,
  variant           TEXT NOT NULL,          -- full | compressed | closing
  script_hash       TEXT NOT NULL,
  render_spec_hash  TEXT NOT NULL,
  kind              TEXT NOT NULL DEFAULT 'audio',
  status            TEXT NOT NULL DEFAULT 'pending',  -- pending|ready|failed
  asset_path        TEXT,                   -- object path inside `deck-media`
  duration_ms       INTEGER,
  bytes             INTEGER,
  voice_id          TEXT NOT NULL,
  cost_cents        INTEGER NOT NULL DEFAULT 0,
  error             TEXT,
  c2pa_manifest_id  TEXT,
  watermark_id      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The cache key. Without this a concurrent render could write the same audio
-- twice and bill for both.
CREATE UNIQUE INDEX IF NOT EXISTS fe_media_segments_content_key
  ON fe_media_segments (slide_id, variant, script_hash, render_spec_hash, kind);

-- "What does this deck currently have?" — the player's and the UI's question.
CREATE INDEX IF NOT EXISTS fe_media_segments_presentation
  ON fe_media_segments (presentation_id, status);

-- "What has this user spent?"
CREATE INDEX IF NOT EXISTS fe_media_segments_user
  ON fe_media_segments (user_id, created_at DESC);

COMMENT ON TABLE fe_media_segments IS
  'Rendered narration audio, content-addressed on (script_hash, render_spec_hash) so one edited slide re-renders one segment.';

-- Verify: expect the table and 3 indexes.
--   SELECT indexname FROM pg_indexes WHERE tablename = 'fe_media_segments';
