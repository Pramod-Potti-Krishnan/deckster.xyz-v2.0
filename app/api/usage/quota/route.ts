import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getServerTier } from "@/lib/quota/server-tier"
import { getQuotaStatus, type Tier } from "@/lib/quota/quota"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Security: tier comes from the database, never from the (client-influenced) session.
    const tier = await getServerTier(session.user.id)
    const status = await getQuotaStatus(session.user.id, tier)

    return NextResponse.json(status)
  } catch (error) {
    console.error("[api/usage/quota] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
