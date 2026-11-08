"use client"

import React from "react"
import { Check, Loader2, X } from "lucide-react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, formatMeter, meterFraction, type AgentRunState, type AgentRunStatus } from "@/lib/studio-agent-mode"
import { AgentActions, AgentCardFrame, AgentCardText, AgentControlButton } from "./agent-card-parts"

export type AgentControl = "pause" | "resume" | "stop"

const STATUS_WORDS: Partial<Record<AgentRunStatus, string>> = {
  running: AGENT_COPY.statusRunning,
  paused: AGENT_COPY.statusPaused,
  stopped: AGENT_COPY.statusStopped,
  done: AGENT_COPY.statusDone,
}

/**
 * AGENT-MODE-SHELL: the run card. The steps in plain words, a credit meter (used of the cap, never drawn past the cap), and Pause / Resume / Stop. Stop and Pause are the existing build control's,
 * handed in as onControl; a Stop keeps every built slide. Credits only: no currency, tokens, provider or model. Drawn from the reducer's state alone; off (flag, or no run yet), null.
 */
export function AgentRunCard({ state, onControl }: { state: AgentRunState; onControl?: (action: AgentControl) => void }) {
  if (!STUDIO_AGENT_MODE_ENABLED || state.runId === null || state.status === "idle" || state.status === "estimate") return null
  const cap = state.capCredits, shown = cap === null ? state.usedCredits : Math.min(state.usedCredits, cap)
  const live = state.status === "running" || state.status === "paused" || state.status === "stopped"
  return (
    <AgentCardFrame kind="run" label={AGENT_COPY.heading}>
      <div
        role="progressbar"
        aria-label={AGENT_COPY.creditsUsed}
        aria-valuemin={0}
        aria-valuemax={cap ?? undefined}
        aria-valuenow={cap === null ? undefined : shown}
        aria-valuetext={formatMeter(state.usedCredits, cap)}
        data-studio-agent-part="meter"
        className="mb-1 h-1.5 w-full overflow-hidden rounded-full bg-[var(--ss-line)]"
      >
        <div data-studio-agent-part="meter-fill" className="h-full bg-[var(--ss-accent)]" style={{ width: `${Math.round(meterFraction(state.usedCredits, cap) * 100)}%` }} />
      </div>
      <AgentCardText part="meter-text">{formatMeter(state.usedCredits, cap)}</AgentCardText>
      {state.steps.length > 0 ? (
        <ol data-studio-agent-part="steps" aria-label={AGENT_COPY.heading} className="mb-2 max-h-40 space-y-1 overflow-y-auto text-xs text-gray-700 dark:text-slate-200">
          {state.steps.map(step => (
            <li key={step.n} data-studio-agent-step={step.state} className="flex items-start gap-1.5">
              {step.state === "done" ? <Check className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> : step.state === "failed" ? <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" /> : <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              <span>{step.text}</span>
            </li>
          ))}
        </ol>
      ) : null}
      {STATUS_WORDS[state.status] ? <AgentCardText part="status">{STATUS_WORDS[state.status]}</AgentCardText> : null}
      {live ? (
        <AgentActions>
          {state.status === "running" ? <AgentControlButton control="pause" onClick={() => onControl?.("pause")}>{AGENT_COPY.pause}</AgentControlButton> : <AgentControlButton control="resume" primary onClick={() => onControl?.("resume")}>{AGENT_COPY.resume}</AgentControlButton>}
          {state.status === "stopped" ? null : <AgentControlButton control="stop" onClick={() => onControl?.("stop")}>{AGENT_COPY.stop}</AgentControlButton>}
        </AgentActions>
      ) : null}
    </AgentCardFrame>
  )
}
