import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getQuotaStatus, type Tier } from "@/lib/quota/quota"
import { resolveQuotaTier } from "@/lib/quota/live-tier"
import { quotaLiveTierResponseInit } from "@/lib/quota/live-tier-flag"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const sessionTier = (session.user.tier ?? "free") as Tier
    // Flag DECKSTER_QUOTA_LIVE_TIER_ENABLED (default off): the live database tier
    // instead of the session JWT's. Off returns `sessionTier` without a read.
    const tier = await resolveQuotaTier(session.user.id, sessionTier)
    const status = await getQuotaStatus(session.user.id, tier)

    return NextResponse.json(status, quotaLiveTierResponseInit())
  } catch (error) {
    console.error("[api/usage/quota] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
