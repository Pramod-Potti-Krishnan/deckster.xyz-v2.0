// FRONTEND-1 (L-BILLING F5 = S-3 quota and refusal UX, plus a Usage page; 4 Nov). Flag NEXT_PUBLIC_STUDIO_USAGE_PAGE (the string "true", default off, build-time).
// New files only: no existing line of app code is touched, so flag off is byte-identical (the new /usage route renders notFound() while off; the refusal component renders null).
// Stacked on frontend1/tier-update-guard (#575: the quota route reads tier from the DB). Plain node, no imports.
export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code at the start of this change
export const BILLING_F5_USAGE_FLAGS = ['NEXT_PUBLIC_STUDIO_USAGE_PAGE']
export const BILLING_F5_USAGE_MARKER = 'BILLING-F5-USAGE'
export const BILLING_F5_USAGE_FILES = []
export const BILLING_F5_USAGE_NEW_FILES = [
  'lib/studio-billing-usage.ts',
  'components/billing/quota-refusal.tsx',
  'app/(app)/usage/page.tsx',
  'scripts/studio-billing-f5-usage-strip.mjs',
  'scripts/test-studio-billing-f5-usage.mjs',
]
export const BILLING_F5_USAGE_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']
export const BILLING_F5_USAGE_SCOPE_FILES = new Set([...BILLING_F5_USAGE_FILES, ...BILLING_F5_USAGE_NEW_FILES, ...BILLING_F5_USAGE_OWN_EDITS])

export const BILLING_F5_USAGE_ENV_BLOCK = `# STUDIO USAGE PAGE (FRONTEND-1; L-BILLING F5 quota and refusal screens + Usage page). On only for the string "true"; default off, and then nothing changes (/usage is a 404, no refusal screen). Build-time value.
# On: /usage shows plan credits used and left this period and the top-up balance, read from /api/usage/quota and /api/wallet/balance only (no Stripe call); out of credits, over a cap or on a plan
# that lacks a feature, a plain refusal screen offers Top up or Upgrade. Credits only (1 credit = $0.01): no tokens, provider cost or model names.
NEXT_PUBLIC_STUDIO_USAGE_PAGE="false"
`

/** No marked lines in existing files: every file is returned as it is. */
export function stripBillingF5Usage(rel, text) {
  return text
}
