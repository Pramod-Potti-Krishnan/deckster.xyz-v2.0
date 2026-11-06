// FRONTEND-1 (L-BILLING B3, PROGRAM-1 ruling). Pre-build cap check: the client calls GET /api/wallet/precheck before it sends a build or a turn.
// WALLET_DEBIT_SOURCE unset / "flat" / "router": always 200 { ok: true, checked: false } and nothing is read (today's behaviour: no refusal anywhere).
// "flat_strict": 402 { code: "wallet_capped" } when a 1-cent charge no longer fits the plan caps and the top-up balance is empty; otherwise 200 { ok: true, checked: true }.
import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getServerTier } from "@/lib/quota/server-tier"
import { getQuotaStatus, fitsWithinCaps } from "@/lib/quota/quota"
import { preBuildCapCheck, preBuildRefused, CAPPED_STATUS, CAPPED_CODE } from "@/lib/billing/wallet-debit-source"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!preBuildCapCheck()) return NextResponse.json({ ok: true, checked: false }, { headers: { "Cache-Control": "no-store" } })
  try {
    // Tier from the database, never the session (#575).
    const quota = await getQuotaStatus(session.user.id, await getServerTier(session.user.id))
    if (preBuildRefused(true, fitsWithinCaps(quota.caps, quota.spent, 1), quota.walletBalanceCents)) {
      return NextResponse.json({ error: "Plan credits and top-up balance are used up", code: CAPPED_CODE, capped: true, quota }, { status: CAPPED_STATUS, headers: { "Cache-Control": "no-store" } })
    }
    return NextResponse.json({ ok: true, checked: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("[api/wallet/precheck] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
