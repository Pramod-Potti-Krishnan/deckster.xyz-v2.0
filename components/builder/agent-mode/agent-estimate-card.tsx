"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, formatEstimate, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"

/**
 * AGENT-MODE-SHELL, A1 (flag NEXT_PUBLIC_AGENT_MODE, Studio shell only, default off; off, null): the estimate and the cap, shown BEFORE the paid click. The credits are reserved at Start, never here,
 * and nothing is sent until a button is clicked. Credits only.
 */
export function AgentEstimateCard({ state, onAnswer }: { state: AgentRunState } & AgentCardCallbacks) {
  if (!STUDIO_AGENT_MODE_ENABLED || state.status !== "estimate" || !state.estimate || state.runId === null || state.capCredits === null) return null
  const { low, high, answered } = state.estimate, runId = state.runId
  return (
    <AgentCardFrame kind="estimate" label={AGENT_COPY.heading}>
      <AgentCardText>{formatEstimate(low, high, state.capCredits)}</AgentCardText>
      {high > state.capCredits ? <AgentCardText part="hint">{AGENT_COPY.estimateMayCap}</AgentCardText> : null}
      <AgentActions>
        <AgentActionButton choice="start" primary answered={answered} onClick={() => onAnswer?.({ runId, card: "estimate", choice: "start" })}>{AGENT_COPY.start}</AgentActionButton>
        <AgentActionButton choice="cancel" answered={answered} onClick={() => onAnswer?.({ runId, card: "estimate", choice: "cancel" })}>{AGENT_COPY.cancel}</AgentActionButton>
      </AgentActions>
    </AgentCardFrame>
  )
}
