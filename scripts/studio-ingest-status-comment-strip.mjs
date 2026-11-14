// KNOWLEDGE-3, the #633 follow-up (REVIEW-1's #633 review, P3 1-4): the header comment of app/api/researcher/ingest-status/[jobId]/route.ts said the Researcher session name comes "not from the browser". It comes from ChatSession.geminiStoreName, a field the browser can set (POST /api/sessions/[id]/files), so the comment now says what is true and what protects the route. Registered with scripts/studio-later-changes.mjs.
// Comment text only: no code line of the route changes (the compiled output, comments removed, is byte for byte the same), no flag, no .env.example block. No strip either: no older proof holds this route to an earlier commit's text. scripts/test-researcher-ingest-status-auth.mjs, the only script that reads it, runs it through stripLaterChanges, compiles and runs it, and checks its text with a few patterns (no NEXT_PUBLIC secret, no service key, runtime and dynamic) that the comment does not trip, so a later pin has nothing to put back.
// The rest of the follow-up amends the two files #633 already registered (scripts/test-studio-researcher-token-mint-sites.mjs and its scope file), listed again here because this commit touches them. Plain node, no imports, nothing read from disk or git.

export const INGEST_STATUS_COMMENT_SCOPE_FILES = new Set([
  "app/api/researcher/ingest-status/[jobId]/route.ts",
  "scripts/studio-ingest-status-comment-strip.mjs",
  "scripts/studio-researcher-token-mint-sites-strip.mjs",
  "scripts/test-studio-researcher-token-mint-sites.mjs",
  "scripts/studio-later-changes.mjs"
])
