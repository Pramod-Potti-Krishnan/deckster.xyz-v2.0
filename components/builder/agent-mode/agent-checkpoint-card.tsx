"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, checkpointWords, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"

/**
 * AGENT-MODE-SHELL, A3 (flag NEXT_PUBLIC_AGENT_MODE; off, null): the spend checkpoint, when the next step would take the run past 80% of its cap. "Continue with up to N more credits, or stop now?" A stop keeps the slides and the run
 * can be resumed. Nothing is sent until a button is clicked, and once one is taken both are off.
 */
export function AgentCheckpointCard({ state, onAnswer }: { state: AgentRunState } & AgentCardCallbacks) {
  const pending = state.pending
  if (!STUDIO_AGENT_MODE_ENABLED || state.runId === null || pending === null || pending.kind !== "checkpoint" || state.status === "done" || state.status === "failed") return null
  const runId = state.runId
  return (
    <AgentCardFrame kind="checkpoint" label={AGENT_COPY.heading}>
      <AgentCardText>{checkpointWords(pending.usedCredits, pending.capCredits, pending.moreCredits)}</AgentCardText>
      <AgentActions>
        <AgentActionButton choice="continue" primary answered={pending.answered} onClick={() => onAnswer?.({ runId, card: "A3", choice: "continue" })}>{AGENT_COPY.checkpointContinue}</AgentActionButton>
        <AgentActionButton choice="stop" answered={pending.answered} onClick={() => onAnswer?.({ runId, card: "A3", choice: "stop" })}>{AGENT_COPY.checkpointStop}</AgentActionButton>
      </AgentActions>
    </AgentCardFrame>
  )
}
