"use client"

import React from "react"
import { AGENT_COPY, STUDIO_AGENT_MODE_ENABLED, STUDIO_AUTHOR_MODE_PICKER_ENABLED, buildModeOptions, type AgentPlan, type BuildMode } from "@/lib/studio-agent-mode"

/**
 * AGENT-MODE-SHELL: the build-mode picker, Standard / Author / Agent. Author appears only with NEXT_PUBLIC_AUTHOR_MODE_PICKER, Agent only with NEXT_PUBLIC_AGENT_MODE (each exact "true", default off, Studio
 * shell only); with neither, null. Agent says "Pro and Max", and for Free, Starter (or a plan not loaded yet) it is disabled with a plain reason. The chips are the question card's own (same markup, so the shell's
 * existing styles apply); choosing one sends nothing: the host holds the mode and puts it on the build request (buildModeOnWire).
 */
export function BuildModePicker({ value, onChange, plan, disabled = false }: { value: BuildMode; onChange?: (mode: BuildMode) => void; plan?: AgentPlan | null; disabled?: boolean }) {
  const noteId = React.useId()
  if (!STUDIO_AGENT_MODE_ENABLED && !STUDIO_AUTHOR_MODE_PICKER_ENABLED) return null
  const options = buildModeOptions(plan)
  const agent = options.find(o => o.mode === "agent")
  return (
    <div data-studio-build-mode-picker role="group" aria-label={AGENT_COPY.pickerLabel}>
      <div data-studio-director-part="options" className="flex flex-wrap gap-1.5">
        {options.map(option => {
          const selected = option.mode === value
          return (
            <button
              key={option.mode}
              type="button"
              data-studio-director-option="suggestion"
              data-build-mode={option.mode}
              aria-pressed={selected}
              aria-describedby={option.mode === "agent" ? noteId : undefined}
              disabled={disabled || option.disabled}
              onClick={() => onChange?.(option.mode)}
              className={[
                "text-xs h-auto min-h-7 py-1 px-2.5 rounded-full border transition-colors max-w-full whitespace-normal text-left",
                selected
                  ? "bg-purple-600 text-white border-purple-600"
                  : "border-gray-200 dark:border-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-800",
              ].join(" ")}
            >
              {option.label}
            </button>
          )
        })}
      </div>
      {agent?.note ? <p id={noteId} data-studio-director-part="hint" className="mt-1 text-[10.5px] text-gray-500 dark:text-slate-400">{agent.note}</p> : null}
    </div>
  )
}
