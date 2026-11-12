// FRONTEND-2 (restack of OPS-2's Draft #304, [J8.1] "Director WS token carries a signed build-quota claim", onto Studio dev 9aedba04, 12 Nov; FRONTEND-1 14:02Z keep-both for billing and redeem, 16:13Z shape A for the hook). One switch, DECKSTER_WS_BQ_CLAIM_ENABLED
// (server, runtime, exact "true", off by default): off, the Director token, /api/version and the socket hook are what dev has. OPS-2's commit (ec773bc8, 7 Oct) is brought onto dev by a MERGE; the signing hunk (lib/quota/build-quota-claim.ts,
// lib/quota/build-quota.ts and the mint lines in app/api/director/ws-token/route.ts) is byte for byte OPS-2's EXCEPT the tier check FRONTEND-1 added on PK's approval (12 Nov: lib/quota/build-quota-claim.ts reads the plan through getServerTier, so a stored tier outside the four plans is signed as free; comments in build-quota.ts), and so is every other non-hook line: none is edited or marked.
// The socket hook is the one file where the restack re-shapes #304's lines (FRONTEND-1's hook): the two base lines #304 rewrote in place are back as dev has them, and every line #304 adds is a pure insertion that carries the marker WS-BQ-CLAIM, with no blank line;
// the forced refresh is a marked forceRefreshNow that mirrors the timer callback, so no base line is removed or changed. The strip takes out every whole line that carries the marker, in that file only.
// What the restack adds besides is registry work (tests and .env.example): the change's .env.example block is at the true end of the file; the change REGISTERS its files, its block and this strip (scripts/studio-later-changes.mjs, three lines), so that the older
// pins reach it with no edit of their own; and this strip puts back, by exact [has, was] runs of whole lines, every line #304 added to the other five existing app files it touches (the Billing page, the redeem page, the ws-token route, the version route, package.json),
// so an older proof that holds one of them to an earlier commit reads dev's text. Four older proofs are taught (the pin table below, tests only, every line carries the registry-read mark): two get one more first-parent subject filter each, as B62 / B63 / B66 / B67 did,
// and the two billing proofs read the owner's file through the strips of the changes registered after them (both owners' OK).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '9aedba044285ecb8f75c222ffa005d1e9ea79b41' // Studio dev (12 Nov, the merge of #605), the parent of this restack's merge: the text every strip below puts back
export const WS_BQ_CLAIM_FLAGS = ['DECKSTER_WS_BQ_CLAIM_ENABLED']
/** The subjects of this change's own commits on the first-parent line of BASE..HEAD: OPS-2's original commit and the restack's registry commits. */
export const WS_BQ_CLAIM_SUBJECT_RE = /^(\[J8\.1\]|WS bq claim:)/

/** New files (no base text to put back). */
export const WS_BQ_CLAIM_NEW_FILES = [
  'lib/quota/build-quota-claim.ts',
  'lib/quota/build-quota.ts',
  'lib/ws-bq-refresh.ts',
  'scripts/test-ws-bq-claim.mjs',
  'scripts/studio-ws-bq-claim-strip.mjs',
]

/** Whole lines, one string per line, each with its newline: L('a', 'b') is 'a\nb\n'. */
const L = (...lines) => lines.map(line => `${line}\n`).join('')

/**
 * Every [has, was] pair this change makes to an existing app file other than the hook, by file: the lines OPS-2's commit has now (a run of whole lines, in order) and the lines dev has there (was = '': every one is a pure
 * insertion). Putting every pair back gives BASE_COMMIT's file byte for byte. Each `has` is the committed text of #304, never edited here, and occurs exactly once in its file.
 */
export const WS_BQ_CLAIM_APP_EDITS = {
  "app/(app)/billing/page.tsx": [
    [L("import { requestBqClaimRefresh } from \"@/lib/ws-bq-refresh\""), ''],
    [L("  // Back from Stripe after a top-up or a plan checkout: the wallet or tier just", "  // changed, so any open builder re-mints its Director token (build-quota claim)", "  // now, and once more shortly after because the Stripe webhook can land late.", "  const topUpResult = searchParams?.get(\"topup\")", "  const checkoutResult = searchParams?.get(\"success\")", "  useEffect(() => {", "    if (topUpResult === \"success\") return requestBqClaimRefresh(\"topup\")", "    if (checkoutResult === \"true\") return requestBqClaimRefresh(\"checkout\")", "    return undefined", "  }, [topUpResult, checkoutResult])", ""), ''],
  ],
  "app/(auth)/redeem/page.tsx": [
    [L("import { requestBqClaimRefresh } from '@/lib/ws-bq-refresh'"), ''],
    [L("      // The plan and wallet just changed in the database: any open builder", "      // re-mints its Director token now (inert unless the build-quota claim is on).", "      requestBqClaimRefresh('redeem')"), ''],
  ],
  "app/api/director/ws-token/route.ts": [
    [L("import { isWsBqClaimEnabled } from '@/lib/quota/build-quota'", "import { mintBuildQuotaClaim } from '@/lib/quota/build-quota-claim'"), ''],
    [L("  // Signed build-quota claim (contract F-quota-bq-claim v1). Dark: only minted", "  // when DECKSTER_WS_BQ_CLAIM_ENABLED=true; off leaves the payload and this", "  // response exactly as they were. It is computed from the live database by", "  // user id alone; the session JWT's tier / approved / wallet are", "  // client-writable and are never read for it. A lookup failure never fails", "  // the mint: it becomes ok:null and Director decides whether to retry.", "  const bq = isWsBqClaimEnabled() ? await mintBuildQuotaClaim(session.user.id) : null", ""), ''],
    [L("    ...(bq ? { bq } : {}),"), ''],
    [L("    // Tells the browser a claim rides in this token, so it re-mints on", "    // redeem / top-up / checkout. Absent with the flag off.", "    ...(bq ? { bq_claim: true } : {}),"), ''],
  ],
  "app/api/version/route.ts": [
    [L("import { isWsBqClaimEnabled } from '@/lib/quota/build-quota'"), ''],
    [L("      // Runtime flag state, so a flip can be confirmed without signing in. The", "      // key appears only when the flag is on: off leaves this response as it was.", "      ...(isWsBqClaimEnabled() ? { ws_bq_claim_enabled: true } : {}),"), ''],
  ],
  "package.json": [
    [L("    \"test:ws-bq-claim\": \"node scripts/test-ws-bq-claim.mjs\","), ''],
  ],
}

/** The socket hook is taught by MARKER, not by pairs: every line this change adds to it is a pure insertion that carries the marker WS-BQ-CLAIM (a WHOLE token), so a strip takes out every whole line that carries it, even one line on its own. No base line of the hook is changed or removed, and no added line is blank. */
export const WS_BQ_CLAIM_MARKER = 'WS-BQ-CLAIM'
export const WS_BQ_CLAIM_MARKER_RE = /(?<![\w-])WS-BQ-CLAIM(?![\w-])/
export const WS_BQ_CLAIM_MARKED_FILES = ['hooks/use-deckster-websocket-v2.ts']

export const WS_BQ_CLAIM_APP_FILES = [...Object.keys(WS_BQ_CLAIM_APP_EDITS), ...WS_BQ_CLAIM_MARKED_FILES]

/** The older proofs this change teaches: [text the proof has now, text the base proof has] per edit, whole lines (or a run of them), so putting them back gives the base file byte for byte. Two proofs get one more first-parent subject filter each (nothing before it). The two billing proofs read the owner's file through the strips of the changes registered after them (one inserted pair of lines and one rewritten line in FRONTEND-1's test-studio-billing-f4-f6.mjs, both owners' OK; one rewritten line in test-studio-billing-l5.mjs). Every line carries WS_BQ_CLAIM_PIN_MARK. */
export const WS_BQ_CLAIM_PIN_MARK = '// LATER-CHANGES: registry read (WS-BQ-CLAIM)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(\\[J8\\.1\\]|WS bq claim:)/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (WS-BQ-CLAIM): on a branch stacked after this change (the build-quota claim in the Director WS token, J8.1), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
const F4F6_PAIRS = [["const laterRegistry = await import('./studio-later-changes.mjs') // LATER-CHANGES: registry read (WS-BQ-CLAIM)\nconst laterAfterMe = (rel, text) => { const at = laterRegistry.LATER_STRIPS.indexOf(m.stripBillingF4F6); return (at === -1 ? [] : laterRegistry.LATER_STRIPS.slice(at + 1)).reduce((out, strip) => { const next = typeof strip === 'function' ? strip(rel, out) : out; return typeof next === 'string' ? next : out }, text) } // LATER-CHANGES: registry read (WS-BQ-CLAIM): only the strips of the changes registered AFTER this one, in the registry's order, so a file reads as this change left it\n", ""], ["  ok(m.stripBillingF4F6(rel, laterAfterMe(rel, readFileSync(rel, 'utf8'))) === base, `A: ${rel} strips to its base`) // LATER-CHANGES: registry read (WS-BQ-CLAIM)\n", "  ok(m.stripBillingF4F6(rel, readFileSync(rel, 'utf8')) === base, `A: ${rel} strips to its base`)\n"]]
const L5_PAIRS = [["function proveDrafts(drafts = S.BILLING_L5_DRAFTS, readNow = rel => laterStrips(rel, read(rel))) { // LATER-CHANGES: registry read (WS-BQ-CLAIM): the changes registered after this one are undone first, so the owner's file reads as this change left it\n", "function proveDrafts(drafts = S.BILLING_L5_DRAFTS, readNow = read) {\n"]]
export const WS_BQ_CLAIM_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-billing-f4-f6.mjs': F4F6_PAIRS,
  'scripts/test-studio-billing-l5.mjs': L5_PAIRS,
}
/** Where each taught line goes: right after the last subject filter of the shape !/^...:/ the base proof has, B66's "Avatar spawn mock:" (the line that starts with this text). */
export const WS_BQ_CLAIM_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Avatar spawn mock:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AVATAR-SPAWN)"
export const WS_BQ_CLAIM_PIN_FILES = Object.keys(WS_BQ_CLAIM_PIN_EDITS)

/** Every [has, was] pair this change makes, by file: the five app files that take pairs (the hook is taught by marker) and the four taught proofs. */
export const WS_BQ_CLAIM_EDITS = { ...WS_BQ_CLAIM_APP_EDITS, ...WS_BQ_CLAIM_PIN_EDITS }

/** Files this change edits that are not app code: .env.example (its block, now at the true end), the registry (three lines: its files, its block, its strip) and the older proofs it teaches. */
export const WS_BQ_CLAIM_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...WS_BQ_CLAIM_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const WS_BQ_CLAIM_SCOPE_FILES = new Set([...WS_BQ_CLAIM_NEW_FILES, ...WS_BQ_CLAIM_APP_FILES, ...WS_BQ_CLAIM_OWN_EDITS])

/** The whole .env.example block: its comments and its one line (at the true end of the file, after one blank line). */
export const WS_BQ_CLAIM_ENV_BLOCK = `# Signed build-quota claim ("bq") inside the Director WS token (J8.1; contract
# F-quota-bq-claim v1). Server-only, read at runtime, default off: off keeps
# the token byte-identical to today's. Director enforces it behind its own flag
# (DIRECTOR_BUILD_QUOTA_ENFORCED_ENABLED); turn the two on together.
# Reports on /api/version (ws_bq_claim_enabled) only when on.
DECKSTER_WS_BQ_CLAIM_ENABLED="false"
`

/** `text` without the whole lines that carry this change's marker (the socket hook): a single line comes back as '' when it carries it. */
function dropMarkedLines(text) {
  return text.split('\n').filter(line => !WS_BQ_CLAIM_MARKER_RE.test(line)).join('\n')
}

/** `text` with one run of whole lines put back: `has` is the run with its newlines, and it counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a run that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: an app file or an older proof this change touched gets its base text back, byte for byte (the hook by marker, the rest by pair). Any other file is returned as it is. Idempotent: a file that has none of the lines comes back as it is. */
export function stripWsBqClaim(rel, text) {
  if (typeof text !== 'string') return text
  const marked = WS_BQ_CLAIM_MARKED_FILES.includes(rel) ? dropMarkedLines(text) : text
  if (!Object.prototype.hasOwnProperty.call(WS_BQ_CLAIM_EDITS, rel)) return marked
  return WS_BQ_CLAIM_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), marked)
}
