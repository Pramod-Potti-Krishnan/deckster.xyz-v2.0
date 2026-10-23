// FRONTEND-2 P2-STRIPE-TIER (Stripe real tier): the Stripe webhook stores the real plan (STRIPE_REAL_TIER_MAPPING_ENABLED, server-side, default off), stacked on #475. Its one change to a file the Pass 3 pins hold to an
// earlier commit is the .env.example block next to the STRIPE_* lines (package.json is not touched). A pin that holds that file to its own base reads it through stripStripeRealTier(rel, text) first and then does what
// it always did, the way scripts/studio-narration-router-strip.mjs works (#475, which the Stripe real tier change is stacked on). scripts/test-stripe-real-tier-webhook.mjs proves that stripping gives back c1a7378's
// .env.example byte for byte, so nothing else was added to it. Every other file comes back as it is. This file has no base text to put back: it is new.

export const STRIPE_REAL_TIER_FILES = ['.env.example']

// The block: its comment lines, the flag line, the four price-id lines and the blank line after them (inserted as one piece after the existing STRIPE_PRO_YEARLY_PRICE_ID line's blank line).
const ENV_BLOCK = /# Server-only real-tier webhook mapping[^\n]*\n(?:#[^\n]*\n)*STRIPE_REAL_TIER_MAPPING_ENABLED="false"\n(?:STRIPE_(?:STARTER|MAX)_(?:MONTHLY|YEARLY)_PRICE_ID="[^"\n]*"\n){4}\n/

/** `text` of repo file `rel` without the Stripe real tier block (.env.example). Any other file is returned as it is. */
export function stripStripeRealTier(rel, text) {
  return rel === '.env.example' ? text.replace(ENV_BLOCK, '') : text
}
