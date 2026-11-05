// FRONTEND-1 (L-BILLING F4 + F6, Studio half; security audit B2/B3). Server-only switch WALLET_DEBIT_SOURCE (default unset = "flat" = today; see lib/billing/wallet-debit-source.ts).
// F4: app/api/wallet/debit/route.ts gets marked pure insertions (marker BILLING-F4F6): under "router" it ignores the browser amount; under "flat_strict" an over-cap debit still lands and is logged; the refusal is the pre-build check GET /api/wallet/precheck (new file), 402 wallet_capped.
// F6: plan and pack prices are written once, in lib/marketing/homepage-v2-pricing.ts (PRICING_TIERS, TOPUP_PACKS, marked appended lines); Billing, the top-up modal and the Stripe top-up route read them.
// Those are REPLACED lines; BILLING_F4F6_EDITS holds [text now, text before] and stripBillingF4F6 puts the old text back. The derived strings equal the old literals, so output is byte-identical.
// PK ruling (v1 caps): under flat_strict only, lib/quota/quota.ts uses the monthly cap alone and the UTC calendar month (marked lines; one replaced line in BILLING_F4F6_EDITS).
// Plain node, no imports.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code at the start of this change (stacked on #575, frontend1/tier-update-guard)
export const BILLING_F4F6_MARKER_RE = /(?<![\w-])BILLING-F4F6(?![\w-])/
export const BILLING_F4F6_FILES = ['app/api/wallet/debit/route.ts', 'lib/marketing/homepage-v2-pricing.ts', 'lib/quota/quota.ts']
export const BILLING_F4F6_EDITS = {
 "lib/quota/quota.ts": [["    sumUsage(monthFrom), // BILLING-F4F6\n", "    sumUsage(monthStart),\n"]],
 "app/api/stripe/create-topup-session/route.ts": [
  [
   "const CREDIT_PACKS = TOPUP_PACKS // BILLING-F4F6: the one pack list, lib/marketing/homepage-v2-pricing.ts\n",
   "const CREDIT_PACKS = [\n  { id: \"pack_10\", label: \"$10\", amountCents: 1000 },\n  { id: \"pack_25\", label: \"$25\", amountCents: 2500 },\n  { id: \"pack_50\", label: \"$50\", amountCents: 5000 },\n  { id: \"pack_100\", label: \"$100\", amountCents: 10000 },\n] as const\n"
  ],
  [
   "import { TOPUP_PACKS } from \"@/lib/marketing/homepage-v2-pricing\" // BILLING-F4F6\nimport { PAYMENTS_OPEN_SOON_BODY",
   "import { PAYMENTS_OPEN_SOON_BODY"
  ]
 ],
 "components/builder/topup-modal.tsx": [
  [
   "const CREDIT_PACKS = TOPUP_PACKS // BILLING-F4F6: the one pack list, lib/marketing/homepage-v2-pricing.ts\n",
   "const CREDIT_PACKS = [\n  { id: \"pack_10\", label: \"$10\", amountCents: 1000 },\n  { id: \"pack_25\", label: \"$25\", amountCents: 2500 },\n  { id: \"pack_50\", label: \"$50\", amountCents: 5000 },\n  { id: \"pack_100\", label: \"$100\", amountCents: 10000 },\n] as const\n"
  ],
  [
   "import \"@/components/builder/studio-usage-topup.css\"\nimport { TOPUP_PACKS } from \"@/lib/marketing/homepage-v2-pricing\" // BILLING-F4F6\n",
   "import \"@/components/builder/studio-usage-topup.css\"\n"
  ]
 ],
 "app/(app)/billing/page.tsx": [
  [
   "import { PRICING_TIERS, TOPUP_PACKS, planMonthlyPriceLabel } from \"@/lib/marketing/homepage-v2-pricing\" // BILLING-F4F6\n",
   "import { PRICING_TIERS } from \"@/lib/marketing/homepage-v2-pricing\"\n"
  ],
  [
   "                        ? planMonthlyPriceLabel(\"premium\") // BILLING-F4F6\n                        : user.tier === \"pro\"\n                          ? planMonthlyPriceLabel(\"pro\") // BILLING-F4F6\n                          : user.tier === \"starter\"\n                            ? planMonthlyPriceLabel(\"starter\") // BILLING-F4F6",
   "                        ? \"$100/month\"\n                        : user.tier === \"pro\"\n                          ? \"$50/month\"\n                          : user.tier === \"starter\"\n                            ? \"$20/month\""
  ],
  [
   "                  {TOPUP_PACKS.map((pack) => ( // BILLING-F4F6",
   "                  {[\n                    { id: \"pack_10\", label: \"$10\" },\n                    { id: \"pack_25\", label: \"$25\" },\n                    { id: \"pack_50\", label: \"$50\" },\n                    { id: \"pack_100\", label: \"$100\" },\n                  ].map((pack) => ("
  ]
 ]
}
export const BILLING_F4F6_NEW_FILES = ['lib/billing/wallet-debit-source.ts', 'app/api/wallet/precheck/route.ts', 'scripts/studio-billing-f4-f6-strip.mjs', 'scripts/test-studio-billing-f4-f6.mjs']
export const BILLING_F4F6_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-p2-account.mjs', 'scripts/test-studio-p2-docs.mjs', 'scripts/test-stripe-real-tier-webhook.mjs'] // the last three are pins taught to read the files above through the registry (their marked lines)
export const BILLING_F4F6_SCOPE_FILES = new Set([...BILLING_F4F6_FILES, ...Object.keys(BILLING_F4F6_EDITS), ...BILLING_F4F6_NEW_FILES, ...BILLING_F4F6_OWN_EDITS])
export const BILLING_F4F6_ENV_BLOCK = "# WALLET DEBIT SOURCE (FRONTEND-1; L-BILLING F4 + security audit B2/B3). Server-only, runtime. Unset or \"flat\" = today: /api/wallet/debit charges browser-reported tokens at the flat rate.\n# \"flat_strict\" = flat (the post-turn debit always lands; an over-cap one is logged), plus a pre-build check: GET /api/wallet/precheck answers 402 { code: \"wallet_capped\" } when over the caps with no top-up balance.\n# \"router\" = the router meter is the only debit source: /api/wallet/debit ignores the browser-reported amount and records nothing (no-op 200). Do not set \"router\" before the meter receiver ships.\n# WALLET_DEBIT_SOURCE=flat"

export function stripBillingF4F6(rel, text) {
  if (typeof text !== 'string') return text
  let out = text
  if (rel in BILLING_F4F6_EDITS) out = BILLING_F4F6_EDITS[rel].reduce((acc, [now, before]) => acc.replace(now, () => before), out)
  if (BILLING_F4F6_FILES.includes(rel) || rel in BILLING_F4F6_EDITS) out = out.split('\n').filter(line => !BILLING_F4F6_MARKER_RE.test(line)).join('\n')
  return out
}
