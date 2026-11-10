"use client"

import React from "react"
import { STUDIO_AGENT_MODE_ENABLED, type AgentAnswer, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentCheckpointCard } from "./agent-checkpoint-card"
import { AgentEstimateCard } from "./agent-estimate-card"
import { AgentFailedCard } from "./agent-failed-card"
import { AgentResearchOfferCard } from "./agent-research-offer-card"
import { AgentRunCard, type AgentControl } from "./agent-run-card"

/**
 * AGENT-MODE-SHELL: the one mount for the agent's cards, drawn from the reducer's state (lib/studio-agent-mode.ts, agentRunReducer): the estimate before the paid click, then the run card, then
 * whichever of A3 / A4 / A6 is open (an A3 / A4 card that arrives after run_status "stopped" shows beside the run card: the run is stopped and resumable while it shows). Flag NEXT_PUBLIC_AGENT_MODE off (or the Studio shell off), or no run yet: null,
 * no wrapper. The host passes the two callbacks and sends nothing from here; `now` (ms) is for a proof of the estimate's expiry.
 */
export function AgentRunCards({ state, onAnswer, onControl, now }: { state: AgentRunState; onAnswer?: (answer: AgentAnswer) => void; onControl?: (action: AgentControl) => void; now?: number }) {
  if (!STUDIO_AGENT_MODE_ENABLED || state.status === "idle") return null
  return (
    <>
      <AgentEstimateCard state={state} onAnswer={onAnswer} now={now} />
      <AgentRunCard state={state} onControl={onControl} />
      <AgentCheckpointCard state={state} onAnswer={onAnswer} />
      <AgentResearchOfferCard state={state} onAnswer={onAnswer} />
      <AgentFailedCard state={state} onAnswer={onAnswer} />
    </>
  )
}
