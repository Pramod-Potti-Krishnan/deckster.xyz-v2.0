"use client"

import { useState } from "react"
import { Loader2, Wallet } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import "@/components/builder/studio-usage-topup.css"

const CREDIT_PACKS = [
  { id: "pack_10", label: "$10", amountCents: 1000 },
  { id: "pack_25", label: "$25", amountCents: 2500 },
  { id: "pack_50", label: "$50", amountCents: 5000 },
  { id: "pack_100", label: "$100", amountCents: 10000 },
] as const

interface TopUpModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional context line, e.g. "You've hit your daily limit." */
  reason?: string
}

/**
 * Fast top-up path from the builder. Reserve credits never expire and are used
 * once a plan cap is reached. Reuses the existing Stripe checkout session.
 */
export function TopUpModal({ open, onOpenChange, reason }: TopUpModalProps) {
  const studioShell = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
  const [loadingPack, setLoadingPack] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const startCheckout = async (packId: string) => {
    setLoadingPack(packId)
    setError(null)
    try {
      const res = await fetch("/api/stripe/create-topup-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      })
      const data = await res.json()
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setError(data.error || "Could not start checkout. Please try again.")
    } catch {
      setError("Could not start checkout. Please try again.")
    } finally {
      setLoadingPack(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-studio-topup={studioShell ? "true" : undefined}>
        <DialogHeader data-studio-topup-header={studioShell ? "true" : undefined}>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-purple-600" />
            Add reserve credits
          </DialogTitle>
          <DialogDescription>
            {reason ? `${reason} ` : ""}
            Reserve credits don&apos;t expire and keep you generating once a plan limit is reached.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 pt-2" data-studio-topup-packs={studioShell ? "true" : undefined}>
          {CREDIT_PACKS.map((pack) => (
            <button
              key={pack.id}
              type="button"
              data-studio-topup-pack={studioShell ? pack.id : undefined}
              aria-label={studioShell ? `Start checkout for ${pack.label} reserve credits` : undefined}
              disabled={loadingPack !== null}
              onClick={() => startCheckout(pack.id)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-semibold transition-colors hover:border-purple-400 hover:bg-purple-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:hover:bg-purple-950/30",
              )}
            >
              {loadingPack === pack.id ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                pack.label
              )}
            </button>
          ))}
        </div>

        {error && <p className="pt-1 text-xs text-red-600" role={studioShell ? "alert" : undefined} data-studio-topup-error={studioShell ? "true" : undefined}>{error}</p>}
      </DialogContent>
    </Dialog>
  )
}
