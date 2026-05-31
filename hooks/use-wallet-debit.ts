import { useEffect, useRef, useState, useCallback } from "react"
import type { TokenUsagePayload } from "@/hooks/use-deckster-websocket-v2"

interface WalletDebitState {
  balanceCents: number | null
  lastCostCents: number | null
  isLowBalance: boolean
  insufficientFunds: boolean
}

const LOW_BALANCE_THRESHOLD_CENTS = 200

export function useWalletDebit(
  tokenUsage: TokenUsagePayload | null,
  messageId: string | undefined,
) {
  const [state, setState] = useState<WalletDebitState>({
    balanceCents: null,
    lastCostCents: null,
    isLowBalance: false,
    insufficientFunds: false,
  })

  const processedRef = useRef<Set<string>>(new Set())
  const lastPayloadRef = useRef<string | null>(null)

  const debit = useCallback(async (msgId: string, tokens: number, actionType: string | null) => {
    if (processedRef.current.has(msgId)) return
    processedRef.current.add(msgId)

    try {
      const res = await fetch("/api/wallet/debit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: msgId, tokens, actionType }),
      })

      const data = await res.json()

      if (res.status === 402) {
        setState({
          balanceCents: data.balanceCents ?? 0,
          lastCostCents: data.costCents,
          isLowBalance: true,
          insufficientFunds: true,
        })
        return
      }

      if (res.ok) {
        setState({
          balanceCents: data.balanceCents,
          lastCostCents: data.costCents,
          isLowBalance: (data.balanceCents ?? 0) < LOW_BALANCE_THRESHOLD_CENTS,
          insufficientFunds: false,
        })
      }
    } catch {
      // Network error — don't block the user, just skip the debit attempt.
      // The sourceRef idempotency means we can safely retry next time.
      processedRef.current.delete(msgId)
    }
  }, [])

  useEffect(() => {
    if (!tokenUsage || !messageId) return

    const turnTokens = tokenUsage.turn?.total_tokens
    if (!turnTokens || turnTokens <= 0) return

    const payloadKey = `${messageId}:${turnTokens}`
    if (payloadKey === lastPayloadRef.current) return
    lastPayloadRef.current = payloadKey

    debit(messageId, turnTokens, tokenUsage.action_type)
  }, [tokenUsage, messageId, debit])

  return state
}
