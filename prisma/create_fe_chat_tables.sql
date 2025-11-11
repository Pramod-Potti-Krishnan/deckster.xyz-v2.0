-- Frontend Chat Sessions Migration
-- SAFE: Only creates new tables, does NOT drop any existing tables
-- Prefix: fe_ (frontend) to avoid conflicts with backend services

-- Create fe_chat_sessions table
CREATE TABLE IF NOT EXISTS fe_chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  title TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMP,
  current_stage INTEGER NOT NULL DEFAULT 1,
  strawman_preview_url TEXT,
  final_presentation_url TEXT,
  strawman_presentation_id TEXT,
  final_presentation_id TEXT,
  slide_count INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  is_favorite BOOLEAN NOT NULL DEFAULT false
);

-- Indexes for fe_chat_sessions
CREATE INDEX IF NOT EXISTS idx_fe_chat_sessions_user_created
  ON fe_chat_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_fe_chat_sessions_user_last_message
  ON fe_chat_sessions(user_id, last_message_at DESC);

-- Create fe_chat_messages table
CREATE TABLE IF NOT EXISTS fe_chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES fe_chat_sessions(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  timestamp TIMESTAMP NOT NULL,
  payload JSONB NOT NULL,
  user_text TEXT
);

-- Indexes for fe_chat_messages
CREATE INDEX IF NOT EXISTS idx_fe_chat_messages_session_timestamp
  ON fe_chat_messages(session_id, timestamp ASC);

CREATE INDEX IF NOT EXISTS idx_fe_chat_messages_session_type
  ON fe_chat_messages(session_id, message_type);

-- Create fe_session_state_cache table
CREATE TABLE IF NOT EXISTS fe_session_state_cache (
  session_id TEXT PRIMARY KEY REFERENCES fe_chat_sessions(id) ON DELETE CASCADE,
  current_status JSONB,
  slide_structure JSONB,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Verification
DO $$
BEGIN
  RAISE NOTICE 'Migration complete! Created tables:';
  RAISE NOTICE '  - fe_chat_sessions';
  RAISE NOTICE '  - fe_chat_messages';
  RAISE NOTICE '  - fe_session_state_cache';
END $$;
