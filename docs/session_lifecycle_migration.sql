-- Session Lifecycle Migration
-- Add support for draft sessions and session lifecycle tracking
-- Date: November 26, 2025
-- Purpose: Enable file uploads before first message by supporting draft sessions

-- Step 1: Add first_message_at column to track when session became active
ALTER TABLE fe_chat_sessions
ADD COLUMN IF NOT EXISTS first_message_at TIMESTAMP;

-- Step 2: Backfill existing sessions
-- For sessions with messages, set first_message_at = last_message_at and status = 'active'
UPDATE fe_chat_sessions
SET first_message_at = last_message_at,
    status = 'active'
WHERE last_message_at IS NOT NULL
  AND first_message_at IS NULL;

-- Step 3: Set status to 'active' for all existing sessions without messages
-- (These are edge cases - old sessions that somehow have no messages)
UPDATE fe_chat_sessions
SET status = 'active'
WHERE last_message_at IS NULL
  AND status != 'active';

-- Step 4: Verify migration
-- This query should show all sessions now have proper status
SELECT
  status,
  COUNT(*) as count,
  COUNT(CASE WHEN first_message_at IS NOT NULL THEN 1 END) as with_first_message,
  COUNT(CASE WHEN last_message_at IS NOT NULL THEN 1 END) as with_last_message
FROM fe_chat_sessions
GROUP BY status;

-- Expected results:
-- status  | count | with_first_message | with_last_message
-- --------+-------+--------------------+------------------
-- active  |  XXX  |        XXX         |       XXX
--
-- After this migration, new sessions will default to 'draft' status (handled by Prisma schema)

-- Step 5 (OPTIONAL): Clean up very old sessions with no messages before enabling new flow
-- Uncomment this if you want to clean up old orphaned sessions
-- DELETE FROM fe_chat_sessions
-- WHERE last_message_at IS NULL
--   AND created_at < NOW() - INTERVAL '30 days';
