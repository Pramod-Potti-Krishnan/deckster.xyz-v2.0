// FRONTEND-2 (restack of OPS-2's Draft #304, [J8.1] "Director WS token carries a signed build-quota claim", onto Studio dev 9aedba04, 12 Nov; FRONTEND-1 14:02Z keep-both for billing and redeem). One switch, DECKSTER_WS_BQ_CLAIM_ENABLED (server, runtime, exact
// "true", off by default): off, the Director token, /api/version and the socket hook are what dev has. OPS-2's commit (ec773bc8, 7 Oct) is brought onto dev by a MERGE, and none of its code is edited: the signing hunk (lib/quota/build-quota-claim.ts,
// lib/quota/build-quota.ts and the mint lines in app/api/director/ws-token/route.ts) is byte for byte OPS-2's, and no marker is added to any of its lines.
// What the restack adds is registry work only (tests and .env.example): the change's .env.example block is at the true end of the file; the change REGISTERS its files, its block and this strip (scripts/studio-later-changes.mjs, three lines), so that the older
// pins reach it with no edit of their own; and this strip puts back, by exact [has, was] runs of whole lines, every line #304 added to the six existing app files it touches (the Billing page, the redeem page, the socket hook, the ws-token route,
// the version route, package.json), so an older proof that holds one of them to an earlier commit reads dev's text. Two older proofs that read the first-parent commits of BASE..HEAD get one more inserted subject filter each (the pin table below, tests only,
// every line carries the registry-read mark), as B62 / B63 / B66 / B67 did.
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
 * Every [has, was] pair this change makes to an existing app file, by file: the lines OPS-2's commit has now (a run of whole lines, in order) and the lines dev has there (was = '' for an insertion, the original line for the
 * two in-place rewrites in the socket hook). Putting every pair back gives BASE_COMMIT's file byte for byte. Each `has` is the committed text of #304, never edited here, and occurs exactly once in its file.
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
  "hooks/use-deckster-websocket-v2.ts": [
    [L("  // Build-quota claim (contract F-quota-bq-claim v1). `bqClaimActiveRef` is set", "  // from the ws-token response, which carries `bq_claim: true` only when the", "  // server flag DECKSTER_WS_BQ_CLAIM_ENABLED is on; with the flag off it stays", "  // false and the forced refresh below never runs. `forceAuthRefreshRef` re-mints", "  // the token now (after a coupon redeem / top-up / checkout) instead of waiting", "  // for the ~9 minute timer.", "  const bqClaimActiveRef = useRef(false);", "  const forceAuthRefreshRef = useRef<(() => void) | null>(null);", "  const forcedAuthRefreshInFlightRef = useRef(false);"), ''],
    [L("    const refreshNow = async () => {"), L("    authRefreshTimerRef.current = setTimeout(async () => {")],
    [L("        bqClaimActiveRef.current = body.bq_claim === true;"), ''],
    [L("    };", "    authRefreshTimerRef.current = setTimeout(refreshNow, delayMs);", "    forceAuthRefreshRef.current = () => {", "      if (!bqClaimActiveRef.current || forcedAuthRefreshInFlightRef.current || !isCurrentRefresh()) return;", "      forcedAuthRefreshInFlightRef.current = true;", "      clearAuthRefreshTimer();", "      void refreshNow().finally(() => { forcedAuthRefreshInFlightRef.current = false; });", "    };"), L("    }, delayMs);")],
    [L("  // A coupon redeem, top-up or checkout (on /redeem or /billing, usually in", "  // another tab) asks this socket to re-mint its token now, so the build-quota", "  // claim reflects the new plan or wallet at once. Inert unless the current", "  // token carries a claim (server flag DECKSTER_WS_BQ_CLAIM_ENABLED). The channel", "  // and event names are lib/ws-bq-refresh.ts's; they are spelled here rather than", "  // imported so this hook's import list stays as it was.", "  useEffect(() => {", "    const requestRefresh = () => forceAuthRefreshRef.current?.();", "    if (typeof BroadcastChannel !== 'undefined') {", "      const channel = new BroadcastChannel('deckster-ws-bq-refresh');", "      channel.onmessage = requestRefresh;", "      return () => channel.close();", "    }", "    if (typeof window === 'undefined') return undefined;", "    window.addEventListener('deckster:ws-bq-refresh', requestRefresh);", "    return () => window.removeEventListener('deckster:ws-bq-refresh', requestRefresh);", "  }, []);", ""), ''],
    [L("              bqClaimActiveRef.current = tokenBody.bq_claim === true;"), ''],
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
export const WS_BQ_CLAIM_APP_FILES = Object.keys(WS_BQ_CLAIM_APP_EDITS)

/** The older proofs this change teaches: one more first-parent subject filter each, the line the proof has now and the base proof's text (nothing). Every line carries WS_BQ_CLAIM_PIN_MARK. */
export const WS_BQ_CLAIM_PIN_MARK = '// LATER-CHANGES: registry read (WS-BQ-CLAIM)'
const FIRST_PARENT_LINE = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^(\\[J8\\.1\\]|WS bq claim:)/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (WS-BQ-CLAIM): on a branch stacked after this change (the build-quota claim in the Director WS token, J8.1), the first-parent commits are its own, not this change's; with none left the pins and identity checks cover the files\n"
export const WS_BQ_CLAIM_PIN_EDITS = {
  'scripts/test-studio-deck-sync-truth.mjs': [[FIRST_PARENT_LINE, '']],
  'scripts/test-studio-chat-element-edit.mjs': [[FIRST_PARENT_LINE, '']],
}
/** Where each taught line goes: right after the last subject filter of the shape !/^...:/ the base proof has, B66's "Avatar spawn mock:" (the line that starts with this text). */
export const WS_BQ_CLAIM_PIN_AFTER = "  shas.splice(0, shas.length, ...shas.filter(sha => !/^Avatar spawn mock:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (AVATAR-SPAWN)"
export const WS_BQ_CLAIM_PIN_FILES = Object.keys(WS_BQ_CLAIM_PIN_EDITS)

/** Every [has, was] pair this change makes, by file: the six app files and the two taught proofs. */
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

/** `text` with one run of whole lines put back: `has` is the run with its newlines, and it counts only at the start of a line (never the tail of a longer one). Only the first occurrence goes: a run that is there twice is a merge mistake the older pins must still see. */
function putBackLine(text, has, was) {
  let at = text.indexOf(has)
  while (at !== -1 && !(at === 0 || text[at - 1] === '\n')) at = text.indexOf(has, at + 1)
  return at === -1 ? text : text.slice(0, at) + was + text.slice(at + has.length)
}

/** The file without this change's lines: an app file or an older proof this change touched gets its base text back, byte for byte. Any other file is returned as it is. Idempotent: a file that has none of the lines comes back as it is. */
export function stripWsBqClaim(rel, text) {
  if (typeof text !== 'string') return text
  if (!Object.prototype.hasOwnProperty.call(WS_BQ_CLAIM_EDITS, rel)) return text
  return WS_BQ_CLAIM_EDITS[rel].reduce((out, [has, was]) => putBackLine(out, has, was), text)
}
