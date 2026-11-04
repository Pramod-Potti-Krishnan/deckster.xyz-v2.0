-- SECURITY-AUDIT-BILLING B7: Stripe webhook event dedupe + ordering.
-- Additive only. Apply manually; the webhook degrades to the old (non-deduped)
-- behaviour while this table is absent (Prisma P2021 is tolerated).
CREATE TABLE IF NOT EXISTS fe_stripe_webhook_events (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    object_id TEXT,
    event_created INTEGER NOT NULL,
    processed_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS fe_stripe_webhook_events_object_id_event_created_idx
    ON fe_stripe_webhook_events (object_id, event_created);
