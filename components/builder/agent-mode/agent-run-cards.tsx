"use client"

import React from "react"
import { STUDIO_AGENT_MODE_ENABLED, type AgentAnswer, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentCheckpointCard } from "./agent-checkpoint-card"
import { AgentEstimateCard } from "./agent-estimate-card"
import { AgentFailedCard } from "./agent-failed-card"
import { AgentResearchOfferCard } from "./agent-research-offer-card"
import { AgentRunCard, type AgentControl } from "./agent-run-card"

/**
 * AGENT-MODE-SHELL: the one mount for the agent's cards, drawn from the reducer's state (lib/studio-agent-mode.ts, agentRunReducer): the estimate (information: the spend began at the Agent send), then the run card, then (AGENT-MODE-WIRE)
 * whichever of A3 / A4 / A6 is open (an A3 / A4 card that arrives after run_status "stopped" shows beside the run card: the run is stopped and resumable while it shows). Flag NEXT_PUBLIC_AGENT_MODE off (or the Studio shell off), or no run yet: null,
 * no wrapper. The host passes the two callbacks and sends nothing from here. (AGENT-MODE-WIRE)
 */
export function AgentRunCards({ state, onAnswer, onControl }: { state: AgentRunState; onAnswer?: (answer: AgentAnswer) => void; onControl?: (action: AgentControl) => void }) { // AGENT-MODE-WIRE
  if (!STUDIO_AGENT_MODE_ENABLED || state.status === "idle") return null
  return (
    <>
      <AgentEstimateCard state={state} onAnswer={onAnswer} />{/* AGENT-MODE-WIRE */}
      <AgentRunCard state={state} onControl={onControl} />
      <AgentCheckpointCard state={state} onAnswer={onAnswer} />
      <AgentResearchOfferCard state={state} onAnswer={onAnswer} />
      <AgentFailedCard state={state} onAnswer={onAnswer} />
    </>
  )
}
