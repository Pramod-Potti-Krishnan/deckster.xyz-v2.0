// FRONTEND-1 (4 Nov 2026): security P0 H4-01, PR #575. NO flag: it is a security fix (PROGRAM-1's ruling, as D1). The NextAuth jwt callback takes only name/image from a client update();
// tier, approved, walletBalanceCents and the subscription are re-read from the database (on update and on a 60 s refresh), and wallet/debit + usage/quota read the tier from the database.
// How the older pins reach it: this change REGISTERS its files (scripts/studio-later-changes.mjs, one line; no .env.example block: there is no flag), so the scope checks that read BASE..HEAD
// treat them as a registered later change's files, not strays. Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88e' // studio-v4-dev-preparation-code, this change is cut from
export const TIER_GUARD_SUBJECT = /^Security:/
export const TIER_GUARD_SCOPE_FILES = [
  'lib/auth-options.ts',
  'lib/auth-session-update.ts',
  'lib/quota/server-tier.ts',
  'app/api/usage/quota/route.ts',
  'app/api/wallet/debit/route.ts',
  'scripts/test-studio-tier-update-guard.mjs',
  'scripts/studio-tier-update-guard-strip.mjs',
  'scripts/studio-later-changes.mjs',
]
