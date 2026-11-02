-- Template auto-apply: the user's standing "Use my best-matching template" check, kept per USER so it follows them across devices.
-- (PK, 2 Nov 17:48Z: the auto-apply check is per user across devices; stored server-side in the user preferences, with the browser's
-- localStorage only as a cache. NEXT_PUBLIC_STUDIO_TEMPLATE_AUTO_APPLY_SERVER, default off, stacked on #559.)
--
-- TABLE NAME: `fe_user_preferences`, not `user_preferences`. The Prisma model is UserPreferences and carries
-- `@@map("fe_user_preferences")`, like every other frontend table in this database.
--
-- ============================================================================================================================
-- APPLY THIS BEFORE THE PR THAT ADDS `templateAutoApply` TO prisma/schema.prisma IS MERGED (#560, also called #559b; stacked on #559).
-- Hand-run, once, in the Supabase SQL editor (PK, or someone PK names). The build only runs `prisma generate`; nothing in the build
-- or the deploy applies this file.
--
-- WHY THE ORDER MATTERS: Prisma's generated client selects EVERY field of a model that a query does not narrow with `select`.
-- The existing GET and PATCH in app/api/preferences/route.ts (the Settings > Notifications and Privacy pages, for every user)
-- call prisma.userPreferences.upsert with no `select`. Once the schema has the field and the column does not exist, those
-- calls fail with "column fe_user_preferences.template_auto_apply does not exist". With the column in place first, nothing fails.
-- ============================================================================================================================
--
-- Nullable, NO default, on purpose: NULL means "never set", which Studio reads as ON (PK's ruling: auto-apply is ON by default).
-- A DEFAULT would rewrite meaning for every existing row; with none, existing rows stay NULL and the table is not rewritten.
--
-- Additive only and idempotent: no column is dropped, renamed or retyped; running it twice changes nothing.
--
-- Verify (read-only; OPS-2 runs this before it merges the PR):
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'fe_user_preferences' AND column_name = 'template_auto_apply';
-- Expect exactly one row: template_auto_apply | boolean | YES
--
-- Rollback (PK; only after the flag is unflipped and the PR is reverted or not merged):
--   ALTER TABLE fe_user_preferences DROP COLUMN IF EXISTS template_auto_apply;

ALTER TABLE fe_user_preferences
  ADD COLUMN IF NOT EXISTS template_auto_apply BOOLEAN;
COMMENT ON COLUMN fe_user_preferences.template_auto_apply IS
  'Template auto-apply check (W2 P4-7/8): the user''s standing preference across devices. NULL = never set = ON.';
