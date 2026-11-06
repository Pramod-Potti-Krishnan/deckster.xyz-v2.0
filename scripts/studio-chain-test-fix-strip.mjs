// FRONTEND-1 (tests only, Option L chain fix-forward, PROGRAM-1 GO 6 Nov): two FRONTEND-1-related proofs made robust to the chain. #570's ux-honesty
// reads Billing through the registry (F4/F6 widened the pricing import line), and #585's billing-f5-usage check F ignores the hook lines a change
// registered after it added (#590 chat caps). Registered as a later change so older proofs reading these files through the registry get the base's.
export const CHAIN_TEST_FIX_SUBJECT = /^Chain test fix:/
export const CHAIN_TEST_FIX_MARK = "LATER-CHANGES: registry read (CHAIN-TEST-FIX)"
export const CHAIN_TEST_FIX_EDITS = {
 "scripts/test-studio-ux-honesty.mjs": [
  [
   "import ts from 'typescript'\nimport { stripLaterChanges } from './studio-later-changes.mjs' // LATER-CHANGES: registry read (CHAIN-TEST-FIX)\n",
   "import ts from 'typescript'\n"
  ],
  [
   "function checkBilling(text) {\n  text = stripLaterChanges('app/(app)/billing/page.tsx', text) // LATER-CHANGES: registry read (CHAIN-TEST-FIX): later changes' lines on Billing (F4/F6 widened the pricing import) are put back first\n",
   "function checkBilling(text) {\n"
  ]
 ],
 "scripts/test-studio-billing-f5-usage.mjs": [
  [
   "  const laterOnly = (() => { const t = git('show', `${HEAD}:${rel}`), after = registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(strip.stripBillingF5Usage) + 1).reduce((x, f) => f(rel, x), t).split('\\n'); return new Set(t.split('\\n').filter(l => !after.includes(l))) })() // LATER-CHANGES: registry read (CHAIN-TEST-FIX): lines a change registered after this one added are its, not a stray\n  ok(added.filter(l => !(l.startsWith('+') && laterOnly.has(l.slice(1)))).every(l => l.startsWith('+') && strip.BILLING_F5_USAGE_MARKER_RE.test(l)), `F: ${rel} changes are marked insertions only`) // LATER-CHANGES: registry read (CHAIN-TEST-FIX)\n",
   "  ok(added.every(l => l.startsWith('+') && strip.BILLING_F5_USAGE_MARKER_RE.test(l)), `F: ${rel} changes are marked insertions only`)\n"
  ]
 ]
}
export const CHAIN_TEST_FIX_SCOPE_FILES = [...Object.keys(CHAIN_TEST_FIX_EDITS), "scripts/studio-chain-test-fix-strip.mjs", "scripts/studio-later-changes.mjs"]
export function stripChainTestFix(rel, text) {
  if (typeof text !== "string") return text
  return (CHAIN_TEST_FIX_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}
