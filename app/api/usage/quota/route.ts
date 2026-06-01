import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getQuotaStatus, type Tier } from "@/lib/quota/quota"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const tier = (session.user.tier ?? "free") as Tier
    const status = await getQuotaStatus(session.user.id, tier)

    return NextResponse.json(status)
  } catch (error) {
    console.error("[api/usage/quota] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
