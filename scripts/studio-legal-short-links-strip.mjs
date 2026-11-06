// FRONTEND-2 (PROGRAM-1 decision D16 a, 25 Oct): the two short legal links and the marketing-slide cache header that `uat`'s next.config.mjs has and the Studio dev tree's does not. Flag NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS (exact "true",
// default off, build-time). What is ported: /terms -> /legal/terms and /privacy -> /legal/privacy (uat: permanent: false, which is an HTTP 307), as two new pages (app/terms/page.tsx, app/privacy/page.tsx) because next.config.mjs is held byte for
// byte by older proofs; and Cache-Control "public, max-age=86400, stale-while-revalidate=604800" on /marketing/v3/slides/:path*, as one entry in vercel.json (a deploy config file cannot read an environment variable, so that one entry is not behind the flag).
// The header is also set on /marketing/v3-uat/slides/:path* (the stills NEXT_PUBLIC_STUDIO_UAT_MARKETING serves, which is where UAT's design reads them), and the redirects carry the request's own query string.
// What is NOT ported, on purpose: uat's /docs/api -> /docs and /shortcuts -> /learn (the dev tree has real, newer pages at app/docs/api and app/(app)/shortcuts, and those redirects would hide them).
// No existing app file gets a line, so there is no code strip: the registry holds this change's files and its .env.example block (two lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '4b96755c27511fc408478eda5fd9138e32effad8' // studio-v4-dev-preparation-code at #511 (pass3-polish-f), the branch this change is cut from
/** The `uat` commit the redirects and the header were read from (origin/uat). */
export const UAT_COMMIT = 'ee532fab4b84a6883f8a5b50675ccab692b62240'
export const LEGAL_SHORT_LINKS_FLAG = 'NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS'
export const LEGAL_SHORT_LINKS_COMMIT_SUBJECT = /^Legal short links:/

/** New files (no base text to put back). */
export const LEGAL_SHORT_LINKS_NEW_FILES = [
  'app/terms/page.tsx',
  'app/privacy/page.tsx',
  'lib/studio-legal-short-links.ts',
  'scripts/studio-legal-short-links-strip.mjs',
  'scripts/test-studio-legal-short-links.mjs',
]

/** The two older proofs this change edits, both FRONTEND-2's own (not FRONTEND-1's): each held something to "the change before it, exactly" that any later change breaks. One assertion each. */
export const LEGAL_SHORT_LINKS_BULK_EDIT_PROOF = 'scripts/test-studio-bulk-edit-prompt-text.mjs' // held .env.example to "the base plus my block, at the end", byte for byte: it now accepts the later blocks the registry names
export const LEGAL_SHORT_LINKS_POLISH_F_PROOF = 'scripts/test-studio-pass3-polish-f.mjs' // held its committed diff to "modifies no existing file but the registry": it now also accepts the files a later registered change modifies
export const LEGAL_SHORT_LINKS_OLDER_PROOFS = [LEGAL_SHORT_LINKS_BULK_EDIT_PROOF, LEGAL_SHORT_LINKS_POLISH_F_PROOF]

/** Files this change edits that are not new: .env.example (its block), vercel.json (one headers entry), the registry (two lines: its files and its block) and those two proofs (one assertion each). No FRONTEND-1 test is edited. */
export const LEGAL_SHORT_LINKS_OWN_EDITS = ['.env.example', 'vercel.json', 'scripts/studio-later-changes.mjs', ...LEGAL_SHORT_LINKS_OLDER_PROOFS]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const LEGAL_SHORT_LINKS_SCOPE_FILES = new Set([...LEGAL_SHORT_LINKS_NEW_FILES, ...LEGAL_SHORT_LINKS_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const LEGAL_SHORT_LINKS_ENV_BLOCK = `# STUDIO LEGAL SHORT LINKS (FRONTEND-2; PROGRAM-1 decision D16 a, 25 Oct). On for the exact value "true"; default off, and then /terms and /privacy are the not-found page, as before. Build-time value: change it on Vercel and redeploy.
# On: /terms redirects to /legal/terms and /privacy to /legal/privacy (HTTP 307, the same as the two non-permanent redirects in \`uat\`'s next.config.mjs, which the Studio tree's next.config.mjs does not carry). Sign-in and sign-up, links outside
# the app and the Google sign-in consent screen use the short paths; the request's own query string is carried to the legal page. Set it to "true" on UAT and on production for parity with \`uat\`. Not behind this flag: the marketing-slide
# cache header (Cache-Control public, max-age=86400, stale-while-revalidate=604800 on /marketing/v3/slides/* and on /marketing/v3-uat/slides/*, the stills the UAT marketing copy serves) is two entries in vercel.json, and a
# deploy config file cannot read an environment variable.
NEXT_PUBLIC_STUDIO_LEGAL_SHORT_LINKS="false"
`
