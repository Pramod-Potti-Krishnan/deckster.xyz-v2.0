"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, estimateExpired, formatEstimate, type AgentChoice, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"

/**
 * AGENT-MODE-SHELL, A1 (flag NEXT_PUBLIC_AGENT_MODE, Studio shell only, default off; off, null): the estimate and the cap, "About N credits · cap M credits", shown BEFORE the paid click. The credits are reserved at Start, never here,
 * and nothing is sent until a button is clicked. Credits only. When the frame carries expires_at and it has passed, Start is off and the card says to ask again (Cancel stays); a click that lands after the expiry sends nothing.
 * `now` (ms) is for a proof: the card reads the clock itself and re-draws once at the expiry.
 */
export function AgentEstimateCard({ state, onAnswer, now }: { state: AgentRunState; now?: number } & AgentCardCallbacks) {
  if (!STUDIO_AGENT_MODE_ENABLED || state.status !== "estimate" || !state.estimate || state.runId === null || state.capCredits === null) return null
  return <EstimateBody runId={state.runId} credits={state.estimate.credits} cap={state.capCredits} expiresAt={state.estimate.expiresAt} answered={state.estimate.answered} now={now} onAnswer={onAnswer} />
}

/** The clock the card reads: `now` when a proof gives one, else the real time; with a real expiry still ahead, one timer re-draws the card at that moment (and none otherwise). */
function useClock(expiresAt: string | null, now: number | undefined): number {
  const [tick, setTick] = React.useState(0)
  React.useEffect(() => {
    if (now !== undefined || expiresAt === null) return
    const left = Date.parse(expiresAt) - Date.now()
    if (!(left > 0)) return
    const timer = setTimeout(() => setTick(t => t + 1), Math.min(left + 25, 2_000_000_000))
    return () => clearTimeout(timer)
  }, [expiresAt, now, tick])
  return now ?? Date.now()
}

function EstimateBody({ runId, credits, cap, expiresAt, answered, now, onAnswer }: { runId: string; credits: number; cap: number; expiresAt: string | null; answered: AgentChoice | null; now?: number } & AgentCardCallbacks) {
  const clock = useClock(expiresAt, now) // always called (the same hooks on every draw, answered or not)
  const expired = answered === null && estimateExpired(expiresAt, clock)
  return (
    <AgentCardFrame kind="estimate" label={AGENT_COPY.heading}>
      <AgentCardText>{formatEstimate(credits, cap)}</AgentCardText>
      {credits > cap ? <AgentCardText part="hint">{AGENT_COPY.estimateMayCap}</AgentCardText> : null}
      {expired ? <AgentCardText part="hint">{AGENT_COPY.estimateExpired}</AgentCardText> : null}
      <AgentActions>
        <AgentActionButton choice="start" primary answered={answered} disabled={expired} onClick={() => { if (!estimateExpired(expiresAt, now ?? Date.now())) onAnswer?.({ runId, card: "A1", choice: "start" }) }}>{AGENT_COPY.start}</AgentActionButton>
        <AgentActionButton choice="cancel" answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}>{AGENT_COPY.cancel}</AgentActionButton>
      </AgentActions>
    </AgentCardFrame>
  )
}
