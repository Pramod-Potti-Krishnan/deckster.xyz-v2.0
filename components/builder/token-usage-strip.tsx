"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Coins, Info, Wallet, AlertTriangle, Plus } from "lucide-react"
import type { TokenUsagePayload } from "@/hooks/use-deckster-websocket-v2"
import type { QuotaState } from "@/hooks/use-quota"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface TokenUsageStripProps {
  tokenUsage: TokenUsagePayload | null
  quota?: QuotaState
  onTopUp?: () => void
}

const ACTION_LABELS: Record<string, string> = {
  GENERATE_STRAWMAN: "Strawman generation",
  PROPOSE_PLAN: "Plan proposal",
  REFINE_STRAWMAN: "Strawman refinement",
  RESPOND: "Response",
  ASK_QUESTIONS: "Clarification",
  INVOKE_TOOLS: "Tool use",
  COMPLETE: "Completion",
}

const numberFormatter = new Intl.NumberFormat("en-US")

function formatNumber(value: number): string {
  return numberFormatter.format(Math.max(0, Math.round(value || 0)))
}

function formatActionLabel(actionType: string | null | undefined): string {
  if (!actionType) return "Latest turn"
  if (ACTION_LABELS[actionType]) return ACTION_LABELS[actionType]

  return actionType
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
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

interface QuotaRingProps {
  label: string
  remaining: number // 0..1 still available
  near: boolean
  at: boolean
}

function QuotaRing({ label, remaining, near, at }: QuotaRingProps) {
  const size = 34
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const dash = circumference * Math.max(0, Math.min(1, remaining))
  const color = at ? "text-red-500" : near ? "text-amber-500" : "text-emerald-500"

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            className="stroke-gray-200 dark:stroke-slate-700"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circumference}`}
            className={cn("transition-all duration-700 ease-out", color)}
            stroke="currentColor"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-gray-700 dark:text-slate-200">
          {Math.round(remaining * 100)}
        </span>
      </div>
      <span className="text-[8px] font-medium uppercase tracking-wide text-gray-500 dark:text-slate-500">
        {label}
      </span>
    </div>
  )
}

export function TokenUsageStrip({ tokenUsage, quota, onTopUp }: TokenUsageStripProps) {
  const sessionTotal = tokenUsage?.session?.total_tokens ?? 0
  const turnTotal = tokenUsage?.turn?.total_tokens ?? 0
  const actionLabel = useMemo(
    () => formatActionLabel(tokenUsage?.action_type),
    [tokenUsage?.action_type]
  )
  const isPartial = tokenUsage?.coverage === "partial"
  const hasUsage = Boolean(tokenUsage)

  const status = quota?.status ?? null
  const flags = status?.flags
  const showWarning = Boolean(flags && (flags.dailyNear || flags.dailyAt || flags.weeklyNear || flags.weeklyAt))
  const hasReserve = (status?.walletBalanceCents ?? 0) > 0

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

  const usageCopy = hasUsage
    ? `${actionLabel} cost ${formatNumber(turnTotal)} tokens`
    : "Waiting for first usage update"

  const lastCostCents = quota?.lastCostCents ?? null

  return (
    <div className="border-b border-gray-100 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-md px-1 py-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-300" />
              {status && (
                <Badge
                  variant="outline"
                  className="h-4 border-purple-200 bg-purple-50 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wide text-purple-700 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                >
                  {status.tierLabel}
                </Badge>
              )}
              <span className="text-[11px] font-semibold text-gray-900 dark:text-slate-100">
                {formatNumber(displayTotal)}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-slate-500">used this session</span>
              {hasUsage && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant="outline"
                        className={cn(
                          "h-4 gap-1 px-1.5 py-0 text-[9px] font-medium uppercase tracking-normal",
                          isPartial
                            ? "border-amber-200 bg-amber-50 text-amber-700"
                            : "border-emerald-200 bg-emerald-50 text-emerald-700"
                        )}
                      >
                        {isPartial ? "estimated" : "tracked"}
                        {isPartial && <Info className="h-2.5 w-2.5" />}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-56 text-xs">
                      {isPartial
                        ? "Estimated: this total is a lower bound until all Director subservices report internal usage."
                        : "Full token accounting is available for this turn."}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <p className="truncate text-[10px] text-gray-500 dark:text-slate-500">{usageCopy}</p>
              {hasUsage && lastCostCents != null && lastCostCents > 0 && (
                <span className="text-[10px] text-gray-400 dark:text-slate-600">
                  ({formatCents(lastCostCents)})
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {status && (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2">
                      <QuotaRing
                        label="Day"
                        remaining={status.remainingPct.daily}
                        near={status.flags.dailyNear}
                        at={status.flags.dailyAt}
                      />
                      <QuotaRing
                        label="Week"
                        remaining={status.remainingPct.weekly}
                        near={status.flags.weeklyNear}
                        at={status.flags.weeklyAt}
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-64 space-y-1 text-xs">
                    <div className="font-semibold">{status.tierLabel} plan budget</div>
                    <div className="flex justify-between gap-4">
                      <span>Today</span>
                      <span>
                        {formatCents(status.spent.dailyCents)} / {formatCents(status.caps.dailyCents)}
                        <span className="ml-1 text-gray-400">· resets in {formatResetIn(status.resetAt.daily)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>This week</span>
                      <span>
                        {formatCents(status.spent.weeklyCents)} / {formatCents(status.caps.weeklyCents)}
                        <span className="ml-1 text-gray-400">· resets in {formatResetIn(status.resetAt.weekly)}</span>
                      </span>
                    </div>
                    <div className="flex justify-between gap-4">
                      <span>This month</span>
                      <span>
                        {formatCents(status.spent.monthlyCents)} / {formatCents(status.caps.monthlyCents)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-4 border-t border-gray-200 pt-1 dark:border-slate-700">
                      <span>Top-up reserve</span>
                      <span>{formatCents(status.walletBalanceCents)}</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {status && (
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-semibold",
                  !hasReserve && (status.flags.dailyAt || status.flags.weeklyAt)
                    ? "border-red-200 bg-red-50 text-red-700"
                    : hasReserve
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-gray-200 bg-gray-50 text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {!hasReserve && (status.flags.dailyAt || status.flags.weeklyAt) ? (
                  <AlertTriangle className="h-3 w-3" />
                ) : (
                  <Wallet className="h-3 w-3" />
                )}
                {formatCents(status.walletBalanceCents)}
              </div>
            )}

            {onTopUp && showWarning && (
              <button
                type="button"
                onClick={onTopUp}
                className="flex items-center gap-1 rounded-full bg-purple-600 px-2 py-1 text-[10px] font-semibold text-white transition-colors hover:bg-purple-700"
              >
                <Plus className="h-3 w-3" />
                Top up
              </button>
            )}

            {hasUsage && (
              <div
                className={cn(
                  "rounded-full border border-purple-100 bg-white px-2 py-1 text-[10px] font-semibold text-purple-700 shadow-sm transition-all duration-300",
                  showDelta ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
                )}
                aria-hidden={!showDelta}
              >
                +{formatNumber(turnTotal)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
