// KNOWLEDGE-3, the F1 follow-up: a source test that pins the four places Studio signs a Researcher K-06 session token (scripts/test-studio-researcher-token-mint-sites.mjs). Registered with scripts/studio-later-changes.mjs.
// Test only: no runtime code changes, no flag, no .env.example block, no strip. Plain node, no imports, nothing read from disk or git.
// Checks a to e pin the four mint sites; check f pins that nothing else signs: researcherSessionTokenSecret is imported only by the same three files, and those three never call or import createHmac.

export const RESEARCHER_TOKEN_MINT_SITES_SCOPE_FILES = new Set([
  "scripts/studio-researcher-token-mint-sites-strip.mjs",
  "scripts/test-studio-researcher-token-mint-sites.mjs",
  "scripts/studio-later-changes.mjs"
])
