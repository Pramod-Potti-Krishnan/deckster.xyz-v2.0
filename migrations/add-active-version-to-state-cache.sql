-- Migration: Add activeVersion field to SessionStateCache
-- Date: 2025-11-27
-- Purpose: Fix presentation URL persistence by adding missing activeVersion field
--
-- This field is required to track which presentation version (strawman/final)
-- the user is currently viewing when they switch sessions or refresh the page.

-- Add active_version column to fe_session_state_cache table
ALTER TABLE fe_session_state_cache
ADD COLUMN active_version VARCHAR(10);

-- Add a comment to document the field
COMMENT ON COLUMN fe_session_state_cache.active_version IS
'Tracks which presentation version is active: "strawman" or "final"';

-- Note: Column is nullable to support existing rows
-- Existing rows will have NULL, which will be handled by application logic
-- (defaults to "final" when NULL)
