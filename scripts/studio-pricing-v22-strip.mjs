// FRONTEND-1 (W5 P4-17, Studio Pricing page v2.2, 4 Nov). Flag NEXT_PUBLIC_STUDIO_PRICING_V22 (the string "true", default off, build-time): /pricing draws the v2.2 page (credits per plan, a Free tier,
// the feature matrix, top-ups). Copy and layout only: no live price, no Stripe, no network; users see credits, never tokens, provider cost or margin. Every decision is lib/studio-pricing-v22.ts (pure data);
// components/marketing/pricing-v22/pricing-v22-page.tsx draws it. Every line this change adds to an EXISTING file is a pure insertion that carries the marker PRICING-V22 (a whole token):
// app/(marketing-v3)/pricing/page.tsx (two imports, the flag read, the early return). Strip the marked lines and the file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code at the start of this change
export const PRICING_V22_FLAG = 'NEXT_PUBLIC_STUDIO_PRICING_V22'
export const PRICING_V22_MARKER = 'PRICING-V22'
/** The marker as a WHOLE token. */
export const PRICING_V22_MARKER_RE = /(?<![\w-])PRICING-V22(?![\w-])/

/** Existing files that get marked lines. */
export const PRICING_V22_FILES = ['app/(marketing-v3)/pricing/page.tsx']

/** New files (no base text to put back). */
export const PRICING_V22_NEW_FILES = [
  'lib/studio-pricing-v22.ts',
  'components/marketing/pricing-v22/pricing-v22-page.tsx',
  'scripts/studio-pricing-v22-strip.mjs',
  'scripts/test-studio-pricing-v22.mjs',
]

/** Files this change edits that are neither marked app code nor new: its .env.example block and the registry (three lines). Run the proof with `node scripts/test-studio-pricing-v22.mjs`. */
export const PRICING_V22_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs']

/** Every file this change's commits touch. */
export const PRICING_V22_SCOPE_FILES = new Set([...PRICING_V22_FILES, ...PRICING_V22_NEW_FILES, ...PRICING_V22_OWN_EDITS])

/** The whole .env.example block. */
export const PRICING_V22_ENV_BLOCK = `# STUDIO PRICING V2.2 (FRONTEND-1; W5 P4-17). On only for the exact string "true"; default off, and then /pricing is exactly as before. Build-time value: change it on Vercel and redeploy.
# On: /pricing shows the v2.2 page: Free, Starter, Pro and Max with the credits each plan grants a month and an estimated deck count, the feature matrix with its monthly caps, how credits work and the top-up packs.
# Copy and layout only: no live price, no Stripe call, no network; users see credits, never tokens, provider cost or margin. Paid plan names, prices and sign-up links come from PRICING_TIERS.
NEXT_PUBLIC_STUDIO_PRICING_V22="false"
`

/** The file without this change's lines: every line carrying the marker (whole token) is taken out. Any other file is returned as it is. */
export function stripPricingV22(rel, text) {
  if (typeof text !== 'string') return text
  if (!PRICING_V22_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !PRICING_V22_MARKER_RE.test(line)).join('\n')
}
