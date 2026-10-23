// FRONTEND-2 P2-STRIPE-TIER (Stripe real tier): the Stripe webhook stores the real plan (STRIPE_REAL_TIER_MAPPING_ENABLED, server-side, default off), stacked on the studio-v4-dev-preparation-code tip. Its one change to a shared
// file is the .env.example block after #475's narration block and before PASS2 ADMIN (package.json is not touched). stripStripeRealTier(rel, text) takes that block out, and scripts/test-stripe-real-tier-webhook.mjs holds
// what is left to the base's .env.example with scripts/studio-env-append-tolerant.mjs (sameAsBase), so nothing else was added to it and a later PR's block does not matter. Only that test reads this module: the Pass 3 pins
// (#470, #472, #473, #475) answer for their own files only since 26003fc and no longer read .env.example through a strip of this change. Every other file comes back as it is. This file has no base text to put back: it is new.

export const STRIPE_REAL_TIER_FILES = ['.env.example']

// The block: its comment lines, the flag line, the four price-id lines and the blank line after them (inserted as one piece, between the narration block and # PASS2 ADMIN; the existing STRIPE_* lines are not touched).
const ENV_BLOCK = /# Server-only real-tier webhook mapping[^\n]*\n(?:#[^\n]*\n)*STRIPE_REAL_TIER_MAPPING_ENABLED="false"\n(?:STRIPE_(?:STARTER|MAX)_(?:MONTHLY|YEARLY)_PRICE_ID="[^"\n]*"\n){4}\n/

/** `text` of repo file `rel` without the Stripe real tier block (.env.example). Any other file is returned as it is. */
export function stripStripeRealTier(rel, text) {
  return rel === '.env.example' ? text.replace(ENV_BLOCK, '') : text
}
