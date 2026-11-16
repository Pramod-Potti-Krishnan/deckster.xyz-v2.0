// KNOWLEDGE-3, DSB-5a (Studio half of DSB-5, streams/knowledge-3/DRIVE-SESSION-BINDING.md in the Deckster workspace repo; supersedes OPS-2's Drafts #315, #316 and #319): the browser's Researcher upload calls carry a signed K-06 session token.
// One flag, NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED (exact "true", default off, build-time). Off: every upload call is the plain fetch it was (same arguments, no extra async hop), and the template upload's order is unchanged.
//   - app/api/researcher/session-token/route.ts (new): GET ?session_id=&owner=email|id; signed in (401), flag and a usable RESEARCHER_SESSION_TOKEN_SECRET or 200 {token_enabled:false}, canonical id (400), owner kind (400),
//     the caller's own ChatSession (403 session_not_owned, no row reads the same), not deleted (410), lookup failure (503); mints with lib/researcher-session-token.ts for 15 minutes; no-store; logs fixed reason codes only.
//   - lib/upload-session-token.ts (new, browser): researcherUploadFetch(fetch, { sessionId, userId }) returns fetch itself with the flag off; on, it attaches the header the route names, re-mints once and retries once on a 401/403, and passes an answer to a call with no token through.
//   - the four calls: sessions/create (hooks/use-file-upload.ts, both paths, and lib/researcher-upload.ts), files/storage-upload-url, files/process-uploaded, and the DIRECT files/ingest-status poll (the job's own session; the proxy path is untouched).
//   - components/template-ingest-dialog.tsx: with the flag on, the chat session row is created before the upload (the token is minted only for a row the caller owns), as the composer and deck-import uploads already do.
// Every line this change adds to an existing app file carries the marker UPLOAD-SESSION-TOKEN (a whole token); the rewritten lines put the base's line back. The two older proofs it teaches (their closed dependency lists refuse the new import) now read
// through stripLaterChanges, every taught line carrying "LATER-CHANGES: registry read (UPLOAD-SESSION-TOKEN)". The fixture gains #316's K-06 vectors under a new key (the cases already there are unchanged).
// How the older pins reach it: it REGISTERS its files, its .env.example block and its strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = "2f06e51ec807d4ecd5cd00edc9bfd0005a5fd0b8" // origin/studio-v4-dev-preparation-code (#621 merged), the trunk this change sits on
export const UPLOAD_SESSION_TOKEN_FLAGS = ['NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED']
export const UPLOAD_SESSION_TOKEN_MARKER = 'UPLOAD-SESSION-TOKEN'
/** The marker as a WHOLE token: UPLOAD-SESSION-TOKEN is this change's; UPLOAD-SESSION-TOKEN-X and X-UPLOAD-SESSION-TOKEN are not. */
export const UPLOAD_SESSION_TOKEN_MARKER_RE = /(?<![\w-])UPLOAD-SESSION-TOKEN(?![\w-])/
/** The subject prefix of this change's own commits. */
export const UPLOAD_SESSION_TOKEN_SUBJECT = 'Upload session token:'
export const UPLOAD_SESSION_TOKEN_PIN_MARK = '// LATER-CHANGES: registry read (UPLOAD-SESSION-TOKEN)'

/** Existing app files that get marked lines. */
export const UPLOAD_SESSION_TOKEN_APP_FILES = ["hooks/use-file-upload.ts","lib/researcher-upload.ts","components/template-ingest-dialog.tsx"]
/** New files (no base text to put back). */
export const UPLOAD_SESSION_TOKEN_NEW_FILES = ['app/api/researcher/session-token/route.ts', 'lib/upload-session-token.ts', 'scripts/studio-upload-session-token-strip.mjs', 'scripts/test-studio-upload-session-token.mjs']
export const UPLOAD_SESSION_TOKEN_FIXTURE = "scripts/fixtures/researcher-session-token-v1.json"

/** The exact text of this change's .env.example block (the registry takes it out, with the blank line that separates it, for the older pins). */
export const UPLOAD_SESSION_TOKEN_ENV_BLOCK = "# STUDIO UPLOAD SESSION TOKEN (KNOWLEDGE-3; DSB-5a). NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED: the exact value \"true\" turns it on; anything else, including unset, is off, and then every browser upload call to the Researcher is the request it is today. Build-time value: change it on Vercel and redeploy.\n# On: the browser's Researcher upload calls (sessions/create, files/storage-upload-url, files/process-uploaded and the direct files/ingest-status poll; chat paperclip, composer, deck import and template upload) carry a 15-minute session token from GET /api/researcher/session-token,\n# which signs it only for a chat session the signed-in user owns, for the owner the upload sends (the e-mail today, the account id once the owner-cuid change sends it). The template upload then creates its chat session before the upload instead of after it.\n# The route signs with the server-only RESEARCHER_SESSION_TOKEN_SECRET above (the same value as the Researcher's). While it is unset or shorter than 32 bytes the route answers {\"token_enabled\": false} and the calls go out without a token, as today.\n# Flip order: this flag with that secret on Vercel and the Researcher, first-upload smoke; then the Researcher's RESEARCHER_HARDENING_V1_ENABLED, smoke; then RESEARCHER_SESSION_ROUTES_REQUIRE_AUTH_ENABLED, smoke.\nNEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED=\"false\"\n"

/** [text the file has now, text the file had at BASE_COMMIT] per edit, whole lines (with their newline), in file order; was = '' for an inserted line. Putting them back gives the base file byte for byte. */
export const UPLOAD_SESSION_TOKEN_EDITS = {
  "hooks/use-file-upload.ts": [
    ["import { researcherUploadFetch, researcherUploadPollFetch } from '@/lib/upload-session-token' // UPLOAD-SESSION-TOKEN (NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED, default off): the session token on the four browser -> Researcher upload calls; off, each call is the plain fetch it was\n", ""],
    ["        const response = await researcherUploadFetch(fetch, { sessionId: owner.sessionId, userId: owner.userId })(`${getResearcherBaseUrl()}/api/v1/sessions/create`, { // UPLOAD-SESSION-TOKEN\n", "        const response = await fetch(`${getResearcherBaseUrl()}/api/v1/sessions/create`, {\n"],
    ["      const response = await researcherUploadFetch(fetch, { sessionId: currentSessionId, userId })(`${getResearcherBaseUrl()}/api/v1/sessions/create`, { // UPLOAD-SESSION-TOKEN\n", "      const response = await fetch(`${getResearcherBaseUrl()}/api/v1/sessions/create`, {\n"],
    ["    tokenOwner?: string | null, // UPLOAD-SESSION-TOKEN: the owner the upload sent to sessions/create (only its kind reaches the mint route)\n", ""],
    ["    const response = await researcherUploadFetch(fetch, { sessionId: researcherSessionId, userId: tokenOwner })(`${getResearcherBaseUrl()}/api/v1/files/storage-upload-url`, { // UPLOAD-SESSION-TOKEN\n", "    const response = await fetch(`${getResearcherBaseUrl()}/api/v1/files/storage-upload-url`, {\n"],
    ["    tokenOwner?: string | null, // UPLOAD-SESSION-TOKEN\n", ""],
    ["    const response = await researcherUploadFetch(fetch, { sessionId: researcherSessionId, userId: tokenOwner })(`${getResearcherBaseUrl()}/api/v1/files/process-uploaded`, { // UPLOAD-SESSION-TOKEN\n", "    const response = await fetch(`${getResearcherBaseUrl()}/api/v1/files/process-uploaded`, {\n"],
    ["    tokenSessionId?: string, // UPLOAD-SESSION-TOKEN: the job's own Researcher session (the token on the direct poll is for it)\n", ""],
    ["        const response = await researcherUploadPollFetch(fetch, { sessionId: tokenSessionId, userId: statusIdentity?.userId })( // UPLOAD-SESSION-TOKEN: the direct poll only; the same-origin proxy path is untouched\n", "        const response = await fetch(\n"],
    ["      const uploadTokenOwner = STUDIO_UPLOAD_OWNERSHIP ? owner?.userId : userId // UPLOAD-SESSION-TOKEN: the owner this upload sends to sessions/create, as the poll identity below takes it\n      const uploadUrl = await requestStorageUploadUrl(researcherSessionId, file, contentType, uploadTokenOwner) // UPLOAD-SESSION-TOKEN\n", "      const uploadUrl = await requestStorageUploadUrl(researcherSessionId, file, contentType)\n"],
    ["          uploadTokenOwner, // UPLOAD-SESSION-TOKEN\n", ""],
    ["        }, researcherSessionId) // UPLOAD-SESSION-TOKEN: the job's own Researcher session, for the token on the direct poll\n", "        })\n"],
  ],
  "lib/researcher-upload.ts": [
    ["import { researcherUploadFetch } from '@/lib/upload-session-token' // UPLOAD-SESSION-TOKEN (NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED, default off): the session token on the three Researcher calls below; off, each is the plain fetch it was\n", ""],
    ["  const sessionResponse = await researcherUploadFetch(fetch, { sessionId, userId })(`${researcherBaseUrl}/api/v1/sessions/create`, { // UPLOAD-SESSION-TOKEN\n", "  const sessionResponse = await fetch(`${researcherBaseUrl}/api/v1/sessions/create`, {\n"],
    ["  const prepareResponse = await researcherUploadFetch(fetch, { sessionId: researcherSessionId, userId })(`${researcherBaseUrl}/api/v1/files/storage-upload-url`, { // UPLOAD-SESSION-TOKEN\n", "  const prepareResponse = await fetch(`${researcherBaseUrl}/api/v1/files/storage-upload-url`, {\n"],
    ["  const processResponse = await researcherUploadFetch(fetch, { sessionId: researcherSessionId, userId })(`${researcherBaseUrl}/api/v1/files/process-uploaded`, { // UPLOAD-SESSION-TOKEN\n", "  const processResponse = await fetch(`${researcherBaseUrl}/api/v1/files/process-uploaded`, {\n"],
  ],
  "components/template-ingest-dialog.tsx": [
    ["        if (process.env.NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED === 'true' && !checkpoint.sessionCreated) { const dbSession = await createSession(newSessionId, `Template: ${file.name}`); if (!live()) return; if (!dbSession) throw new Error('Failed to create a new builder session'); checkpoint.sessionCreated = true } // UPLOAD-SESSION-TOKEN (NEXT_PUBLIC_STUDIO_UPLOAD_SESSION_TOKEN_ENABLED, default off): the upload's session token is minted only for a chat session the caller owns, so the DB row comes first here, as in the composer and deck-import uploads (the same call and title as the step below, which then has nothing left to do). Off: the row is created after the upload, as before\n", ""],
  ],
}

/** The older proofs this change teaches: [has, was] per edit. Every line a taught proof has now carries UPLOAD_SESSION_TOKEN_PIN_MARK. */
export const UPLOAD_SESSION_TOKEN_PIN_EDITS = {
  "scripts/test-researcher-ingest-status-auth.mjs": [
    ["const { stripLaterChanges } = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (UPLOAD-SESSION-TOKEN)\nconst read = relative => stripLaterChanges(relative, fs.readFileSync(path.join(REPO, relative), 'utf8')) // LATER-CHANGES: registry read (UPLOAD-SESSION-TOKEN): a later change's lines come out first (the upload session token's, in the upload hook: its import is not in this proof's closed dependency list), so the hook, the route, the libs and .env.example are read as this proof's base has them\n", "const read = relative => fs.readFileSync(path.join(REPO, relative), 'utf8')\n"],
  ],
  "scripts/test-composer-storage-upload.mjs": [
    ["const source = (await import('./studio-later-changes.mjs')).stripLaterChanges('lib/researcher-upload.ts', fs.readFileSync(new URL('../lib/researcher-upload.ts', import.meta.url), 'utf8')) // LATER-CHANGES: registry read (UPLOAD-SESSION-TOKEN): a later change's lines come out first (the upload session token's import is not in this proof's closed dependency list), so the helper is read as this proof's base has it\n", "const source = fs.readFileSync(new URL('../lib/researcher-upload.ts', import.meta.url), 'utf8')\n"],
  ],
}
export const UPLOAD_SESSION_TOKEN_PIN_FILES = Object.keys(UPLOAD_SESSION_TOKEN_PIN_EDITS)

/** The fixture's added key: its tail now, and its tail at BASE_COMMIT (the file has no trailing newline). */
export const UPLOAD_SESSION_TOKEN_FIXTURE_EDIT = ["\n  ],\n  \"k06_mint_and_verify\": {\n    \"_provenance\": \"The deterministic vectors of OPS-2's identity/v1 fixture (Studio Draft #316, a66944d1, scripts/fixtures/identity-session-token-v1--mint-and-verify.json), from K-06's own mint and verify (Researcher services/session_auth_report.py:141-190 at 523cf9168a780b8d043006e83c29e06990330160). Added by DSB-5a; the cases above are unchanged. The secret is a made-up 31-byte test value, below the 32-byte floor on purpose: the mint itself takes it, the routes never would.\",\n    \"secret\": \"fixture-session-secret-not-real\",\n    \"sid\": \"session-fixture-0001\",\n    \"exp\": 1790000000,\n    \"verify_now\": 1789999100,\n    \"token_for_cuid\": \"v1.c2Vzc2lvbi1maXh0dXJlLTAwMDE.Y3VpZC1maXh0dXJlLTAwMDE.1790000000.fg7lwbbKSSqUEgcTrzjMiePAz-yIpNY5TYbfoW9vK3o\",\n    \"uid_cuid\": \"cuid-fixture-0001\",\n    \"token_for_email_uid\": \"v1.c2Vzc2lvbi1maXh0dXJlLTAwMDE.dXNlckBleGFtcGxlLmludmFsaWQ.1790000000.mMz2Y2HpkxPdWIKZcR9v7NHOfYW87elY5t6dF3CpEd8\",\n    \"uid_email\": \"user@example.invalid\",\n    \"verify_at_verify_now\": \"valid\",\n    \"verify_after_exp_plus_31\": \"expired\",\n    \"verify_wrong_secret\": \"invalid\",\n    \"mint_refused\": [\n      { \"name\": \"uid with a pipe\", \"sid\": \"session-fixture-0001\", \"uid\": \"a|b\" },\n      { \"name\": \"empty uid\", \"sid\": \"session-fixture-0001\", \"uid\": \"\" },\n      { \"name\": \"sid with a pipe\", \"sid\": \"a|b\", \"uid\": \"cuid-fixture-0001\" }\n    ]\n  }\n}", "\n  ]\n}"]

/** Every [has, was] pair this change makes to an existing file, by file. */
export const UPLOAD_SESSION_TOKEN_ALL_EDITS = { ...UPLOAD_SESSION_TOKEN_EDITS, ...UPLOAD_SESSION_TOKEN_PIN_EDITS }

/** Files this change edits that are not app code: .env.example (its block), the registry (three lines), the fixture and the older proofs it teaches. */
export const UPLOAD_SESSION_TOKEN_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', UPLOAD_SESSION_TOKEN_FIXTURE, ...UPLOAD_SESSION_TOKEN_PIN_FILES]
/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const UPLOAD_SESSION_TOKEN_SCOPE_FILES = new Set([...UPLOAD_SESSION_TOKEN_APP_FILES, ...UPLOAD_SESSION_TOKEN_NEW_FILES, ...UPLOAD_SESSION_TOKEN_OWN_EDITS])

/** `text` with one run of whole lines put back: `has` counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a run that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's edits: each [has, was] pair put back (the fixture's added key taken out); every other byte stays. Any other file (and .env.example, which the registry's env block list takes care of) is returned as it is. Idempotent. */
export function stripUploadSessionToken(rel, text) {
  if (typeof text !== 'string') return text
  if (rel === UPLOAD_SESSION_TOKEN_FIXTURE) {
    const [has, was] = UPLOAD_SESSION_TOKEN_FIXTURE_EDIT
    return text.endsWith(has) ? text.slice(0, -has.length) + was : text
  }
  if (!Object.prototype.hasOwnProperty.call(UPLOAD_SESSION_TOKEN_ALL_EDITS, rel)) return text
  return UPLOAD_SESSION_TOKEN_ALL_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
