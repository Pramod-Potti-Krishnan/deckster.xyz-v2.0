"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Coins, Info } from "lucide-react"
import type { TokenUsagePayload } from "@/hooks/use-deckster-websocket-v2"
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

export function TokenUsageStrip({ tokenUsage }: TokenUsageStripProps) {
  const sessionTotal = tokenUsage?.session?.total_tokens ?? 0
  const turnTotal = tokenUsage?.turn?.total_tokens ?? 0
  const actionLabel = useMemo(
    () => formatActionLabel(tokenUsage?.action_type),
    [tokenUsage?.action_type]
  )
  const isPartial = tokenUsage?.coverage === "partial"
  const hasUsage = Boolean(tokenUsage)

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

  return (
    <div className="border-b border-gray-100 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-900">
      <div className="rounded-md px-1 py-1">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <Coins className="h-3.5 w-3.5 shrink-0 text-purple-600 dark:text-purple-300" />
              <span className="text-[11px] font-medium text-gray-600 dark:text-slate-400">Token usage</span>
              <span className="text-[11px] font-semibold text-gray-900 dark:text-slate-100">
                {formatNumber(displayTotal)}
              </span>
              <span className="text-[10px] text-gray-500 dark:text-slate-500">used</span>
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
            <p className="mt-0.5 truncate text-[10px] text-gray-500 dark:text-slate-500">{usageCopy}</p>
          </div>

          {hasUsage && (
            <div
              className={cn(
                "shrink-0 rounded-full border border-purple-100 bg-white px-2 py-1 text-[10px] font-semibold text-purple-700 shadow-sm transition-all duration-300",
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
  )
}
