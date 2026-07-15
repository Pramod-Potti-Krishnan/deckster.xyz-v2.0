-- Preserve customized pre-build decks when a Director session is handed off.
ALTER TABLE "fe_chat_sessions"
  ADD COLUMN IF NOT EXISTS "blank_presentation_url" TEXT,
  ADD COLUMN IF NOT EXISTS "blank_presentation_id" TEXT;
