import { useCallback, useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import type { TokenUsagePayload } from "@/hooks/use-deckster-websocket-v2"

export interface QuotaStatus {
  tier: "free" | "starter" | "pro" | "premium"
  tierLabel: string
  caps: { monthlyCents: number; weeklyCents: number; dailyCents: number }
  spent: { dailyCents: number; weeklyCents: number; monthlyCents: number }
  remainingPct: { daily: number; weekly: number; monthly: number }
  flags: { dailyNear: boolean; dailyAt: boolean; weeklyNear: boolean; weeklyAt: boolean }
  walletBalanceCents: number
  resetAt: { daily: string; weekly: string }
  totals: {
    monthTokens: number
    monthSpendCents: number
    lifetimeTokens: number
    lifetimeSpendCents: number
  }
}

export interface QuotaState {
  status: QuotaStatus | null
  isLoading: boolean
  lastCostCents: number | null
  /** Last turn drew from the prepaid reserve (over a plan cap). */
  overflow: boolean
  /** Hit a cap but the reserve couldn't cover it — block further sends. */
  capped: boolean
  refetch: () => Promise<void>
}

/**
 * Owns the builder's quota picture. On mount it fetches the current status; on
 * each new Director turn it posts the token usage (which records the ledger row
 * and returns a fresh snapshot), so the rings stay in sync without a race.
 */
export function useQuota(
  tokenUsage: TokenUsagePayload | null,
  messageId: string | undefined,
  options?: {
    /**
     * Studio (flag NEXT_PUBLIC_STUDIO_TURN_PATHS_QUOTA_GATE_ENABLED, default off):
     * once the wallet debit for a turn's token usage has settled, read
     * /api/usage/quota again so the snapshot the send gate uses reflects what the
     * server has booked (this tab's debit, and any other tab's spend). Absent or
     * false: exactly the old behaviour.
     */
    refreshAfterSpend?: boolean
  },
): QuotaState {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const [status, setStatus] = useState<QuotaStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastCostCents, setLastCostCents] = useState<number | null>(null)
  const [overflow, setOverflow] = useState(false)
  const [capped, setCapped] = useState(false)

  const processedRef = useRef<Set<string>>(new Set())
  const lastPayloadRef = useRef<string | null>(null)
  const refreshAfterSpendRef = useRef(false)
  refreshAfterSpendRef.current = options?.refreshAfterSpend === true
  const refetchRef = useRef<() => Promise<void>>(async () => {})

  const refetch = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }
    try {
      const res = await fetch("/api/usage/quota")
      if (res.ok) {
        const data: QuotaStatus = await res.json()
        setStatus(data)
        setCapped(data.flags.dailyAt || data.flags.weeklyAt)
      }
    } catch {
      // Non-fatal: keep the last known status.
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  refetchRef.current = refetch

  useEffect(() => {
    refetch()
  }, [refetch])

  const debit = useCallback(
    async (msgId: string, tokens: number, actionType: string | null) => {
      if (processedRef.current.has(msgId)) return
      processedRef.current.add(msgId)

      try {
        const res = await fetch("/api/wallet/debit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messageId: msgId, tokens, actionType }),
        })
        if (!res.ok) {
          processedRef.current.delete(msgId)
          return
        }
        const data = await res.json()
        if (data.quota) {
          setStatus(data.quota as QuotaStatus)
          setCapped(
            Boolean(data.capped) ||
              data.quota.flags.dailyAt ||
              data.quota.flags.weeklyAt,
          )
        }
        setLastCostCents(typeof data.costCents === "number" ? data.costCents : null)
        setOverflow(Boolean(data.deducted))
      } catch {
        // Network hiccup — idempotent sourceRef makes a retry safe next turn.
        processedRef.current.delete(msgId)
      }
    },
    [],
  )

  useEffect(() => {
    if (!tokenUsage || !messageId) return
    const turnTokens = tokenUsage.turn?.total_tokens
    if (!turnTokens || turnTokens <= 0) return

    const payloadKey = `${messageId}:${turnTokens}`
    if (payloadKey === lastPayloadRef.current) return
    lastPayloadRef.current = payloadKey

    const settled = debit(messageId, turnTokens, tokenUsage.action_type)
    if (refreshAfterSpendRef.current) void settled.then(() => refetchRef.current())
  }, [tokenUsage, messageId, debit])

  return { status, isLoading, lastCostCents, overflow, capped, refetch }
}
