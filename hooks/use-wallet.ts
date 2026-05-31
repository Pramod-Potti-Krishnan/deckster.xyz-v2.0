import { useEffect, useState, useCallback } from "react"
import { useSession } from "next-auth/react"

interface WalletTransaction {
  id: string
  type: "credit" | "debit"
  amountCents: number
  reason: string
  balanceAfterCents: number
  sourceRef: string | null
  createdAt: string
}

interface WalletState {
  balanceCents: number
  transactions: WalletTransaction[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

export function useWallet(): WalletState {
  const { data: session } = useSession()
  const [balanceCents, setBalanceCents] = useState(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const userId = session?.user?.id

  const fetchWallet = useCallback(async () => {
    if (!userId) {
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/wallet/balance")
      if (res.ok) {
        const data = await res.json()
        setBalanceCents(data.balanceCents)
        setTransactions(data.transactions)
        setError(null)
      } else {
        setError("Failed to load wallet")
      }
    } catch {
      setError("Failed to load wallet")
    } finally {
      setIsLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchWallet()
  }, [fetchWallet])

  return { balanceCents, transactions, isLoading, error, refetch: fetchWallet }
}
