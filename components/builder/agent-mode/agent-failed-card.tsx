"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, failedFallbackWords, failedMoneyWords, failedSlidesWords, failedStopWords, type AgentRunState } from "@/lib/studio-agent-mode"
import { AgentActionButton, AgentActions, AgentCardFrame, AgentCardText, type AgentCardCallbacks } from "./agent-card-parts"

/**
 * AGENT-MODE-SHELL, A6 (flag NEXT_PUBLIC_AGENT_MODE; off, null): a run that failed says what stopped, what was charged and what came back, and what is left of the deck. NO SILENT FALLBACK: a fallback is
 * only ever an explicit button the person clicks (and only when Director offered one, with its price); with none offered the one button is OK. The card sends nothing by itself.
 */
export function AgentFailedCard({ state, onAnswer }: { state: AgentRunState } & AgentCardCallbacks) {
  const failure = state.failure
  if (!STUDIO_AGENT_MODE_ENABLED || state.runId === null || state.status !== "failed" || failure === null) return null
  const runId = state.runId, offered = failure.fallbackCredits !== null
  return (
    <AgentCardFrame kind="failed" label={AGENT_COPY.heading}>
      <AgentCardText>{failedStopWords(failure.step)}</AgentCardText>
      <AgentCardText part="reason">{failure.reason}</AgentCardText>
      <AgentCardText part="spend">{failedMoneyWords(failure.chargedCredits, failure.creditedBackCredits)}{failure.slidesKept === null ? "" : ` ${failedSlidesWords(failure.slidesKept)}`}</AgentCardText>
      {offered ? <AgentCardText>{failedFallbackWords(failure.fallbackCredits ?? 0)}</AgentCardText> : null}
      <AgentActions>
        {offered ? <AgentActionButton choice="standard" answered={failure.answered} onClick={() => onAnswer?.({ runId, card: "failed", choice: "standard" })}>{AGENT_COPY.failedStandard}</AgentActionButton> : null}
        <AgentActionButton choice="keep" primary answered={failure.answered} onClick={() => onAnswer?.({ runId, card: "failed", choice: "keep" })}>{offered ? AGENT_COPY.failedKeep : AGENT_COPY.failedOk}</AgentActionButton>
      </AgentActions>
    </AgentCardFrame>
  )
}
