"use client"

import { useId, useRef, useState, type CSSProperties } from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { Gauge } from "lucide-react"
import { PICKER_MENU_LABEL, choiceValue, scopeNote, type ModelChoice } from "@/lib/studio-model-picker"
import {
  MODEL_PICKER_STOPS, SLIDER_ADVANCED_LABEL, SLIDER_CAPTION, SLIDER_LABEL, SLIDER_MODELS_LABEL, sliderAdvanced, sliderView, stopChoice,
  type PickerStop, type SliderAdvanced,
} from "@/lib/studio-model-slider"
import { ModelOption } from "./model-option"
import { useModelChoice } from "./use-model-choice"
import "./model-picker.css"
import "./model-slider.css"

export interface ModelSliderProps {
  sessionId: string | null
  disabled?: boolean
  className?: string
  onChange?: (choice: ModelChoice) => void
}

/** The slider variant of the composer's model picker (ModelPicker variant="slider"): a 24 px gauge icon that opens a popover with a slider over ordered stops. Moving to a stop (click, drag and release,
 * arrow keys, Home, End) saves it: Auto clears the choice on the reusable default and is the deck's own Auto on a deck; Fast, Balanced and Best are presets. A specific model, chosen under "Advanced", reads
 * "Custom" and sits off the scale. It is the compact picker's hook, adapter and routes. */
export function ModelPickerSlider({ sessionId, disabled, className, onChange }: ModelSliderProps) {
  const api = useModelChoice(sessionId, { onChange })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  // A stop reached while the last one is still being saved waits its turn: the latest one is saved when the save in flight settles.
  const waiting = useRef<{ choice: ModelChoice } | null>(null)
  const inFlight = useRef(false)
  const asked = useRef<string | null>(null) // what the last stop asked for, while a save is in flight
  const stops = MODEL_PICKER_STOPS(api.catalogue)
  const view = sliderView({ catalogue: api.catalogue, state: api.state, stops })
  const advanced = sliderAdvanced({ catalogue: api.catalogue, state: api.state, scope: api.scope, own: api.deckOwn, userState: api.userState })

  function save(choice: ModelChoice) {
    inFlight.current = true
    asked.current = choiceValue(choice)
    void api.select(choice).finally(() => {
      inFlight.current = false
      asked.current = null
      const next = waiting.current
      waiting.current = null
      if (next) save(next.choice)
    })
  }
  function commit(index: number) {
    const stop = stops[index]
    setDraft(null)
    if (!stop || (!inFlight.current && index === view.index)) return // the stop it already sits on saves nothing
    const choice = stopChoice(stop, api.scope)
    if (!inFlight.current) save(choice)
    else if (choiceValue(choice) !== asked.current || waiting.current !== null) { waiting.current = { choice }; asked.current = choiceValue(choice) }
  }
  return <ModelSliderView
    label={view.label} valueText={view.valueText} stateKind={api.state.kind} scope={api.scope} mode={api.mode} ready={api.ready} disabled={disabled} className={className}
    stops={stops} index={view.index} offScale={view.offScale} draft={draft} advanced={advanced} saveNote={api.saveNote} saving={api.saving} announce={api.feedback}
    open={open} onOpenChange={setOpen} onDraft={setDraft} onCommit={commit}
    onAdvanced={choice => { setOpen(false); void api.select(choice) }} />
}

/** The slider variant with everything handed in: the gauge trigger, and in the popover the slider, a label under each stop, the caption and "Advanced" (closed). Presentation only; a fixture renders it with its own data. */
export function ModelSliderView({ label, valueText, stateKind, scope, mode, ready, disabled, className, stops, index, offScale, draft = null, advanced, saveNote, saving = false, announce = "", open, onOpenChange, onDraft, onCommit, onAdvanced }: {
  label: string
  valueText: string
  stateKind: string
  scope: "deck" | "user"
  mode: string
  ready: boolean
  disabled?: boolean
  className?: string
  stops: readonly PickerStop[]
  index: number
  offScale: "custom" | "auto" | null
  draft?: number | null
  advanced: SliderAdvanced
  saveNote: string
  saving?: boolean
  announce?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onAdvanced: (choice: ModelChoice) => void
}) {
  const notesId = useId()
  const captionId = useId()
  const blocked = Boolean(disabled) || !ready
  return <>
    <PopoverPrimitive.Root open={open && !blocked} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger
        type="button" className={["mpick-gauge", className].filter(Boolean).join(" ")} disabled={blocked} aria-label={`Model: ${label}`} title={`Model: ${label}`}
        aria-busy={ready ? undefined : true} data-mpick="gauge" data-mpick-state={stateKind} data-mpick-scope={scope} data-mpick-mode={mode}>
        <Gauge className="mpick-gauge-icon" size={16} aria-hidden="true" />
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="mpick-menu mpick-slider-menu" side="top" align="end" sideOffset={6} collisionPadding={8} aria-label={PICKER_MENU_LABEL} aria-describedby={notesId} data-mpick="menu">
          <ModelSliderPanel
            label={label} valueText={valueText} scope={scope} blocked={blocked} stops={stops} index={index} offScale={offScale} draft={draft} advanced={advanced} saveNote={saveNote} saving={saving}
            notesId={notesId} captionId={captionId} onDraft={onDraft} onCommit={onCommit} onAdvanced={onAdvanced} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
    <span className="mpick-sr" role="status" data-mpick="status">{announce}</span>
  </>
}

/** What the popover holds: the slider, a label under each stop, the caption, "Advanced" (a closed <details>) and the two lines of notes. Presentation only. The thumb sits on `index` (on the first stop, faint, when
 * the choice is off the scale) or on `draft` while it is being moved; only a commit (pointer up, an arrow key, Home, End, a click on a stop's label) saves. */
export function ModelSliderPanel({ label, valueText, scope, blocked, stops, index, offScale, draft = null, advanced, saveNote, saving = false, notesId, captionId, onDraft, onCommit, onAdvanced }: {
  label: string
  valueText: string
  scope: "deck" | "user"
  blocked: boolean
  stops: readonly PickerStop[]
  index: number
  offScale: "custom" | "auto" | null
  draft?: number | null
  advanced: SliderAdvanced
  saveNote: string
  saving?: boolean
  notesId?: string
  captionId?: string
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onAdvanced: (choice: ModelChoice) => void
}) {
  const thumb = draft ?? (index >= 0 ? index : 0)
  const shown = draft !== null && draft !== index ? stops[draft] : null
  return (
    <div className="mpick-panel mpick-slider-panel" data-mpick-view="slider">
      <div className="mpick-slider-head"><span className="mpick-slider-title">{SLIDER_LABEL}</span><span className="mpick-slider-value" data-mpick="value">{shown ? shown.label : label}</span></div>
      <SliderPrimitive.Root
        className="mpick-slider-root" min={0} max={Math.max(stops.length - 1, 1)} step={1} value={[thumb]} disabled={blocked} data-off-scale={offScale ?? undefined} data-mpick="slider"
        style={{ "--mpick-stops": stops.length } as CSSProperties} onValueChange={values => onDraft(values[0])} onValueCommit={values => onCommit(values[0])}>
        <SliderPrimitive.Track className="mpick-slider-track"><SliderPrimitive.Range className="mpick-slider-range" /></SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="mpick-slider-thumb" aria-label={SLIDER_LABEL} aria-valuetext={shown ? shown.label : valueText} aria-describedby={captionId} />
      </SliderPrimitive.Root>
      <ol className="mpick-stops" style={{ "--mpick-stops": stops.length } as CSSProperties} data-mpick="stops">
        {stops.map((stop, i) => <li key={stop.id} className="mpick-stop" data-active={offScale === null && i === (draft ?? index) ? "true" : "false"} data-mpick-stop={stop.id} aria-hidden="true" onClick={() => { if (!blocked) onCommit(i) }}>
          <span className="mpick-stop-name">{stop.label}</span>{stop.hint ? <span className="mpick-stop-hint">{stop.hint}</span> : null}
        </li>)}
      </ol>
      <p className="mpick-caption" id={captionId} data-mpick="caption">{SLIDER_CAPTION}</p>
      <details className="mpick-advanced" data-mpick="advanced">
        <summary>{SLIDER_ADVANCED_LABEL}</summary>
        <div role="group" aria-label={SLIDER_ADVANCED_LABEL} className="mpick-list">
          {advanced.rows.map(option => <ModelOption key={option.id} option={option} onPick={onAdvanced} busy={saving} />)}
          {advanced.models.length > 0 ? <div className="mpick-subhead">{SLIDER_MODELS_LABEL}</div> : null}
          {advanced.models.map(option => <ModelOption key={option.id} option={option} onPick={onAdvanced} busy={saving} />)}
        </div>
      </details>
      <div className="mpick-notes" id={notesId}><p data-mpick="scope">{scopeNote(scope)}</p>{saveNote ? <p data-mpick="save">{saveNote}</p> : null}</div>
    </div>
  )
}
