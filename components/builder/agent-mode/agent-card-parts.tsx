"use client"

import React from "react"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AGENT_COPY, type AgentAnswer, type AgentChoice } from "@/lib/studio-agent-mode"

/**
 * AGENT-MODE-SHELL: the frame the agent cards share. It is the Director question card's own markup and class strings (components/builder/chat/question-card.tsx): the same
 * data-studio-director-* parts, so the Studio shell's existing card styles (components/builder/studio-director.css) and the clean chat's rules apply unchanged. No new colour, no new stylesheet.
 * It carries NO data-director-action-id on purpose: the voice call reads the cards that have one and can say yes to their primary action, and nothing here may be answered by a voice "yes".
 */
export function AgentCardFrame({ kind, label, children }: { kind: string; label: string; children: React.ReactNode }) {
  return (
    <div
      data-studio-director-ask="agent"
      data-studio-agent-card={kind}
      role="group"
      aria-label={label}
      className="rounded-lg border border-gray-200 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/40 p-3"
    >
      <div data-studio-director-part="heading" className="flex items-center gap-1.5 mb-1.5">
        <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-purple-600 dark:text-purple-400">{AGENT_COPY.heading}</span>
      </div>
      {children}
    </div>
  )
}

export function AgentCardText({ part = "prompt", children }: { part?: string; children: React.ReactNode }) {
  return <p data-studio-director-part={part} className="text-xs text-gray-700 dark:text-slate-200 mb-2 whitespace-pre-wrap">{children}</p>
}

export function AgentActions({ children }: { children: React.ReactNode }) {
  return <div data-studio-director-part="actions" className="flex flex-wrap gap-1.5">{children}</div>
}

/** One explicit choice, drawn as the question card's action button. `answered` is the choice already taken (every button is then off, the taken one marked); the click is the only thing that sends anything. */
export function AgentActionButton({ choice, primary = false, answered, onClick, children }: { choice: AgentChoice; primary?: boolean; answered?: AgentChoice | null; onClick?: () => void; children: React.ReactNode }) {
  const taken = answered === choice
  return (
    <Button
      size="sm"
      type="button"
      data-studio-director-option="action"
      data-agent-choice={choice}
      data-primary={primary ? "true" : undefined}
      data-answered={taken ? "true" : undefined}
      variant={primary ? "default" : "outline"}
      disabled={Boolean(answered)}
      onClick={onClick}
      className={
        primary
          ? "text-xs h-auto min-h-7 py-1 max-w-full whitespace-normal text-left bg-gray-900 dark:bg-slate-600 hover:bg-gray-800 dark:hover:bg-slate-700"
          : "text-xs h-auto min-h-7 py-1 max-w-full whitespace-normal text-left border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800"
      }
    >
      {children}
    </Button>
  )
}

/** Pause / Resume / Stop on the run card: the same button, marked as a control (the existing build control answers it), not as a card answer. */
export function AgentControlButton({ control, primary = false, onClick, children }: { control: "pause" | "resume" | "stop"; primary?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Button
      size="sm"
      type="button"
      data-studio-director-option="action"
      data-agent-control={control}
      data-primary={primary ? "true" : undefined}
      variant={primary ? "default" : "outline"}
      onClick={onClick}
      className={
        primary
          ? "text-xs h-auto min-h-7 py-1 max-w-full whitespace-normal text-left bg-gray-900 dark:bg-slate-600 hover:bg-gray-800 dark:hover:bg-slate-700"
          : "text-xs h-auto min-h-7 py-1 max-w-full whitespace-normal text-left border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800 dark:bg-slate-800"
      }
    >
      {children}
    </Button>
  )
}

/** The callbacks every card takes. Both are optional: a card with none draws and does nothing. */
export interface AgentCardCallbacks {
  onAnswer?: (answer: AgentAnswer) => void
}
