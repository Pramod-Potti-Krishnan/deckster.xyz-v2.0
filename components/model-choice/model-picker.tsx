"use client"

import { useId, useState } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import { Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import { PICKER_BACK_LABEL, PICKER_MENU_LABEL, chipLabel, pickerMenu, scopeNote, type ChipLabel, type ModelChoice, type PickerMenu, type PickerOption } from "@/lib/studio-model-picker"
import { STUDIO_MODEL_PICKER_ENABLED, useModelChoice } from "./use-model-choice"
import "./model-picker.css"

export { STUDIO_MODEL_PICKER_ENABLED, browserRuntime, useModelChoice } from "./use-model-choice"
export type { ModelChoiceApi, PickerRuntime, SelectOutcome, UseModelChoiceOptions } from "./use-model-choice"
export type { ModelChoice, PickerState } from "@/lib/studio-model-picker"

export interface ModelPickerProps {
  variant?: "compact"
  /** The Studio session (the deck) whose choice this edits; null for a new deck, where it edits the reusable default and the menu says "Applies to new decks". */
  sessionId: string | null
  disabled?: boolean
  /** Goes on the chip (the one visible element): the width, the margin. The picker sets no width of its own. */
  className?: string
  /** Called after a save with the choice now in force: { tier }, { model }, or null for Auto. */
  onChange?: (choice: ModelChoice) => void
}

/** The model picker for the chat composer: one small chip that shows the choice (Auto / Fast / Balanced / Best, or a short model name) and opens a menu to change it. Renders NOTHING unless
 * NEXT_PUBLIC_STUDIO_MODEL_CHOICE is exactly "true", and then asks for nothing until it is mounted, so it can be mounted unconditionally.
 *
 * It is self-contained: it reads the live catalogue (GET /api/models/catalogue) and the choice for `sessionId` (this deck, else the reusable default) and saves through Studio's own routes
 * (/api/model-choice/prefs, /api/model-choice/prefs/deck/{session}), or on this device while saving is not switched on, and the menu says which. A choice is written to the three text groups together;
 * imagery and narration stay "Fixed for now". Style it from outside with `className` (the chip) and the --mpick-* variables in model-picker.css. */
export function ModelPicker(props: ModelPickerProps) {
  if (!STUDIO_MODEL_PICKER_ENABLED) return null
  return <ModelPickerConnected {...props} />
}

function ModelPickerConnected({ sessionId, disabled, className, onChange }: ModelPickerProps) {
  const api = useModelChoice(sessionId, { onChange })
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<"main" | "models">("main")
  return <ModelPickerView
    label={chipLabel(api.state, api.catalogue)} stateKind={api.state.kind} scope={api.scope} mode={api.mode} ready={api.ready} disabled={disabled} className={className}
    menu={pickerMenu({ catalogue: api.catalogue, state: api.state, inherited: api.scope === "deck" ? api.userState : null })} saveNote={api.saveNote} saving={api.saving} announce={api.feedback}
    open={open} onOpenChange={next => { setOpen(next); if (!next) setView("main") }} view={view} onView={setView}
    onPick={choice => { setOpen(false); setView("main"); void api.select(choice) }} />
}

/** The picker with everything handed in: the chip, and the menu in a popover (Radix: Escape and a click outside close it, focus goes into it and comes back to the chip). Presentation only; it is what a
 * fixture renders with its own data. */
export function ModelPickerView({ label, stateKind, scope, mode, ready, disabled, className, menu, saveNote, saving = false, announce = "", open, onOpenChange, view, onView, onPick }: {
  label: ChipLabel
  stateKind: string
  scope: "deck" | "user"
  mode: string
  ready: boolean
  disabled?: boolean
  className?: string
  menu: PickerMenu
  saveNote: string
  saving?: boolean
  announce?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  view: "main" | "models"
  onView: (view: "main" | "models") => void
  onPick: (choice: ModelChoice) => void
}) {
  const notesId = useId()
  const blocked = Boolean(disabled) || !ready
  return <>
    <PopoverPrimitive.Root open={open && !blocked} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger
        type="button" className={["mpick-chip", className].filter(Boolean).join(" ")} disabled={blocked} aria-label={`Model: ${label.full}`} title={`Model: ${label.full}`}
        aria-busy={ready ? undefined : true} data-mpick="chip" data-mpick-state={stateKind} data-mpick-scope={scope} data-mpick-mode={mode}>
        <span className="mpick-label">{label.text}</span>
        <ChevronDown className="mpick-caret" size={12} aria-hidden="true" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="mpick-menu" side="top" align="start" sideOffset={6} collisionPadding={8} aria-label={PICKER_MENU_LABEL} aria-describedby={notesId} data-mpick="menu">
          <ModelPickerPanel menu={menu} view={view} notesId={notesId} scope={scope} saveNote={saveNote} busy={saving} onView={onView} onPick={onPick} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
    <span className="mpick-sr" role="status" data-mpick="status">{announce}</span>
  </>
}

const costLevel = (hint: string) => hint.length

function Option({ option, onPick, busy }: { option: PickerOption; onPick: (choice: ModelChoice) => void; busy: boolean }) {
  return <button type="button" className="mpick-item" aria-pressed={option.selected} disabled={busy} data-mpick-option={option.id} onClick={() => onPick(option.choice)}>
    <span className="mpick-check" aria-hidden="true">{option.selected ? <Check size={14} /> : null}</span>
    <span className="mpick-text"><span className="mpick-name">{option.label}</span>{option.detail ? <span className="mpick-detail">{option.detail}</span> : null}</span>
    {option.hint ? <><span className="mpick-hint" aria-hidden="true">{option.hint}</span><span className="mpick-sr">, cost {costLevel(option.hint)} of 3</span></> : null}
  </button>
}

/** What the menu holds: Auto and the tiers, "More models…" (the models certified for all three text groups) as a second view with a Back button, and the two lines under them: where a choice lands and
 * where it is kept. Presentation only: nothing here reads or writes a choice. */
export function ModelPickerPanel({ menu, view, notesId, scope, saveNote, busy = false, onView, onPick }: {
  menu: PickerMenu
  view: "main" | "models"
  notesId?: string
  scope: "deck" | "user"
  saveNote: string
  busy?: boolean
  onView: (view: "main" | "models") => void
  onPick: (choice: ModelChoice) => void
}) {
  const models = view === "models"
  return <div className="mpick-panel" data-mpick-view={view}>
    {models ? <button type="button" className="mpick-item mpick-back" onClick={() => onView("main")}><ChevronLeft size={14} aria-hidden="true" /><span className="mpick-name">{PICKER_BACK_LABEL}</span></button> : null}
    <div role="group" aria-label={models ? menu.more?.label ?? "More models" : "Model"} className="mpick-list">
      {(models ? menu.models : menu.main).map(option => <Option key={option.id} option={option} onPick={onPick} busy={busy} />)}
      {!models && menu.more ? <button type="button" className="mpick-item mpick-more" data-mpick-option="more" onClick={() => onView("models")}>
        <span className="mpick-check" aria-hidden="true" />
        <span className="mpick-text"><span className="mpick-name">{menu.more.label}</span>{menu.more.detail ? <span className="mpick-detail">{menu.more.detail}</span> : null}</span>
        <ChevronRight className="mpick-go" size={14} aria-hidden="true" />
      </button> : null}
    </div>
    <div className="mpick-notes" id={notesId}><p data-mpick="scope">{scopeNote(scope)}</p>{saveNote ? <p data-mpick="save">{saveNote}</p> : null}</div>
  </div>
}
