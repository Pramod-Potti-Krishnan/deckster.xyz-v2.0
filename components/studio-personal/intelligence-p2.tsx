"use client"

import { useEffect, useState } from "react"
import { ArrowDownUp, AudioLines, CheckCircle2, AlertCircle, Info, RotateCcw } from "lucide-react"
import { catalog, catalogRefreshed, DISABLED_ACTION_OPAQUE, draftStorageKey, inputsLabel, IntelligenceReadiness, IntelligenceScope, ManagedByDeckster, parseSavedDraft, priceLabel, provenanceText, releaseLabel, taskDetails } from "./intelligence-workspace"
import {
  P2_DEFAULT_CHOICE, P2_ONE_LINE, P2_ONE_LINE_NO_STORAGE, P2_RESET_FEEDBACK, P2_RESET_LABEL, P2_TASKS, P2_VOICE_MODELS,
  isP2Choice, p2ChangedCount, p2ChoiceFeedback, p2ComparisonFor, p2DefaultChoices, p2FromLegacyDraft, p2OriginLine, p2Options, p2Parse, p2Resolve, p2Serialize, p2StorageKey, p2Status,
  type P2Choices, type P2Storage, type P2TaskId,
} from "@/lib/studio-intelligence-p2"
import { STUDIO_P2_POLISH_ATTR, STUDIO_P2_POLISH_ENABLED } from "@/lib/studio-p2-polish"
import "./intelligence-p2.css"

/** NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE (default off; build-time). The Intelligence page's model chooser, as the accepted v4 mockup has it: five task rows (Planning & Strategy,
 * Content Writing, Research & Analysis, Imagery, Voice & Narration), each naming its current model and where it came from, with a select of the recommendation, the presets,
 * the specific models and (narration) the voices. A choice applies on change and is kept in this browser (localStorage, never the account); "Reset to recommendations" appears
 * only when something changed. No request is made, nothing is sent to a model, nothing is saved to the account. The model list, the comparison and the catalog are the page's own. */
export function IntelligenceChooser() {
  const [choices, setChoices] = useState<P2Choices>(p2DefaultChoices)
  const [activeTask, setActiveTask] = useState<P2TaskId>("planning_strategy")
  const [comparison, setComparison] = useState<string>(() => p2ComparisonFor(catalog, "planning_strategy", P2_DEFAULT_CHOICE))
  const [feedback, setFeedback] = useState("")
  const [storage, setStorage] = useState<P2Storage>("pending")
  const [restored, setRestored] = useState(false)
  const changed = p2ChangedCount(choices)
  const status = p2Status(changed, storage)

  function inspect(id: P2TaskId) {
    setActiveTask(id)
    if (id !== "voice_narration") setComparison(p2ComparisonFor(catalog, id, choices[id]))
  }

  // The viewer's choices are read once after hydration (the earlier Design preview draft, if that is all there is) and kept on every change. Every storage access is guarded:
  // if one throws, the choices last for the session only and leaving is warned about. An unchanged set is kept as well, so a reset is not undone by the earlier draft.
  useEffect(() => {
    let restoredChoices: P2Choices | null = null
    let ok = true
    try {
      const raw = window.localStorage.getItem(p2StorageKey(catalog))
      restoredChoices = raw !== null ? p2Parse(catalog, raw) : p2FromLegacyDraft(catalog, parseSavedDraft(window.localStorage.getItem(draftStorageKey()))?.draft ?? null)
    } catch { ok = false }
    if (restoredChoices) { setChoices(restoredChoices); setComparison(p2ComparisonFor(catalog, "planning_strategy", restoredChoices.planning_strategy)); setFeedback("Your earlier choices were restored.") }
    setStorage(ok ? "ok" : "unavailable")
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])
  useEffect(() => {
    if (!restored || storage === "unavailable") return
    try { window.localStorage.setItem(p2StorageKey(catalog), p2Serialize(catalog, choices)) } catch { setStorage("unavailable") }
  }, [restored, storage, choices])
  useEffect(() => {
    if (!changed || storage !== "unavailable") return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [changed, storage])

  function choose(id: P2TaskId, value: string) {
    if (!isP2Choice(catalog, id, value)) return
    const next = { ...choices, [id]: value }
    setChoices(next)
    if (id === activeTask && id !== "voice_narration") setComparison(current => p2Resolve(catalog, id, value).modelId === current ? p2ComparisonFor(catalog, id, value) : current)
    setFeedback(p2ChoiceFeedback(catalog, id, value, storage))
  }
  function reset() {
    const next = p2DefaultChoices()
    setChoices(next)
    if (activeTask !== "voice_narration") setComparison(p2ComparisonFor(catalog, activeTask, P2_DEFAULT_CHOICE))
    setFeedback(P2_RESET_FEEDBACK)
  }

  const active = p2Resolve(catalog, activeTask, choices[activeTask])
  const activeLabel = P2_TASKS.find(task => task.id === activeTask)?.label ?? ""

  return <>
    <header className="sp-heading"><div><p className="sp-eyebrow">WORK WITH DECKSTER</p><h1>Intelligence</h1><p>Choose the model behind each part of your story.</p></div>
      <span className="sp-draft-badge sp-ip-pill sp-p2-pill" data-state={status.state === "saved" ? "kept" : status.state} data-p2-status={status.state}>
        {status.state === "saved" ? <CheckCircle2 size={14} aria-hidden="true" /> : status.state === "session" ? <AlertCircle size={14} aria-hidden="true" /> : <span />}{status.label}
      </span></header>
    <div className="sp-context-bar sp-ip-bar"><IntelligenceScope /><div className="sp-ip-bar-end"><IntelligenceReadiness /></div></div>
    <p className="sp-p2-note" id="sp-p2-note" data-p2-note="true"><Info size={14} aria-hidden="true" />{storage === "unavailable" ? P2_ONE_LINE_NO_STORAGE : P2_ONE_LINE}</p>
    <span className="sp-feedback sp-p2-feedback" role="status">{feedback}</span>

    <div className="sp-model-layout sp-p2-layout">
      <div className="sp-p2-main" {...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})}>
      <section className="sp-p2-card" aria-labelledby="sp-p2-tasks-heading">
        <div className="sp-p2-card-head"><h2 id="sp-p2-tasks-heading">FIVE TASKS, FIVE CHOICES</h2>
          {changed > 0 && <button type="button" className="sp-p2-reset" data-p2-reset="true" onClick={reset}><RotateCcw size={12} aria-hidden="true" /><span>{P2_RESET_LABEL}</span></button>}
        </div>
        <div role="list" aria-label="Model activity groups">
          {P2_TASKS.map(task => {
            const Icon = task.id === "voice_narration" ? AudioLines : taskDetails[task.id].icon
            const resolved = p2Resolve(catalog, task.id, choices[task.id])
            const options = p2Options(catalog, task.id)
            return <div className="sp-p2-row" role="listitem" data-active={activeTask === task.id} data-model-task={task.id} key={task.id}>
              <button type="button" className="sp-task-inspect sp-p2-inspect" aria-pressed={activeTask === task.id} aria-label={task.id === "voice_narration" ? `Show ${task.label} choices` : `Compare ${task.label} models`} onClick={() => inspect(task.id)}>
                <span className="sp-task-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
                <span><strong>{task.label}</strong><small>{task.descriptors.join(" · ")}</small></span>
              </button>
              <div className="sp-p2-current" data-p2-current={task.id}><strong>{resolved.name}</strong><span>{p2OriginLine(resolved)}</span></div>
              <div className="sp-p2-pick">
                <label className="sr-only" htmlFor={`sp-p2-model-${task.id}`}>{task.label} model</label>
                <select id={`sp-p2-model-${task.id}`} aria-describedby="sp-p2-note" value={choices[task.id]} onFocus={() => { if (activeTask !== task.id) inspect(task.id) }} onChange={event => choose(task.id, event.target.value)}>
                  <option value={options.recommended.value}>{options.recommended.label}</option>
                  {options.presets.length > 0 && <optgroup label="Presets">{options.presets.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
                  <optgroup label="Specific models">{options.models.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>
                  {options.voices.length > 0 && <optgroup label="Voices">{options.voices.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
                </select>
              </div>
            </div>
          })}
        </div>
      </section>
      <ManagedByDeckster />
      <details className="sp-provenance sp-p2-provenance"><summary>About this catalog <span>Design snapshot · {catalog.version}</span></summary><p>{provenanceText}</p></details>
      </div>

      <aside className="sp-model-inspector sp-p2-inspector" aria-labelledby="sp-comparison-heading" data-p2-inspector={activeTask} {...(STUDIO_P2_POLISH_ENABLED ? { [STUDIO_P2_POLISH_ATTR]: "true" } : {})}>
        <div className="sp-inspector-top"><span className="sp-eyebrow"><ArrowDownUp size={14} aria-hidden="true" /> MODEL COMPARISON</span><h2 id="sp-comparison-heading">{activeLabel}</h2>
          <p>{activeTask === "voice_narration" ? "Pick the model and voice that read your presentation aloud." : taskDetails[activeTask].example}</p></div>
        <div className="sp-current-model"><span>Your current choice</span><strong>{active.name}</strong><small>{p2OriginLine(active)}</small></div>
        {activeTask === "voice_narration" ? <VoiceInspector /> : <ModelComparison task={activeTask} choice={choices[activeTask]} comparison={comparison} onCompare={setComparison} onUse={id => choose(activeTask, `model:${id}`)} />}
      </aside>
    </div>
  </>
}

function ModelComparison({ task, choice, comparison, onCompare, onUse }: { task: Exclude<P2TaskId, "voice_narration">; choice: string; comparison: string; onCompare: (id: string) => void; onUse: (id: string) => void }) {
  const entry = catalog.tasks[task]
  const chosen = catalog.models[p2Resolve(catalog, task, choice).modelId]
  const alternative = catalog.models[comparison]
  const same = chosen === alternative
  return <>
    <label className="sp-field"><span>Compare with</span><select value={comparison} onChange={event => onCompare(event.target.value)}>{entry.models.map(id => <option key={id} value={id}>{catalog.models[id].name}</option>)}</select></label>
    <table className="sp-comparison-table">
      <caption className="sr-only">Static catalog comparison for {entry.label}</caption>
      <thead><tr><th scope="col">Detail</th><th scope="col">Current</th><th scope="col">Compare</th></tr></thead>
      <tbody>
        <tr><th scope="row">Context window</th><td>{chosen.contextWindow.toLocaleString("en-US")}</td><td>{alternative.contextWindow.toLocaleString("en-US")}</td></tr>
        <tr><th scope="row">Image output</th><td>{chosen.imageOutput ? "Yes" : "No"}</td><td>{alternative.imageOutput ? "Yes" : "No"}</td></tr>
        <tr><th scope="row">Tool support</th><td>{chosen.tools ? "Yes" : "No"}</td><td>{alternative.tools ? "Yes" : "No"}</td></tr>
        {catalogRefreshed && <>
          <tr><th scope="row">Release status</th><td>{releaseLabel(chosen.releaseStage)}</td><td>{releaseLabel(alternative.releaseStage)}</td></tr>
          <tr><th scope="row">Price per 1M tokens</th><td>{priceLabel(chosen)}</td><td>{priceLabel(alternative)}</td></tr>
          <tr><th scope="row">Structured output</th><td>{chosen.structuredOutput === undefined ? "Not listed" : chosen.structuredOutput ? "Yes" : "No"}</td><td>{alternative.structuredOutput === undefined ? "Not listed" : alternative.structuredOutput ? "Yes" : "No"}</td></tr>
          <tr><th scope="row">Input types</th><td>{inputsLabel(chosen.inputModalities)}</td><td>{inputsLabel(alternative.inputModalities)}</td></tr>
        </>}
      </tbody>
    </table>
    <p className="sp-comparison-note">{catalogRefreshed ? "Snapshot specifications and public list prices only. Speed, quality, and live availability have not been verified." : "Snapshot specifications only. Speed, quality, pricing, and live availability have not been verified."}</p>
    <button type="button" className="sp-button sp-button-accent" style={same ? DISABLED_ACTION_OPAQUE : undefined} disabled={same} onClick={() => onUse(comparison)}>Use this model</button>
  </>
}

/** Narration models carry no specifications in the catalog, so there is nothing to compare: the inspector lists what the select offers and says so. */
function VoiceInspector() {
  return <div className="sp-p2-voices" data-p2-voices="true">
    <ul>{P2_VOICE_MODELS.map(model => <li key={model.id}><strong>{model.name}</strong><span>{model.provider} · {model.voices.map(voice => voice.name).join(", ")}</span></li>)}</ul>
    <p className="sp-comparison-note">Narration models are not compared here. Narration still uses the existing delivery controls.</p>
  </div>
}
