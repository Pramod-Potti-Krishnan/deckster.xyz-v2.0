"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, formatEstimate, type AgentChoice, type AgentRunState } from "@/lib/studio-agent-mode" // AGENT-MODE-WIRE
import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"

/**
 * AGENT-MODE-SHELL, A1 (flag NEXT_PUBLIC_AGENT_MODE, Studio shell only, default off; off, null): the estimate and the cap, "Estimated cost: About N credits · cap M credits · Running". It is INFORMATION, not a gate (PK ruling): (AGENT-MODE-WIRE)
 * the spend began at the Agent send, Director already has the run going when this shows (A1 "start" is only an acknowledgement there), so there is no Start. The one button is Stop, which sends A1 "cancel" (the wire contract (AGENT-MODE-WIRE)
 * is unchanged); once answered it is off. Credits only. Nothing is sent until the button is clicked. The estimate's expires_at is not read here: with no Start there is nothing to expire (a cancel was never expiry-gated). (AGENT-MODE-WIRE)
 */
export function AgentEstimateCard({ state, onAnswer }: { state: AgentRunState } & AgentCardCallbacks) { // AGENT-MODE-WIRE
  if (!STUDIO_AGENT_MODE_ENABLED || state.status !== "estimate" || !state.estimate || state.runId === null || state.capCredits === null) return null
  return <EstimateBody runId={state.runId} credits={state.estimate.credits} cap={state.capCredits} answered={state.estimate.answered} onAnswer={onAnswer} /> // AGENT-MODE-WIRE
}

function EstimateBody({ runId, credits, cap, answered, onAnswer }: { runId: string; credits: number; cap: number; answered: AgentChoice | null } & AgentCardCallbacks) { // AGENT-MODE-WIRE
  return (
    <AgentCardFrame kind="estimate" label={AGENT_COPY.heading}>
      <AgentCardText>{`${AGENT_COPY.estimateLabel}: ${formatEstimate(credits, cap)} · ${AGENT_COPY.estimateRunning}`}</AgentCardText>{/* AGENT-MODE-WIRE */}
      {credits > cap ? <AgentCardText part="hint">{AGENT_COPY.estimateMayCap}</AgentCardText> : null}
      {/* AGENT-MODE-WIRE: #607's "This estimate has expired" line is not here, the card does not read expires_at */}
      <AgentActions>
        <AgentActionButton choice="cancel" answered={answered} onClick={() => onAnswer?.({ runId, card: "A1", choice: "cancel" })}>{AGENT_COPY.stop}</AgentActionButton>{/* AGENT-MODE-WIRE */}
      </AgentActions>
    </AgentCardFrame>
  )
}
