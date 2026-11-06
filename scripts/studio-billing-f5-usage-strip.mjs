// FRONTEND-1 (L-BILLING F5 = S-3 quota and refusal UX, plus a Usage page; 4 Nov). Flag NEXT_PUBLIC_STUDIO_USAGE_PAGE (the string "true", default off, build-time).
// First commit: new files only. Follow-up (Builder wiring): 5 marked lines (marker BILLING-F5-USAGE) in hooks/use-deckster-websocket-v2.ts and app/builder/page.tsx, pure insertions;
// strip them and each file is its base byte for byte. Off: /usage is notFound(), the refusal components render null, the hook lines are no-ops (no fetch, no event).
// Stacked on frontend1/tier-update-guard (#575: the quota route reads tier from the DB). Plain node, no imports.
export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code at the start of this change
export const BILLING_F5_USAGE_FLAGS = ['NEXT_PUBLIC_STUDIO_USAGE_PAGE', 'NEXT_PUBLIC_STUDIO_QUOTA_SCREENS'] // PK ruling 4 Nov: two flags, each independent
export const BILLING_F5_USAGE_MARKER = 'BILLING-F5-USAGE'
/** The marker as a WHOLE token. */
export const BILLING_F5_USAGE_MARKER_RE = /(?<![\w-])BILLING-F5-USAGE(?![\w-])/
/** Existing files that get marked lines (follow-up, 4 Nov: the Builder wiring). Pure insertions; strip them and each file is its base. */
export const BILLING_F5_USAGE_FILES = ['hooks/use-deckster-websocket-v2.ts', 'app/builder/page.tsx']
export const BILLING_F5_USAGE_NEW_FILES = [
  'lib/studio-billing-usage.ts',
  'components/billing/quota-refusal.tsx',
  'app/(app)/usage/page.tsx',
  'components/billing/builder-quota-refusal.tsx',
  'scripts/studio-billing-f5-usage-strip.mjs',
  'scripts/test-studio-billing-f5-usage.mjs',
]
export const BILLING_F5_USAGE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', 'scripts/test-director-question-submit.mjs'] // the last is a pin taught to read the Builder files without the F5 marked lines
export const BILLING_F5_USAGE_SCOPE_FILES = new Set([...BILLING_F5_USAGE_FILES, ...BILLING_F5_USAGE_NEW_FILES, ...BILLING_F5_USAGE_OWN_EDITS])

export const BILLING_F5_USAGE_ENV_BLOCK = `# STUDIO USAGE PAGE (FRONTEND-1; L-BILLING Usage page). On only for the string "true"; default off, and then nothing changes (/usage is a 404). Build-time value.
# On: /usage shows plan credits used and left this period (the UTC calendar month) and the top-up balance, read from /api/usage/quota and /api/wallet/balance only (no Stripe call).
# Its out-of-credits box needs NEXT_PUBLIC_STUDIO_QUOTA_SCREENS too. Credits only (1 credit = $0.01): no tokens, provider cost or model names.
NEXT_PUBLIC_STUDIO_USAGE_PAGE="false"
`

/** PK ruling 4 Nov: the quota/refusal screens have their own flag and block. */
export const BILLING_F5_QUOTA_SCREENS_ENV_BLOCK = `# STUDIO QUOTA SCREENS (FRONTEND-1; L-BILLING F5 quota and refusal screens). On only for the string "true"; default off, and then nothing changes: no refusal screen, no precheck call. Build-time value.
# On: Director's QUOTA_EXCEEDED / PLAN_REQUIRED error frames and a 402 wallet_capped from POST /api/wallet/precheck (a 404 there counts as allowed) bring up a plain refusal screen in the Builder
# with Top up or Upgrade; the Usage page shows its out-of-credits box. Monthly caps only. Credits only: no tokens, provider cost or model names. Independent of NEXT_PUBLIC_STUDIO_USAGE_PAGE.
NEXT_PUBLIC_STUDIO_QUOTA_SCREENS="false"
`

/** The file without this change's marked lines; any other file is returned as it is. */
export function stripBillingF5Usage(rel, text) {
  if (typeof text !== 'string' || !BILLING_F5_USAGE_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !BILLING_F5_USAGE_MARKER_RE.test(line)).join('\n')
}
