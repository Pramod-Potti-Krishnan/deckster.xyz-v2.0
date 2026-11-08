"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, researchOfferWords, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"

/**
 * AGENT-MODE-SHELL, A4 (flag NEXT_PUBLIC_AGENT_MODE; off, null): the agent asks before it researches deeper than the plan you approved. "Deeper research on slides 3-5 adds about N credits. Add it?"
 * The agent never escalates on its own; nothing is sent until a button is clicked.
 */
export function AgentResearchOfferCard({ state, onAnswer }: { state: AgentRunState } & AgentCardCallbacks) {
  const pending = state.pending
  if (!STUDIO_AGENT_MODE_ENABLED || state.runId === null || pending === null || pending.kind !== "research_offer" || state.status === "done" || state.status === "failed") return null
  const runId = state.runId
  return (
    <AgentCardFrame kind="research_offer" label={AGENT_COPY.heading}>
      <AgentCardText>{researchOfferWords(pending.slides, pending.extraCredits)}</AgentCardText>
      <AgentActions>
        <AgentActionButton choice="add" primary answered={pending.answered} onClick={() => onAnswer?.({ runId, card: "research_offer", choice: "add" })}>{AGENT_COPY.researchAdd}</AgentActionButton>
        <AgentActionButton choice="skip" answered={pending.answered} onClick={() => onAnswer?.({ runId, card: "research_offer", choice: "skip" })}>{AGENT_COPY.researchSkip}</AgentActionButton>
      </AgentActions>
    </AgentCardFrame>
  )
}
