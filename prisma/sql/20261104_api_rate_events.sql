-- Studio API hardening v1 (STUDIO_API_HARDENING_V1_ENABLED): shared attempt counters.
-- Additive only: a NEW table. Apply before turning the flag on; while the flag is off nothing reads or writes it.
CREATE TABLE IF NOT EXISTS fe_api_rate_events (
  id          TEXT PRIMARY KEY,
  bucket      TEXT NOT NULL,
  scope       TEXT NOT NULL,
  subject     TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fe_api_rate_events_bucket_scope_created_at_idx ON fe_api_rate_events (bucket, scope, created_at);
CREATE INDEX IF NOT EXISTS fe_api_rate_events_bucket_subject_created_at_idx ON fe_api_rate_events (bucket, subject, created_at);
