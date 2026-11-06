// FRONTEND-1 (L-BILLING F4 + F6, Studio half; security audit B2/B3). Server-only switch WALLET_DEBIT_SOURCE (default unset = "flat" = today; see lib/billing/wallet-debit-source.ts).
// F4: app/api/wallet/debit/route.ts gets marked pure insertions (marker BILLING-F4F6): under "router" it ignores the browser amount; under "flat_strict" an over-cap debit still lands and is logged; the refusal is the pre-build check GET /api/wallet/precheck (new file), 402 wallet_capped.
// F6: plan and pack prices are written once, in lib/marketing/homepage-v2-pricing.ts (PRICING_TIERS, TOPUP_PACKS, marked appended lines); Billing, the top-up modal and the Stripe top-up route read them.
// Those are REPLACED lines; BILLING_F4F6_EDITS holds [text now, text before] and stripBillingF4F6 puts the old text back. The derived strings equal the old literals, so output is byte-identical.
// PK ruling (v1 caps): under flat_strict only, lib/quota/quota.ts uses the monthly cap alone and the UTC calendar month (marked lines; one replaced line in BILLING_F4F6_EDITS).
// One older proof (scripts/test-studio-p2-docs.mjs) has one line widened to read lib/marketing/homepage-v2-pricing.ts through the registry; BILLING_F4F6_PIN_EDITS holds [text now, text before] and stripBillingF4F6 puts the old line back, so the base's proof is the file byte for byte once this change is stripped.
// Proof gaps of two earlier steps (Option L, FRONTEND-2's 6 Nov findings; the chain gate runs at the tip, so they are fixed here): scripts/test-studio-api-hardening.mjs (#581: its .env.example block must be the LAST, and its registry lines the last) and scripts/test-studio-model-picker-simple.mjs (#565: check H holds .env.example, the registry and the taught proofs to the base plus its own) now read past what changes registered AFTER them add. Each edit is one whole line with the registry-read mark, listed in BILLING_F4F6_PIN_EDITS so a put-back restores the file.
// Plain node, no imports.

export const BASE_COMMIT = '21b5fc08089eb0f4fd1db80f5eb954cc787df748' // origin/studio-v4-dev-preparation-code (#570, #571, #576, #591 and UX-06 in) when this change was restacked; it was 3e1ce88e (stacked on #575, frontend1/tier-update-guard)
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
   "import { PRICING_TIERS, TOPUP_PACKS } from \"@/lib/marketing/homepage-v2-pricing\" // BILLING-F4F6\n",
   "import { PRICING_TIERS } from \"@/lib/marketing/homepage-v2-pricing\"\n"
  ],
  [
   "                  {TOPUP_PACKS.map((pack) => ( // BILLING-F4F6",
   "                  {[\n                    { id: \"pack_10\", label: \"$10\" },\n                    { id: \"pack_25\", label: \"$25\" },\n                    { id: \"pack_50\", label: \"$50\" },\n                    { id: \"pack_100\", label: \"$100\" },\n                  ].map((pack) => ("
  ]
 ]
}
export const BILLING_F4F6_PIN_EDITS = {
 "scripts/test-studio-p2-docs.mjs": [[
  "for (const file of [DATA_COMPARISONS, DATA_EXAMPLES, DATA_TEMPLATES, 'app/examples/page.tsx', 'app/templates/page.tsx', 'app/compare/[competitor]/page.tsx', PRICING_SOURCE, 'lib/auth-options.ts', 'app/auth/signup/page.tsx', 'app/auth/signin/page.tsx']) eq(file === 'lib/auth-options.ts' || file === PRICING_SOURCE ? stripLaterChanges(file, read(file)) : read(file), baseSource(file), `${file} is the base commit's, byte for byte`) // LATER-CHANGES: registry read (TIER-GUARD)\n",
  "for (const file of [DATA_COMPARISONS, DATA_EXAMPLES, DATA_TEMPLATES, 'app/examples/page.tsx', 'app/templates/page.tsx', 'app/compare/[competitor]/page.tsx', PRICING_SOURCE, 'lib/auth-options.ts', 'app/auth/signup/page.tsx', 'app/auth/signin/page.tsx']) eq(file === 'lib/auth-options.ts' ? stripLaterChanges(file, read(file)) : read(file), baseSource(file), `${file} is the base commit's, byte for byte`) // LATER-CHANGES: registry read (TIER-GUARD)\n"
 ]],
 "scripts/test-studio-api-hardening.mjs": [
  [
   "  if (!registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(mod.API_HARDENING_ENV_BLOCK) + 1).reduce((text, block) => { const body = String(block).replace(/^\\n+/, '').replace(/\\n+$/, ''); return body === '' ? text : text.replace(`\\n${body}\\n`, () => '') }, env).endsWith(mod.API_HARDENING_ENV_BLOCK)) out.push('.env.example: the block is not at the end') // LATER-CHANGES: registry read (BILLING-F4F6): the block is the last one of this change and the ones before it; the blocks registered AFTER this one (#569, #584 ...) are read past\n",
   "  if (!env.endsWith(mod.API_HARDENING_ENV_BLOCK)) out.push('.env.example: the block is not at the end')\n"
  ],
  [
   "    else if (((base) => lines.slice(lines.indexOf(mine[0]) + 1).some(line => base.includes(line)))(((baseOf('scripts/studio-later-changes.mjs') || '').split(`export const ${list} = `)[1] || '').split('\\n  // one line per later change, above this comment')[0].split('\\n'))) out.push(`${list}: not after every line of its base`) // LATER-CHANGES: registry read (BILLING-F4F6): this change's line comes after every line its base registry has; the lines registered AFTER it (#569, #584 ...) are read past\n",
   "    else if (lines.at(-1) !== mine[0]) out.push(`${list}: not the last line`)\n"
  ],
  [
   "  'env line above an older one': (() => { const mineLine = regText.split('\\n').find(line => line.includes('.API_HARDENING_ENV_BLOCK, // LATER-CHANGE')), older = (baseOf('scripts/studio-later-changes.mjs') || '').split('\\n').filter(line => /_ENV_BLOCK, \\/\\/ LATER-CHANGE/.test(line)).at(-1); return regText.replace(`${mineLine}\\n`, () => '').replace(older, () => `${mineLine}\\n${older}`) })(), // LATER-CHANGES: registry read (BILLING-F4F6): this change's block line moved above the last env block line its base has (a line registered before it), whatever was registered after it\n",
   "  'env line not last': regText.replace(/(\\n.*\\.[A-Z0-9_]+_ENV_BLOCK, \\/\\/ LATER-CHANGE.*)(\\n.*\\.API_HARDENING_ENV_BLOCK, \\/\\/ LATER-CHANGE.*)/, '$2$1'), // LATER-CHANGES: registry read (API-HARDENING, restack onto 1bb42d7f): swap with whichever registered block line sits just above\n"
  ]
 ],
 "scripts/test-studio-model-picker-simple.mjs": [
  [
   "  const env = registry.LATER_ENV_BLOCKS.slice(registry.LATER_ENV_BLOCKS.indexOf(ENV_BLOCK) + 1).reduce((text, block) => { const body = String(block).replace(/^\\n+/, '').replace(/\\n+$/, ''); return body === '' ? text : text.replace(`\\n${body}\\n`, () => '') }, disk(ENV)), was = baseText(ENV) // LATER-CHANGES: registry read (BILLING-F4F6): .env.example is read as this change left it, the blocks registered AFTER this one (#576, #581, #569, #584 ...) taken out\n",
   "  const env = disk(ENV), was = baseText(ENV)\n"
  ],
  [
   "  const reg = disk(REGISTRY).split('\\n').reduce((acc, line) => { if (line.includes('studio-model-picker-simple-strip.mjs')) acc.after = true; else if (line.includes('one line per later change')) acc.after = false; else if (acc.after && line.includes('LATER-CHANGE')) return acc; acc.out.push(line); return acc }, { after: false, out: [] }).out.join('\\n'), regLines = reg.split('\\n').filter(line => line.includes('studio-model-picker-simple-strip.mjs')); eq(regLines.length, 3); for (const line of regLines) assert.match(line, /\\/\\/ LATER-CHANGE: FRONTEND-1, F-14 simplified model picker/) // LATER-CHANGES: registry read (BILLING-F4F6): the registry is read as this change left it, the lines registered AFTER its own (#576, #581, #569, #584 ...) taken out of each list\n",
   "  const reg = disk(REGISTRY), regLines = reg.split('\\n').filter(line => line.includes('studio-model-picker-simple-strip.mjs')); eq(regLines.length, 3); for (const line of regLines) assert.match(line, /\\/\\/ LATER-CHANGE: FRONTEND-1, F-14 simplified model picker/)\n"
  ],
  [
   "    const now = applyAll(registry.LATER_STRIPS.slice(registry.LATER_STRIPS.indexOf(stripModelPickerSimple) + 1), rel, disk(rel)), edits = PIN_EDITS[rel]; eq(now.split(edits[0][0]).length - 1, 1, `${rel}: the taught line is there once`); eq(stripModule.putBackPin(rel, now), baseText(rel), `${rel}: putting it back gives the base's proof`); eq(stripModelPickerSimple(rel, now), baseText(rel)) // LATER-CHANGES: registry read (BILLING-F4F6): the proof is read as this change left it, the lines the changes registered AFTER it taught it (#569's Redeem v4 line ...) put back\n",
   "    const now = disk(rel), edits = PIN_EDITS[rel]; eq(now.split(edits[0][0]).length - 1, 1, `${rel}: the taught line is there once`); eq(stripModule.putBackPin(rel, now), baseText(rel), `${rel}: putting it back gives the base's proof`); eq(stripModelPickerSimple(rel, now), baseText(rel))\n"
  ]
 ]
}
export const BILLING_F4F6_NEW_FILES = ['lib/billing/wallet-debit-source.ts', 'app/api/wallet/precheck/route.ts', 'scripts/studio-billing-f4-f6-strip.mjs', 'scripts/test-studio-billing-f4-f6.mjs']
export const BILLING_F4F6_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', 'scripts/test-studio-p2-account.mjs', 'scripts/test-studio-launch-wording.mjs', 'scripts/test-studio-model-choice.mjs', 'scripts/test-studio-p2-docs.mjs', 'scripts/test-stripe-real-tier-webhook.mjs', 'scripts/test-studio-api-hardening.mjs', 'scripts/test-studio-model-picker-simple.mjs'] // the last five are pins taught to read the files above, or the changes registered around them, through the registry (their marked lines)
export const BILLING_F4F6_SCOPE_FILES = new Set([...BILLING_F4F6_FILES, ...Object.keys(BILLING_F4F6_EDITS), ...BILLING_F4F6_NEW_FILES, ...BILLING_F4F6_OWN_EDITS])
export const BILLING_F4F6_ENV_BLOCK = "# WALLET DEBIT SOURCE (FRONTEND-1; L-BILLING F4 + security audit B2/B3). Server-only, runtime. Unset or \"flat\" = today: /api/wallet/debit charges browser-reported tokens at the flat rate.\n# \"flat_strict\" = flat (the post-turn debit always lands; an over-cap one is logged), plus a pre-build check: GET /api/wallet/precheck answers 402 { code: \"wallet_capped\" } when over the caps with no top-up balance.\n# \"router\" = the router meter is the only debit source: /api/wallet/debit ignores the browser-reported amount and records nothing (no-op 200). Do not set \"router\" before the meter receiver ships.\n# WALLET_DEBIT_SOURCE=flat\n"

export function stripBillingF4F6(rel, text) {
  if (typeof text !== 'string') return text
  let out = text
  if (rel in BILLING_F4F6_PIN_EDITS) return BILLING_F4F6_PIN_EDITS[rel].reduce((acc, [has, was]) => acc.replace(has, () => was), out) // an older proof this change taught: its base line, so a proof that holds it byte for byte reads it as it was; idempotent
  if (rel in BILLING_F4F6_EDITS) out = BILLING_F4F6_EDITS[rel].reduce((acc, [now, before]) => acc.replace(now, () => before), out)
  if (BILLING_F4F6_FILES.includes(rel) || rel in BILLING_F4F6_EDITS) out = out.split('\n').filter(line => !BILLING_F4F6_MARKER_RE.test(line)).join('\n')
  return out
}
