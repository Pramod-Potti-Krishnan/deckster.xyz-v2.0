"use client"

import { useEffect, useRef, useState } from "react"
import { Coins, AlertTriangle, Plus } from "lucide-react"
import type { TokenUsagePayload } from "@/hooks/use-deckster-websocket-v2"
import type { QuotaState } from "@/hooks/use-quota"
import { cn } from "@/lib/utils"

interface TokenUsageStripProps {
  tokenUsage: TokenUsagePayload | null
  quota?: QuotaState
  onTopUp?: () => void
}

const numberFormatter = new Intl.NumberFormat("en-US")

function formatNumber(value: number): string {
  return numberFormatter.format(Math.max(0, Math.round(value || 0)))
}

function formatResetIn(iso: string | undefined): string {
  if (!iso) return ""
  const ms = new Date(iso).getTime() - Date.now()
  if (!Number.isFinite(ms) || ms <= 0) return "soon"
  const totalMinutes = Math.round(ms / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours >= 24) return `${Math.round(hours / 24)}d`
  if (hours >= 1) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export function TokenUsageStrip({ tokenUsage, quota, onTopUp }: TokenUsageStripProps) {
  const sessionTotal = tokenUsage?.session?.total_tokens ?? 0
  const turnTotal = tokenUsage?.turn?.total_tokens ?? 0
  const hasUsage = Boolean(tokenUsage)
  const coverage = tokenUsage?.coverage === "full" ? "full" : "partial"
  const coverageLabel = coverage === "full" ? "Final" : "Partial"
  const coverageTitle =
    coverage === "full"
      ? "All reported service tokens are included."
      : "Some services' tokens aren't counted yet, so the true total may be higher."

  const status = quota?.status ?? null
  const flags = status?.flags
  const showWarning = Boolean(flags && (flags.dailyNear || flags.dailyAt || flags.weeklyNear || flags.weeklyAt))
  const isAtLimit = Boolean(flags && (flags.dailyAt || flags.weeklyAt))

  // Animated session counter
  const [displayTotal, setDisplayTotal] = useState(sessionTotal)
  const [showDelta, setShowDelta] = useState(false)
  const animationFrameRef = useRef<number | null>(null)
  const hideDeltaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const displayTotalRef = useRef(sessionTotal)

  useEffect(() => {
    displayTotalRef.current = displayTotal
  }, [displayTotal])

  useEffect(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current)
    }

    const start = displayTotalRef.current
    const end = sessionTotal
    const duration = 700
    const startedAt = performance.now()

    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayTotal(start + (end - start) * eased)

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick)
      } else {
        animationFrameRef.current = null
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [sessionTotal])

  useEffect(() => {
    if (!tokenUsage || turnTotal <= 0) return

    setShowDelta(true)
    if (hideDeltaTimeoutRef.current) {
      clearTimeout(hideDeltaTimeoutRef.current)
    }

    hideDeltaTimeoutRef.current = setTimeout(() => {
      setShowDelta(false)
      hideDeltaTimeoutRef.current = null
    }, 4500)

    return () => {
      if (hideDeltaTimeoutRef.current) {
        clearTimeout(hideDeltaTimeoutRef.current)
        hideDeltaTimeoutRef.current = null
      }
    }
  }, [tokenUsage?.action_type, sessionTotal, turnTotal])

  return (
    <div className="border-b border-gray-100 bg-white dark:border-slate-800 dark:bg-slate-900">
      {/* Minimal session counter — always visible */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          <Coins className="h-3 w-3 shrink-0 text-gray-400 dark:text-slate-500" />
          <span className="text-[11px] tabular-nums font-medium text-gray-500 dark:text-slate-400">
            {formatNumber(displayTotal)}
          </span>
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            tokens this session
          </span>
          <span
            className={cn(
              "rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-none",
              coverage === "full"
                ? "border-emerald-100 bg-emerald-50 text-emerald-600 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-300"
                : "border-amber-100 bg-amber-50 text-amber-600 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-300"
            )}
            title={coverageTitle}
            aria-label={`Token usage coverage: ${coverageLabel}`}
          >
            {coverageLabel}
          </span>
        </div>

        {/* Delta badge — fades in/out on each turn */}
        {hasUsage && (
          <div
            className={cn(
              "rounded-full border border-purple-100 bg-white px-2 py-0.5 text-[10px] font-semibold tabular-nums text-purple-600 shadow-sm transition-all duration-300 dark:border-purple-900 dark:bg-slate-800 dark:text-purple-300",
              showDelta ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            )}
            aria-hidden={!showDelta}
          >
            +{formatNumber(turnTotal)}
          </div>
        )}
      </div>

      {/* Warning banner — only when near or at a limit */}
      {showWarning && (
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] font-medium",
            isAtLimit
              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
              : "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
          )}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {isAtLimit
                ? `${flags?.dailyAt ? "Daily" : "Weekly"} limit reached — resets ${formatResetIn(flags?.dailyAt ? status?.resetAt.daily : status?.resetAt.weekly)}`
                : `Approaching ${flags?.dailyNear ? "daily" : "weekly"} limit`}
            </span>
          </div>
          {onTopUp && (
            <button
              type="button"
              onClick={onTopUp}
              className="flex shrink-0 items-center gap-1 rounded-full bg-purple-600 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors hover:bg-purple-700"
            >
              <Plus className="h-3 w-3" />
              Top up
            </button>
          )}
        </div>
      )}
    </div>
  )
}
