"use client"

import { useEffect, useId, useRef, useState, type CSSProperties, type ElementType, type KeyboardEvent, type RefObject } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { ChevronDown, ChevronRight, Gauge, RotateCcw } from "lucide-react"
import { choiceValue, type ModelChoice } from "@/lib/studio-model-picker"
import { SLIDER_ADVANCED_LABEL, SLIDER_LABEL, SLIDER_MODELS_LABEL, sliderAdvanced, stopChoice, type PickerStop, type SliderAdvanced } from "@/lib/studio-model-slider"
import { SIMPLE_LIST_ACTION, SIMPLE_MENU_LABEL, SIMPLE_SHEET_QUERY, simpleStops, simpleView, type SimpleView } from "@/lib/studio-model-picker-simple"
import { ModelOption } from "./model-option"
import { useModelChoice } from "./use-model-choice"
import "./model-picker.css"
import "./model-slider.css"
import "./model-picker-simple.css"

export interface ModelPickerSimpleProps {
  sessionId: string | null
  disabled?: boolean
  className?: string
  onChange?: (choice: ModelChoice) => void
}

/** Whether the window is phone-sized (SIMPLE_SHEET_QUERY): the picker is then a bottom sheet, else a popover. False until the first effect, so the first render is the desktop one on the server and on the client alike. */
function useSheet(): boolean {
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia(SIMPLE_SHEET_QUERY)
    const update = () => setSheet(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return sheet
}

/** The simplified slider picker (ModelPicker variant="slider" with NEXT_PUBLIC_STUDIO_MODEL_PICKER_SIMPLE on): a gauge icon that opens a popover, or on a phone a bottom sheet, with the preset's name, the writing model the router
 * resolves for it, one slider over Fast / Balanced / Best / Max, a reset icon and a plain Advanced row. It is the slider's hook, adapter and routes: moving to a stop saves that PRESET (never a model) for the three text groups. */
export function ModelPickerSimple({ sessionId, disabled, className, onChange }: ModelPickerSimpleProps) {
  const api = useModelChoice(sessionId, { onChange })
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  const sheet = useSheet()
  // A choice made while the last one is still being saved waits its turn: the latest one is saved when the save in flight settles.
  const waiting = useRef<{ choice: ModelChoice } | null>(null)
  const inFlight = useRef(false)
  const asked = useRef<string | null>(null) // what the last choice asked for, while a save is in flight
  const stops = simpleStops(api.catalogue)
  const chosen = simpleView({ catalogue: api.catalogue, state: api.state, scope: api.scope, own: api.deckOwn, stops })
  // While the thumb is being moved the title and the line follow it (what the stop would resolve to); only a commit saves, so the reset still reads what is saved (`own`).
  const dragged = draft !== null ? stops[draft] : undefined
  const view = dragged?.tier ? simpleView({ catalogue: api.catalogue, state: { kind: "tier", tier: dragged.tier }, scope: api.scope, own: api.deckOwn, stops }) : chosen
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
  function request(choice: ModelChoice) {
    if (!inFlight.current) save(choice)
    else if (choiceValue(choice) !== asked.current || waiting.current !== null) { waiting.current = { choice }; asked.current = choiceValue(choice) }
  }
  function commit(index: number) {
    const stop = stops[index]
    setDraft(null)
    if (!stop || (!inFlight.current && chosen.thumb === "selected" && index === chosen.index)) return // the stop that is already chosen saves nothing (a hollow thumb, a deck following its default, is not a choice of its own)
    request(stopChoice(stop, api.scope))
  }
  return <ModelSimpleView
    view={view} stateKind={api.state.kind} scope={api.scope} mode={api.mode} ready={api.ready} disabled={disabled} className={className} sheet={sheet}
    draft={draft} advanced={advanced} saving={api.saving} announce={api.feedback} open={open} onOpenChange={setOpen} onDraft={setDraft} onCommit={commit}
    onReset={() => request(null)} onAdvanced={choice => { setOpen(false); void api.select(choice) }} />
}

/** The picker with everything handed in: the gauge trigger and, open, the popover (or the sheet). Presentation only; a fixture renders it with its own data. */
export function ModelSimpleView({ view, stateKind, scope, mode, ready, disabled, className, sheet = false, draft = null, advanced, saving = false, announce = "", open, onOpenChange, onDraft, onCommit, onReset, onAdvanced }: {
  view: SimpleView
  stateKind: string
  scope: "deck" | "user"
  mode: string
  ready: boolean
  disabled?: boolean
  className?: string
  sheet?: boolean
  draft?: number | null
  advanced: SliderAdvanced
  saving?: boolean
  announce?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onReset: () => void
  onAdvanced: (choice: ModelChoice) => void
}) {
  const blocked = Boolean(disabled) || !ready
  const thumbRef = useRef<HTMLSpanElement>(null)
  const trigger = {
    type: "button" as const, className: ["mpick-gauge", className].filter(Boolean).join(" "), disabled: blocked, "aria-label": `Model: ${view.title}`, title: `Model: ${view.title}`,
    "aria-busy": ready ? undefined : true, "data-mpick": "gauge", "data-mpick-state": stateKind, "data-mpick-scope": scope, "data-mpick-mode": mode,
  }
  const icon = <Gauge className="mpick-gauge-icon" size={16} aria-hidden="true" />
  const panel = (Title: ElementType) => <ModelSimplePanel
    Title={Title} view={view} blocked={blocked} saving={saving} draft={draft} advanced={advanced} thumbRef={thumbRef}
    onDraft={onDraft} onCommit={onCommit} onReset={onReset} onAdvanced={onAdvanced} />
  const focusSlider = (event: Event) => { if (thumbRef.current) { event.preventDefault(); thumbRef.current.focus({ preventScroll: true }) } } // the slider takes focus on open, as the slider picker's does
  return <>
    {sheet ? (
      <DialogPrimitive.Root open={open && !blocked} onOpenChange={onOpenChange}>
        <DialogPrimitive.Trigger {...trigger}>{icon}</DialogPrimitive.Trigger>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="mpick-simple-scrim" data-mpick="scrim" />
          <DialogPrimitive.Content className="mpick-menu mpick-simple-pop mpick-simple-sheet" aria-describedby={undefined} onOpenAutoFocus={focusSlider} data-mpick="menu" data-mpick-simple="sheet">
            {panel(DialogPrimitive.Title)}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    ) : (
      <PopoverPrimitive.Root open={open && !blocked} onOpenChange={onOpenChange}>
        <PopoverPrimitive.Trigger {...trigger}>{icon}</PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content className="mpick-menu mpick-simple-pop" side="top" align="end" sideOffset={6} collisionPadding={8} aria-label={SIMPLE_MENU_LABEL} onOpenAutoFocus={focusSlider} data-mpick="menu" data-mpick-simple="popover">
            {panel("h2")}
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    )}
    <span className="mpick-sr" role="status" data-mpick="status">{announce}</span>
  </>
}

/** Where stop `i` of `n` sits along the track: its share of the width, and the inset Radix puts the thumb at (half the thumb at the start, none at the end), so a tick sits under the thumb when it is on it. The thumb's size is the CSS variable --mpick-simple-thumb. */
const tickLeft = (i: number, n: number) => { const percent = (i / Math.max(n - 1, 1)) * 100; return `calc(${percent}% + var(--mpick-simple-thumb, 18px) * ${(0.5 - percent / 200).toFixed(4)})` }

/** What the popover (or the sheet) holds: the title and the reset icon, the writing model with the chevron that swaps the slider for the per-step list, the slider with a name under each stop, and a plain "Advanced" row.
 * The list and Advanced start closed each time the panel opens. Presentation only. */
export function ModelSimplePanel({ Title, view, blocked, saving = false, draft = null, advanced, thumbRef, initialList = false, initialAdvanced = false, onDraft, onCommit, onReset, onAdvanced }: {
  Title: ElementType
  view: SimpleView
  blocked: boolean
  saving?: boolean
  draft?: number | null
  advanced: SliderAdvanced
  thumbRef?: RefObject<HTMLSpanElement | null>
  initialList?: boolean
  initialAdvanced?: boolean
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onReset: () => void
  onAdvanced: (choice: ModelChoice) => void
}) {
  const [listOpen, setListOpen] = useState(initialList && view.list !== null)
  const [advancedOpen, setAdvancedOpen] = useState(initialAdvanced)
  const listId = useId()
  const stops: readonly PickerStop[] = view.stops
  const { index, thumb: thumbKind } = view
  const thumb = draft ?? (index >= 0 ? index : 0)
  const kind = draft !== null ? "selected" : thumbKind // a thumb being dragged is shown whatever it was
  const onScale = kind === "selected" || kind === "hollow"
  const showList = listOpen && view.list !== null
  // With no thumb on the scale (Auto, Custom) Radix's thumb waits on the first stop, unseen: its own keys cannot choose that stop, so Left, Down and Home do.
  const firstStop = (event: KeyboardEvent) => { if (!onScale && ["ArrowLeft", "ArrowDown", "Home"].includes(event.key)) { event.preventDefault(); onCommit(0) } }
  return (
    <div className="mpick-simple-panel" data-mpick-view="simple">
      <div className="mpick-simple-grab" aria-hidden="true" />
      <div className="mpick-simple-head">
        <Title className="mpick-simple-title" data-mpick="title">{view.title}</Title>
        <button type="button" className="mpick-simple-reset" data-mpick="reset" disabled={blocked || saving || !view.resetEnabled} aria-label={view.resetLabel} title={view.resetLabel} onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>
      {view.line ? (view.list !== null
        ? <button type="button" className="mpick-simple-line" data-mpick="line" aria-expanded={showList} aria-controls={listId} onClick={() => { setListOpen(open => !open); setAdvancedOpen(false) }}>
          <span className="mpick-simple-line-text">{view.line.lead ? `${view.line.lead}: ` : ""}<span className="mpick-simple-line-name">{view.line.name}</span></span>
          <ChevronDown className="mpick-simple-chev" size={14} aria-hidden="true" />
        </button>
        : <p className="mpick-simple-line" data-mpick="line"><span className="mpick-simple-line-text">{view.line.lead ? `${view.line.lead}: ` : ""}<span className="mpick-simple-line-name">{view.line.name}</span></span></p>) : null}
      {showList && view.list ? (
        <div className="mpick-simple-list" id={listId} data-mpick="list">
          {view.list.heading ? <div className="mpick-subhead">{view.list.heading}</div> : null}
          {view.list.rows.map(row => <div key={row.id} className="mpick-simple-row" data-mpick-step={row.id}><span className="mpick-simple-rowname">{row.label}</span><span className="mpick-simple-rowval">{row.model}</span></div>)}
          <button type="button" className="mpick-item" data-mpick="specific" onClick={() => { setListOpen(false); setAdvancedOpen(true) }}>
            <span className="mpick-text"><span className="mpick-name">{SIMPLE_LIST_ACTION}</span></span>
            <ChevronRight className="mpick-go" size={14} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <>
          <SliderPrimitive.Root
            className="mpick-slider-root" min={0} max={Math.max(stops.length - 1, 1)} step={1} value={[thumb]} disabled={blocked} data-thumb={kind} data-mpick="slider"
            style={{ "--mpick-stops": stops.length } as CSSProperties} onValueChange={values => onDraft(values[0])} onValueCommit={values => onCommit(values[0])} onKeyDown={firstStop}>
            <SliderPrimitive.Track className="mpick-slider-track"><SliderPrimitive.Range className="mpick-slider-range" /></SliderPrimitive.Track>
            {stops.map((stop, i) => <span key={stop.id} className="mpick-tick" aria-hidden="true" data-passed={onScale && i <= thumb ? "true" : "false"} data-current={kind !== "none" && i === thumb ? "true" : "false"} style={{ left: tickLeft(i, stops.length) }} />)}
            <SliderPrimitive.Thumb ref={thumbRef} className="mpick-slider-thumb" aria-label={SLIDER_LABEL} aria-valuetext={view.valueText} />
          </SliderPrimitive.Root>
          <ol className="mpick-stops" style={{ "--mpick-stops": stops.length } as CSSProperties} data-mpick="stops">
            {stops.map((stop, i) => <li key={stop.id} className="mpick-stop" data-active={onScale && i === thumb ? "true" : "false"} data-mpick-stop={stop.id} aria-hidden="true" onClick={() => { if (!blocked) onCommit(i) }}>
              <span className="mpick-stop-name">{stop.label}</span>
            </li>)}
          </ol>
          <details className="mpick-advanced" data-mpick="advanced" open={advancedOpen} onToggle={event => setAdvancedOpen(event.currentTarget.open)}>
            <summary>{SLIDER_ADVANCED_LABEL}</summary>
            <div role="group" aria-label={SLIDER_ADVANCED_LABEL} className="mpick-list">
              {advanced.rows.map(option => <ModelOption key={option.id} option={option} onPick={onAdvanced} busy={saving} />)}
              {advanced.models.length > 0 ? <div className="mpick-subhead">{SLIDER_MODELS_LABEL}</div> : null}
              {advanced.models.map(option => <ModelOption key={option.id} option={option} onPick={onAdvanced} busy={saving} />)}
            </div>
          </details>
        </>
      )}
    </div>
  )
}
