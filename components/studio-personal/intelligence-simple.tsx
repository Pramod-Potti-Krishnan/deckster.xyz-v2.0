"use client"

import { useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { RotateCcw } from "lucide-react"
import { choiceValue, type ModelChoice } from "@/lib/studio-model-picker"
import { SLIDER_LABEL } from "@/lib/studio-model-slider"
import { simpleStops } from "@/lib/studio-model-picker-simple"
import { INTELLIGENCE_SIMPLE_ADVANCED, intelligenceResetChoice, intelligenceSimpleView, intelligenceStopSave, type IntelligenceSimpleView } from "@/lib/studio-intelligence-simple"
import { useModelChoice } from "@/components/model-choice/use-model-choice"
import "@/components/model-choice/model-picker.css"
import "@/components/model-choice/model-slider.css"
import "@/components/model-choice/model-picker-simple.css"
import "./personal-workspaces.css"
import "./intelligence-simple.css"

/** The Intelligence page with NEXT_PUBLIC_STUDIO_INTELLIGENCE_SIMPLE on (UX-02; lib/studio-intelligence-simple.ts): one preset slider for the account default, the composer picker's hook, logic and save
 * queue, and the page's per-task dropdowns (`advanced`, handed in unchanged) under a collapsed "Advanced". A stop saves the PRESET only. */
export function IntelligenceSimple({ advanced }: { advanced: ReactNode }) {
  const api = useModelChoice(null) // no presentation: the reusable default (the account's)
  const [draft, setDraft] = useState<number | null>(null)
  // As in the composer picker: a choice made while the last one is still being saved waits its turn; the latest one is saved when the save in flight settles.
  const waiting = useRef<{ choice: ModelChoice } | null>(null)
  const inFlight = useRef(false)
  const asked = useRef<string | null>(null)
  const stops = simpleStops(api.catalogue)
  const chosen = intelligenceSimpleView({ catalogue: api.catalogue, state: api.state, stops })
  const dragged = draft !== null ? stops[draft] : undefined
  const view = dragged?.tier ? { ...intelligenceSimpleView({ catalogue: api.catalogue, state: { kind: "tier", tier: dragged.tier }, stops }), resetEnabled: chosen.resetEnabled } : chosen

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
    setDraft(null)
    if (!stops[index]) return
    const choice = intelligenceStopSave(chosen, index, inFlight.current)
    if (choice !== null) request(choice)
  }
  return <IntelligenceSimpleLayout view={view} draft={draft} blocked={!api.ready} saving={api.saving} announce={api.feedback} advanced={advanced}
    onDraft={setDraft} onCommit={commit} onReset={() => request(intelligenceResetChoice)} />
}

/** Where stop `i` of `n` sits along the track (the composer picker's own placement), so a tick sits under the thumb when it is on it. */
const tickLeft = (i: number, n: number) => { const percent = (i / Math.max(n - 1, 1)) * 100; return `calc(${percent}% + var(--mpick-simple-thumb, 18px) * ${(0.5 - percent / 200).toFixed(4)})` }

/** The page, presentation only (a fixture renders it with its own data): the heading, the preset card (title, reset, the per-step list, the slider) and the collapsed Advanced. */
export function IntelligenceSimpleLayout({ view, draft = null, blocked, saving = false, announce = "", advanced, initialAdvanced = false, onDraft, onCommit, onReset }: {
  view: IntelligenceSimpleView
  draft?: number | null
  blocked: boolean
  saving?: boolean
  announce?: string
  advanced: ReactNode
  initialAdvanced?: boolean
  onDraft: (index: number) => void
  onCommit: (index: number) => void
  onReset: () => void
}) {
  const { stops, index, thumb: thumbKind } = view
  const thumb = draft ?? (index >= 0 ? index : 0)
  const kind = draft !== null ? "selected" : thumbKind
  const onScale = kind === "selected" || kind === "hollow"
  const firstStop = (event: KeyboardEvent) => { if (!onScale && ["ArrowLeft", "ArrowDown", "Home"].includes(event.key)) { event.preventDefault(); onCommit(0) } }
  return <main className="sp-workspace sp-intelligence sp-isimple" data-studio-personal="intelligence" data-intelligence-simple="true">
    <header className="sp-heading"><div><p className="sp-eyebrow">WORK WITH DECKSTER</p><h1>Intelligence</h1></div></header>
    <section className="mpick-menu mpick-simple-pop sp-isimple-card" aria-labelledby="sp-isimple-title" data-isimple="card">
      <div className="mpick-simple-panel" data-mpick-view="simple">
        <div className="mpick-simple-head">
          <h2 className="mpick-simple-title" id="sp-isimple-title" data-isimple="title">{view.title}</h2>
          <button type="button" className="mpick-simple-reset" data-isimple="reset" disabled={blocked || saving || !view.resetEnabled} aria-label={view.resetLabel} title={view.resetLabel} onClick={onReset}>
            <RotateCcw size={14} aria-hidden="true" />
          </button>
        </div>
        {view.rows.length > 0
          ? <dl className="sp-isimple-rows" data-isimple="rows">{view.rows.map(row => <div key={row.id} className="mpick-simple-row" data-isimple-step={row.id}><dt className="mpick-simple-rowname">{row.label}</dt><dd className="mpick-simple-rowval">{row.model}</dd></div>)}</dl>
          : view.detail ? <p className="mpick-simple-line" data-isimple="detail"><span className="mpick-simple-line-text">{view.detail}</span></p> : null}
        <SliderPrimitive.Root
          className="mpick-slider-root" min={0} max={Math.max(stops.length - 1, 1)} step={1} value={[thumb]} disabled={blocked} data-thumb={kind} data-isimple="slider"
          style={{ "--mpick-stops": stops.length } as CSSProperties} onValueChange={values => onDraft(values[0])} onValueCommit={values => onCommit(values[0])} onKeyDown={firstStop}>
          <SliderPrimitive.Track className="mpick-slider-track"><SliderPrimitive.Range className="mpick-slider-range" /></SliderPrimitive.Track>
          {stops.map((stop, i) => <span key={stop.id} className="mpick-tick" aria-hidden="true" data-passed={onScale && i <= thumb ? "true" : "false"} data-current={kind !== "none" && i === thumb ? "true" : "false"} style={{ left: tickLeft(i, stops.length) }} />)}
          <SliderPrimitive.Thumb className="mpick-slider-thumb" aria-label={SLIDER_LABEL} aria-valuetext={view.valueText} />
        </SliderPrimitive.Root>
        <ol className="mpick-stops" style={{ "--mpick-stops": stops.length } as CSSProperties} data-isimple="stops">
          {stops.map((stop, i) => <li key={stop.id} className="mpick-stop" data-active={onScale && i === thumb ? "true" : "false"} data-isimple-stop={stop.id} aria-hidden="true" onClick={() => { if (!blocked) onCommit(i) }}>
            <span className="mpick-stop-name">{stop.label}</span>
          </li>)}
        </ol>
      </div>
    </section>
    <span className="mpick-sr" role="status" data-isimple="status">{announce}</span>
    <details className="sp-isimple-advanced" data-isimple="advanced" open={initialAdvanced || undefined}>
      <summary>{INTELLIGENCE_SIMPLE_ADVANCED}</summary>
      <div className="sp-isimple-advanced-body">{advanced}</div>
    </details>
  </main>
}
