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
 * Wallet-debit retry (R-20261007-frontend-19, J8.1). The server turns it on: with
 * DECKSTER_QUOTA_LIVE_TIER_ENABLED the quota and debit routes answer with this
 * header, meaning "a debit is booked at most once per messageId; a repeat is
 * answered from the ledger". Only after seeing it does the hook re-send a failed
 * debit. Without it (flag off, or no answer yet) a failed debit is dropped, as before.
 * (The header name is spelled out here, not imported, so this hook gains no import:
 * scripts/test-quota-live-tier.mjs holds it equal to lib/quota/live-tier-flag.ts.)
 */
const DEBIT_IDEMPOTENT_HEADER = "x-deckster-debit-idempotent"
/** Delay before each re-send: at most two retries, so at most three requests per turn. */
const DEBIT_RETRY_DELAYS_MS = [400, 1200]

/** A network error (no response: `status === null`), a 5xx, 408 or 429. Any other 4xx is a refusal, never re-sent. */
function isRetryableDebitFailure(status: number | null): boolean {
  return status === null || status >= 500 || status === 408 || status === 429
}

/**
 * Owns the builder's quota picture. On mount it fetches the current status; on
 * each new Director turn it posts the token usage (which records the ledger row
 * and returns a fresh snapshot), so the rings stay in sync without a race.
 */
export function useQuota(
  tokenUsage: TokenUsagePayload | null,
  messageId: string | undefined,
): QuotaState {
  const { data: session } = useSession()
  const userId = session?.user?.id

  const [status, setStatus] = useState<QuotaStatus | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [lastCostCents, setLastCostCents] = useState<number | null>(null)
  const [overflow, setOverflow] = useState(false)
  const [capped, setCapped] = useState(false)

  // Whether the server said (by header, on its last answer) that a debit may be re-sent.
  const debitIdempotentRef = useRef(false)
  const userIdRef = useRef(userId)
  userIdRef.current = userId

  const processedRef = useRef<Set<string>>(new Set())
  const lastPayloadRef = useRef<string | null>(null)

  const refetch = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }
    try {
      const res = await fetch("/api/usage/quota")
      if (res.ok) {
        debitIdempotentRef.current = res.headers?.get?.(DEBIT_IDEMPOTENT_HEADER) === "1"
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

  useEffect(() => {
    refetch()
  }, [refetch])

  const debit = useCallback(
    async (msgId: string, tokens: number, actionType: string | null) => {
      if (processedRef.current.has(msgId)) return
      processedRef.current.add(msgId)

      const owner = userIdRef.current
      for (let attempt = 0; ; attempt++) {
        let res: Response | null = null
        try {
          res = await fetch("/api/wallet/debit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // The same body on every attempt: `messageId` is the idempotency key
            // (the server books `token_usage:<messageId>` once).
            body: JSON.stringify({ messageId: msgId, tokens, actionType }),
          })
        } catch {
          // Network hiccup: no response at all.
        }

        if (res && res.ok) {
          try {
            debitIdempotentRef.current = res.headers?.get?.(DEBIT_IDEMPOTENT_HEADER) === "1"
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
            processedRef.current.delete(msgId)
          }
          return
        }

        // Re-send only when the server has said a repeat is safe, only for a
        // network error / 5xx / 408 / 429, and never into a different account.
        const retryable =
          debitIdempotentRef.current &&
          attempt < DEBIT_RETRY_DELAYS_MS.length &&
          isRetryableDebitFailure(res ? res.status : null)
        if (!retryable) {
          // Not booked as far as this tab knows: the idempotent sourceRef makes a
          // later delivery of the same turn safe.
          processedRef.current.delete(msgId)
          return
        }
        await new Promise<void>((resolve) => setTimeout(resolve, DEBIT_RETRY_DELAYS_MS[attempt]))
        if (userIdRef.current !== owner) {
          processedRef.current.delete(msgId)
          return
        }
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

    debit(messageId, turnTokens, tokenUsage.action_type)
  }, [tokenUsage, messageId, debit])

  return { status, isLoading, lastCostCents, overflow, capped, refetch }
}
