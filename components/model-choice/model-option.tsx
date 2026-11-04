"use client"

import { Check } from "lucide-react"
import type { ModelChoice, PickerOption } from "@/lib/studio-model-picker"

const costLevel = (hint: string) => hint.length

/** One row of a model menu: a button with a pressed state, the name, a detail line, and the $ hint read as words. Shared by the compact picker's menu and the slider's Advanced section. */
export function ModelOption({ option, onPick, busy }: { option: PickerOption; onPick: (choice: ModelChoice) => void; busy: boolean }) {
  return <button type="button" className="mpick-item" aria-pressed={option.selected} disabled={busy} data-mpick-option={option.id} onClick={() => onPick(option.choice)}>
    <span className="mpick-check" aria-hidden="true">{option.selected ? <Check size={14} /> : null}</span>
    <span className="mpick-text"><span className="mpick-name">{option.label}</span>{option.detail ? <span className="mpick-detail">{option.detail}</span> : null}</span>
    {option.hint ? <><span className="mpick-hint" aria-hidden="true">{option.hint}</span><span className="mpick-sr">, cost {costLevel(option.hint)} of 3</span></> : null}
  </button>
}
