import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth-options"
import { getBalance, getTransactions } from "@/lib/wallet"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const [balanceCents, transactions] = await Promise.all([
      getBalance(session.user.id),
      getTransactions(session.user.id, 20),
    ])

    return NextResponse.json({ balanceCents, transactions })
  } catch (error) {
    console.error("[api/wallet/balance] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
