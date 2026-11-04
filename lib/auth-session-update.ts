/**
 * Security: NextAuth `trigger === "update"` handling.
 *
 * The payload of a client `useSession().update(payload)` call is attacker-controlled. Only
 * cosmetic profile fields (name, image) may be copied from it. Every entitlement-like field
 * (tier, approved, walletBalanceCents, subscription, plan, credits, role, isInternal, premium,
 * limits, id, ...) is ignored; instead those are re-read from the server source (Prisma `User`
 * row, which the Stripe webhook and coupon redeem routes write) so a legitimate post-checkout /
 * post-redeem `update()` still refreshes them.
 */

export type ServerEntitlements = {
  tier?: string | null
  approved?: boolean | null
  walletBalanceCents?: number | null
  subscription?: { status: string; tier: string; currentPeriodEnd: string } | null
}

/** Client-update fields that may be copied into the token. Nothing else is honoured. */
export const CLIENT_UPDATABLE_FIELDS = ["name", "image"] as const

export async function applySessionUpdate<T extends Record<string, unknown>>(
  token: T,
  payload: unknown,
  loadServerEntitlements: (userId: string) => Promise<ServerEntitlements | null>,
): Promise<T> {
  const next: Record<string, unknown> = { ...token }
  const p = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>

  if (typeof p.name === "string") next.name = p.name
  if (typeof p.image === "string") next.picture = p.image

  const userId = typeof token.id === "string" ? token.id : null
  if (userId) {
    try {
      const fresh = await loadServerEntitlements(userId)
      if (fresh) {
        if (typeof fresh.tier === "string") next.tier = fresh.tier
        if (typeof fresh.approved === "boolean") next.approved = fresh.approved
        if (typeof fresh.walletBalanceCents === "number") next.walletBalanceCents = fresh.walletBalanceCents
        if (fresh.subscription !== undefined) next.subscription = fresh.subscription
      }
    } catch (error) {
      // Keep the existing (server-issued) entitlements; never fall back to the payload.
      console.error("[Auth] Entitlement refresh failed on session update:", error)
    }
  }
  return next as T
}
