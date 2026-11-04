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
  'scripts/test-studio-p2-admin.mjs',
  'scripts/test-studio-p2-docs.mjs',
]

/** [now, before] pairs per file: the strip puts the base's text back (each `now` sits in the head's file exactly once). Generated from the diff against BASE_COMMIT. */
export const TIER_GUARD_PAIRS = {
 "lib/auth-options.ts": [
  [
   "import { getUserSubscription } from \"@/lib/stripe/stripe-utils\"\nimport { applySessionUpdate, refreshEntitlementsIfStale, type ServerEntitlements } from \"@/lib/auth-session-update\"\n\nasync function loadServerEntitlements(userId: string): Promise<ServerEntitlements | null> {\n  const dbUser = await prisma.user.findUnique({\n    where: { id: userId },\n    select: { approved: true, tier: true, walletBalanceCents: true },\n  })\n  if (!dbUser) return null\n  const subscription = await getUserSubscription(userId)\n  return {\n    tier: dbUser.tier,\n    approved: dbUser.approved,\n    walletBalanceCents: dbUser.walletBalanceCents,\n    subscription: subscription ? {\n      status: subscription.status,\n      tier: subscription.tier,\n      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),\n    } : null,\n  }\n}\n",
   "import { getUserSubscription } from \"@/lib/stripe/stripe-utils\"\n"
  ],
  [
   "      try {\n        // Client-initiated session update (e.g. after a profile edit or coupon redeem).\n        // Security: the update payload is client-controlled. Only name/image are taken\n        // from it; tier/approved/wallet/subscription are re-read from the database.\n        if (trigger === \"update\") {\n          return applySessionUpdate(token, session, loadServerEntitlements)\n        }",
   "      try {\n        // Client-initiated session update (e.g. after a profile edit).\n        // Refresh the mutable fields on the token without a full re-login.\n        if (trigger === \"update\" && session) {\n          if (typeof session.name === \"string\") {\n            token.name = session.name\n          }\n          if (typeof session.image === \"string\") {\n            token.picture = session.image\n          }\n          if (typeof session.approved === \"boolean\") {\n            token.approved = session.approved\n          }\n          if (typeof session.walletBalanceCents === \"number\") {\n            token.walletBalanceCents = session.walletBalanceCents\n          }\n          if (typeof session.tier === \"string\") {\n            token.tier = session.tier\n          }\n          return token\n        }"
  ],
  [
   "              walletBalanceCents: dbUser?.walletBalanceCents ?? 0,\n              entitlementCheckedAt: Date.now(),\n              subscription: subscription ? {",
   "              walletBalanceCents: dbUser?.walletBalanceCents ?? 0,\n              subscription: subscription ? {"
  ],
  [
   "\n        // Token refresh: re-read server entitlements (throttled to 60s) so tokens that were\n        // escalated via the old update() hole heal. Runs only in the Node auth route /\n        // getServerSession \u2014 edge middleware (withAuth) decodes the JWT without this callback.\n        return refreshEntitlementsIfStale(token, loadServerEntitlements)\n      } catch (error) {",
   "\n        return token\n      } catch (error) {"
  ]
 ],
 "app/api/wallet/debit/route.ts": [
  [
   "import { authOptions } from \"@/lib/auth-options\"\nimport { getServerTier } from \"@/lib/quota/server-tier\"\nimport { debitWallet, recordPlanUsage, InsufficientFundsError } from \"@/lib/wallet\"",
   "import { authOptions } from \"@/lib/auth-options\"\nimport { debitWallet, recordPlanUsage, InsufficientFundsError } from \"@/lib/wallet\""
  ],
  [
   "    const userId = session.user.id\n    // Security: tier comes from the database, never from the (client-influenced) session.\n    const tier = await getServerTier(session.user.id)\n",
   "    const userId = session.user.id\n    const tier = (session.user.tier ?? \"free\") as Tier\n"
  ]
 ],
 "app/api/usage/quota/route.ts": [
  [
   "import { authOptions } from \"@/lib/auth-options\"\nimport { getServerTier } from \"@/lib/quota/server-tier\"\nimport { getQuotaStatus, type Tier } from \"@/lib/quota/quota\"",
   "import { authOptions } from \"@/lib/auth-options\"\nimport { getQuotaStatus, type Tier } from \"@/lib/quota/quota\""
  ],
  [
   "\n    // Security: tier comes from the database, never from the (client-influenced) session.\n    const tier = await getServerTier(session.user.id)\n    const status = await getQuotaStatus(session.user.id, tier)",
   "\n    const tier = (session.user.tier ?? \"free\") as Tier\n    const status = await getQuotaStatus(session.user.id, tier)"
  ]
 ]
}

/** (rel, text) => text: an owned file comes back as the base's file; any other file, or a file that does not carry this change's text, comes back as it is. */
export function stripTierUpdateGuard(rel, text) {
  const pairs = TIER_GUARD_PAIRS[rel]
  if (!pairs || typeof text !== 'string') return text
  let out = text
  for (const [now, before] of pairs) {
    if (out.split(now).length !== 2) return text
    out = out.replace(now, () => before)
  }
  return out
}
