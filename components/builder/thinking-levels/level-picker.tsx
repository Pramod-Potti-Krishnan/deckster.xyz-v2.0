"use client"

import { useEffect, useRef, useState, type CSSProperties, type ElementType, type KeyboardEvent, type RefObject } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import * as PopoverPrimitive from "@radix-ui/react-popover"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { Gauge, RotateCcw } from "lucide-react"
import { type AgentPlan } from "@/lib/studio-agent-mode"
import { LEVEL_COPY, levelPick, stopLine, thinkingView, type ThinkingLevel, type ThinkingView } from "@/lib/studio-thinking-levels"
// The slider, popover and sheet classes below (mpick-*) are the model picker's: their stylesheets are in the bundle through the composer's own ModelPicker import, so they are not imported again here.
import "./level-picker.css"

/** The width (px) at or below which the picker is a bottom sheet: the phone shell's own query, the model picker's too. */
const SHEET_QUERY = "(max-width: 640px)"

function useSheet(): boolean {
  const [sheet, setSheet] = useState(false)
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia(SHEET_QUERY)
    const update = () => setSheet(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return sheet
}

export interface LevelPickerProps {
  /** The level the page shows (Auto when none was picked). */
  value: ThinkingLevel
  /** The plan the signed-in session carries; null (not loaded) keeps Balanced, Best and Max disabled. */
  plan: AgentPlan | null
  /** The agent build is in progress: the level cannot change under it. */
  disabled?: boolean
  className?: string
  /** Called with a level the plan can use; never with one it cannot. Choosing sends nothing: the page puts the level on the next build request. */
  onChange: (level: ThinkingLevel) => void
}

/** The level picker (NEXT_PUBLIC_STUDIO_THINKING_LEVELS): the composer's gauge, a popover (a bottom sheet on a phone) with one slider over Fast / Balanced (/ Best / Max with the direct preview) and a reset icon back to Auto. Drawn with the model
 * picker's own classes, so it reads as the picker PK knows. A position the plan cannot use is shown and cannot be chosen; Best and Max say they run as Balanced for now. */
export function LevelPicker({ value, plan, disabled, className, onChange }: LevelPickerProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<number | null>(null)
  const sheet = useSheet()
  const view = thinkingView(value, plan)
  function choose(level: ThinkingLevel) {
    setDraft(null)
    if (level === value) return
    const pick = levelPick(level, plan)
    if (pick) onChange(pick.level)
  }
  const dragged = draft !== null ? view.stops[draft] : undefined
  const shown: ThinkingView = dragged ? { ...view, title: dragged.label, line: stopLine(dragged.id, plan), valueText: `${dragged.label}. ${stopLine(dragged.id, plan)}` } : view // while the thumb moves the title and the line follow it; only a commit chooses
  return <LevelPickerView
    view={shown} level={value} disabled={disabled} className={className} sheet={sheet} draft={draft} open={open} onOpenChange={setOpen}
    onDraft={setDraft} onCommit={index => { const stop = view.stops[index]; if (stop) choose(stop.id); else setDraft(null) }} onReset={() => choose("auto")} />
}

/** The picker with everything handed in: the gauge and, open, the popover (or the sheet). Presentation only; a fixture renders it with its own data. */
export function LevelPickerView({ view, level, disabled, className, sheet = false, draft = null, open, onOpenChange, onDraft, onCommit, onReset }: {
  view: ThinkingView
  level: ThinkingLevel
  disabled?: boolean
  className?: string
  sheet?: boolean
  draft?: number | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onReset: () => void
}) {
  const blocked = Boolean(disabled)
  const thumbRef = useRef<HTMLSpanElement>(null)
  const trigger = {
    type: "button" as const, className: ["mpick-gauge", className].filter(Boolean).join(" "), disabled: blocked, "aria-label": `${LEVEL_COPY.pickerLabel}: ${LEVEL_COPY.label[level]}`,
    title: blocked ? LEVEL_COPY.busyNote : `${LEVEL_COPY.pickerLabel}: ${LEVEL_COPY.label[level]}`, "data-mpick": "gauge", "data-level-picker": "gauge", "data-level": level,
  }
  const icon = <Gauge className="mpick-gauge-icon" size={16} aria-hidden="true" />
  const panel = (Title: ElementType) => <LevelPanel Title={Title} view={view} blocked={blocked} draft={draft} thumbRef={thumbRef} onDraft={onDraft} onCommit={onCommit} onReset={onReset} />
  const focusSlider = (event: Event) => { if (thumbRef.current) { event.preventDefault(); thumbRef.current.focus({ preventScroll: true }) } } // the slider takes focus on open, as the model picker's does
  return sheet ? (
    <DialogPrimitive.Root open={open && !blocked} onOpenChange={onOpenChange}>
      <DialogPrimitive.Trigger {...trigger}>{icon}</DialogPrimitive.Trigger>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="mpick-simple-scrim" data-mpick="scrim" />
        <DialogPrimitive.Content className="mpick-menu mpick-simple-pop mpick-simple-sheet" aria-describedby={undefined} onOpenAutoFocus={focusSlider} data-mpick="menu" data-level-picker="sheet">
          {panel(DialogPrimitive.Title)}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  ) : (
    <PopoverPrimitive.Root open={open && !blocked} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger {...trigger}>{icon}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="mpick-menu mpick-simple-pop" side="top" align="end" sideOffset={6} collisionPadding={8} aria-label={LEVEL_COPY.pickerLabel} onOpenAutoFocus={focusSlider} data-mpick="menu" data-level-picker="popover">
          {panel("h2")}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  )
}

/** Where stop `i` of `n` sits along the track (the model picker's own arithmetic, the thumb's size is its CSS variable). */
const tickLeft = (i: number, n: number) => { const percent = (i / Math.max(n - 1, 1)) * 100; return `calc(${percent}% + var(--mpick-simple-thumb, 18px) * ${(0.5 - percent / 200).toFixed(4)})` }

/** What the popover (or the sheet) holds: the level's name and the reset icon, one line, the slider with a name under each stop. Presentation only. */
export function LevelPanel({ Title, view, blocked, draft = null, thumbRef, onDraft, onCommit, onReset }: {
  Title: ElementType
  view: ThinkingView
  blocked: boolean
  draft?: number | null
  thumbRef?: RefObject<HTMLSpanElement | null>
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onReset: () => void
}) {
  const stops = view.stops
  const thumb = draft ?? (view.index >= 0 ? view.index : 0)
  const kind = draft !== null ? "selected" : view.thumb // a thumb being dragged is shown whatever it was
  const onScale = kind === "selected"
  // With no thumb on the scale (Auto) Radix's thumb waits on the first stop, unseen: its own keys cannot choose that stop, so Left, Down and Home do.
  const firstStop = (event: KeyboardEvent) => { if (!onScale && ["ArrowLeft", "ArrowDown", "Home"].includes(event.key)) { event.preventDefault(); onCommit(0) } }
  return (
    <div className="mpick-simple-panel" data-mpick-view="levels">
      <div className="mpick-simple-grab" aria-hidden="true" />
      <div className="mpick-simple-head">
        <Title className="mpick-simple-title" data-mpick="title">{view.title}</Title>
        <button type="button" className="mpick-simple-reset" data-mpick="reset" disabled={blocked || !view.resetEnabled} aria-label={view.resetLabel} title={view.resetLabel} onClick={onReset}>
          <RotateCcw size={14} aria-hidden="true" />
        </button>
      </div>
      <p className="mpick-simple-line" data-mpick="line" data-level-line="true"><span className="mpick-simple-line-text"><span className="mpick-simple-line-name">{view.line}</span></span></p>
      <SliderPrimitive.Root
        className="mpick-slider-root" min={0} max={Math.max(stops.length - 1, 1)} step={1} value={[thumb]} disabled={blocked} data-thumb={kind} data-mpick="slider"
        style={{ "--mpick-stops": stops.length } as CSSProperties} onValueChange={values => onDraft(values[0])} onValueCommit={values => onCommit(values[0])} onKeyDown={firstStop}>
        <SliderPrimitive.Track className="mpick-slider-track"><SliderPrimitive.Range className="mpick-slider-range" /></SliderPrimitive.Track>
        {stops.map((stop, i) => <span key={stop.id} className="mpick-tick" aria-hidden="true" data-passed={onScale && i <= thumb ? "true" : "false"} data-current={kind !== "none" && i === thumb ? "true" : "false"} style={{ left: tickLeft(i, stops.length) }} />)}
        <SliderPrimitive.Thumb ref={thumbRef} className="mpick-slider-thumb" aria-label={LEVEL_COPY.pickerLabel} aria-valuetext={view.valueText} />
      </SliderPrimitive.Root>
      <ol className="mpick-stops" style={{ "--mpick-stops": stops.length } as CSSProperties} data-mpick="stops">
        {stops.map((stop, i) => <li key={stop.id} className="mpick-stop" data-active={onScale && i === thumb ? "true" : "false"} data-mpick-stop={stop.id} data-level-disabled={stop.disabled ? "true" : "false"} data-level-soon={stop.comingSoon ? "true" : "false"} aria-hidden="true" onClick={() => { if (!blocked) onCommit(i) }}>
          <span className="mpick-stop-name">{stop.label}</span>
        </li>)}
      </ol>
    </div>
  )
}
