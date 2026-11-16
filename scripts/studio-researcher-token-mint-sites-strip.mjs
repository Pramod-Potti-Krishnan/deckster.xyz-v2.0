// KNOWLEDGE-3, the F1 follow-up: a source test that pins the four places Studio signs a Researcher K-06 session token (scripts/test-studio-researcher-token-mint-sites.mjs). Registered with scripts/studio-later-changes.mjs.
// Test only: no runtime code changes, no flag, no .env.example block, no strip. This file is plain node, no imports, nothing read from disk or git.
// Checks a to e pin the four mint sites (d: in the two routes the lookup, the owner check and the mint share the exported GET handler). Check f holds what a source test can show about other signing: researcherSessionTokenSecret is imported only by the same three files, its result goes only into the minter's secret or a truthiness test there, those three files and the library never use Web Crypto's subtle, and the three never call or import createHmac. It does not show a secret read built from pieces of its name or by taking process.env whole, or a signer from a package other than crypto handed such a secret; a reviewer reads those.
// g: the session-token route signs the very chat its lookup checked. h: the ingest-status route signs the chat's stored Researcher session name, not the chat id it checked, so it is pinned differently: its minted token is used once, as a header of the one upstream fetch, and never in a response, a log or a return. i: the library's export list is today's names, with one createHmac call, inside the minter. (REVIEW-1's #633 review, P3 1-4: the follow-up amends this file and the test only; the file list below is the same.)

export const RESEARCHER_TOKEN_MINT_SITES_SCOPE_FILES = new Set([
  "scripts/studio-researcher-token-mint-sites-strip.mjs",
  "scripts/test-studio-researcher-token-mint-sites.mjs",
  "scripts/studio-later-changes.mjs"
])
