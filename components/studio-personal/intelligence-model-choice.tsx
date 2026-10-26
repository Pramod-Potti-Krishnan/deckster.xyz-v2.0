"use client"

import { useEffect, useState } from "react"
import { AlertCircle, ArrowDownUp, AudioLines, CheckCircle2, FileText, Info, RotateCcw, UserRound } from "lucide-react"
import { catalog, catalogRefreshed, DISABLED_ACTION_OPAQUE, inputsLabel, IntelligenceReadiness, ManagedByDeckster, priceLabel, provenanceText, releaseLabel, taskDetails } from "./intelligence-workspace"
import { P2_DEFAULT_CHOICE, P2_RESET_FEEDBACK, P2_RESET_LABEL, P2_TASKS, p2StorageKey, type P2TaskId } from "@/lib/studio-intelligence-p2"
import { classifyCatalogueResponse, MODEL_CATALOG_ENDPOINT } from "@/lib/studio-model-catalog"
import {
  MODEL_CHOICE_CONFLICT, MODEL_CHOICE_COST_NOTE, MODEL_CHOICE_DROPPED, MODEL_CHOICE_FALLBACK_NOTE, MODEL_CHOICE_FIXED_NOTE, MODEL_CHOICE_LOADING, MODEL_CHOICE_NO_MODELS, MODEL_CHOICE_NOTE, MODEL_CHOICE_REFUSED,
  MODEL_CHOICE_RESTORED, MODEL_CHOICE_SCOPE_DECK_NONE, MODEL_CHOICE_SCOPE_DECK_NOT_SAVED, MODEL_CHOICE_SCOPE_DECK_RULE, MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE, USER_SCOPE, buildIdFromSearch, changedCount, choiceFeedback, createAccountChoiceStore,
  createDeviceChoiceStore, createModelChoiceStore, deckIdFromSearch, defaultOption, droppedChoices, effectiveChoices, modelChoiceDefaults, modelChoiceUsedUrl, modelsUsedRows, originLine, resolveInScope,
  rowSources, staticTasks, withPresets,
  type ChoiceCatalogue, type DeviceReason, type ModelChoiceSave, type ModelChoiceScope, type ModelChoices, type RouteFetch, type RowSource, type SaveMode,
} from "@/lib/studio-model-choice"
import "./intelligence-p2.css"
import "./intelligence-model-choice.css"

/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE (exact "true", default off; build-time). It acts only with NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE on: the Pass 2 chooser's place on the Intelligence page. */
export const STUDIO_MODEL_CHOICE_ENABLED = process.env.NEXT_PUBLIC_STUDIO_MODEL_CHOICE === "true" && process.env.NEXT_PUBLIC_STUDIO_P2_INTELLIGENCE === "true"
/** The Studio route /api/models/catalogue exists only with NEXT_PUBLIC_STUDIO_MODEL_CATALOG on; without it nothing is asked and the built-in list is shown. */
const CATALOGUE_ROUTE_ON = process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG === "true"

type LiveState = { state: "loading" } | { state: "live"; catalogue: ChoiceCatalogue } | { state: "fallback" }
type Storage = "pending" | "ok" | "unavailable"
type DeckState = "none" | "ok" | "not-available" | "not-saved"

/** Studio's own routes only (same origin): the browser never calls Director or the router, and never sends a user id. */
const routeFetch: RouteFetch = async (url, init) => {
  const response = await fetch(url, { method: init.method, headers: init.headers, body: init.body, credentials: "same-origin", cache: "no-store" })
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body, etag: response.headers.get("etag") }
}
// The adapter (lib/studio-model-choice.ts): the account first (the router, through Studio's routes), this browser when saving is not switched on or cannot be reached. The Pass 2 picker's key for this
// build's catalog is read once, on this device, to carry its choices over.
const store = createModelChoiceStore({
  account: createAccountChoiceStore({ fetchJson: routeFetch }),
  device: createDeviceChoiceStore({ storage: () => window.localStorage, legacyKey: p2StorageKey(catalog) }),
})

const taskLabel = (id: P2TaskId) => P2_TASKS.find(task => task.id === id)?.label ?? id
const firstOther = (source: RowSource, current: string | null) => source.compareIds.find(id => id !== current) ?? source.compareIds[0] ?? null

/** The Intelligence page's model chooser with the live model catalogue (the Pass 2 chooser's markup and classes). The three text tasks offer their catalogue group's certified models and presets (Best /
 * Balanced / Fast with a cost hint), "Suggested" marking the router's shortlist; imagery and narration are "Fixed for now". Choices apply on change, per scope ("Reusable defaults", or "This presentation"
 * when the page was opened with the Builder's ?session_id=), and are saved to the account through Studio's routes, or kept on this device while that is not switched on. */
export function ModelChoiceChooser() {
  const [live, setLive] = useState<LiveState>(() => (CATALOGUE_ROUTE_ON ? { state: "loading" } : { state: "fallback" }))
  const [deckId, setDeckId] = useState<string | null>(null)
  const [buildId, setBuildId] = useState<string | null>(null)
  const [deckState, setDeckState] = useState<DeckState>("none")
  const [scopeKind, setScopeKind] = useState<"user" | "deck">("user")
  const [userChoices, setUserChoices] = useState<ModelChoices>(modelChoiceDefaults)
  const [deckChoices, setDeckChoices] = useState<ModelChoices>(modelChoiceDefaults)
  const [activeTask, setActiveTask] = useState<P2TaskId>("planning_strategy")
  const [comparison, setComparison] = useState<{ task: P2TaskId; id: string } | null>(null)
  const [feedback, setFeedback] = useState("")
  const [storage, setStorage] = useState<Storage>("pending")
  const [mode, setMode] = useState<SaveMode | "pending">("pending")
  const [reason, setReason] = useState<DeviceReason>(null)
  const [used, setUsed] = useState<unknown>(null)

  const liveCatalogue = live.state === "live" ? live.catalogue : null
  const loading = live.state === "loading"
  const sources = rowSources(liveCatalogue, catalog)
  const scope: ModelChoiceScope = scopeKind === "deck" && deckId && deckState === "ok" ? { kind: "deck", deckId } : USER_SCOPE
  const raw = scope.kind === "deck" ? deckChoices : userChoices
  const choices = effectiveChoices(raw, sources)
  const userEffective = effectiveChoices(userChoices, sources)
  const changed = loading ? 0 : changedCount(choices)
  const status = changed === 0 ? { state: "clean", label: "Following recommendations" } : storage === "unavailable" ? { state: "session", label: "Session only" } : mode === "account" ? { state: "saved", label: "Saved to your account" } : { state: "saved", label: "Saved on this device" }
  const note = storage === "unavailable" ? MODEL_CHOICE_NOTE["no-storage"] : mode === "account" ? MODEL_CHOICE_NOTE.account : mode === "device" && reason ? MODEL_CHOICE_NOTE[reason] : MODEL_CHOICE_NOTE.pending

  // The live catalogue, read once through the Studio route (never from the browser to Director or the router). Anything but a catalogue this page can read falls back to the built-in list.
  useEffect(() => {
    if (!CATALOGUE_ROUTE_ON) return
    let alive = true
    fetch(MODEL_CATALOG_ENDPOINT, { credentials: "same-origin", cache: "no-store" })
      .then(async response => { let body: unknown = null; try { body = await response.json() } catch { body = null } return { status: response.status, body } })
      .then(({ status: code, body }) => {
        if (!alive) return
        const result = classifyCatalogueResponse(code, body)
        setLive(result.kind === "ready" ? { state: "live", catalogue: withPresets(result.catalogue, body) } : { state: "fallback" })
      })
      .catch(() => { if (alive) setLive({ state: "fallback" }) })
    return () => { alive = false }
  }, [])

  // The deck and build the page was opened from, and the kept choices of both scopes, once after hydration. A device storage access that throws keeps the choices for this session only.
  useEffect(() => {
    let alive = true
    const id = deckIdFromSearch(window.location.search)
    setDeckId(id)
    setBuildId(id ? buildIdFromSearch(window.location.search) : null)
    ;(async () => {
      try {
        const user = await store.loadChoices(USER_SCOPE)
        const deck = id ? await store.loadChoices({ kind: "deck", deckId: id }) : null
        if (!alive) return
        setUserChoices(user.choices)
        if (deck && !deck.deckUnavailable) { setDeckChoices(deck.choices); setDeckState("ok"); setScopeKind("deck") }
        else if (deck?.deckUnavailable) setDeckState(deck.deckUnavailable)
        if (user.restored || (deck?.restored && !deck.deckUnavailable)) setFeedback(MODEL_CHOICE_RESTORED)
        setStorage("ok")
      } catch { if (alive) setStorage("unavailable") }
      if (alive) { setMode(store.mode()); setReason(store.reason()) }
    })()
    return () => { alive = false }
  }, [])

  // "Used for this deck": only with a deck and a build the page was opened with; nothing is drawn without its data.
  useEffect(() => {
    if (!deckId || !buildId) return
    let alive = true
    routeFetch(modelChoiceUsedUrl(buildId), { method: "GET" }).then(answer => { if (alive) setUsed(answer.status === 200 ? answer.body : null) }).catch(() => { if (alive) setUsed(null) })
    return () => { alive = false }
  }, [deckId, buildId])

  // Once both are in: a kept choice the catalogue no longer offers follows the recommendation, and the person is told (it stays kept, so a catalogue that comes back offers it again).
  const settled = !loading && storage !== "pending"
  const dropped = settled ? droppedChoices(userChoices, sources).length + droppedChoices(deckChoices, sources).length : 0
  useEffect(() => { if (dropped > 0) setFeedback(MODEL_CHOICE_DROPPED) }, [dropped])

  useEffect(() => {
    if (!changed || storage !== "unavailable") return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [changed, storage])

  function setFor(target: ModelChoiceScope, next: ModelChoices) {
    if (target.kind === "deck") setDeckChoices(next)
    else setUserChoices(next)
  }
  /** Shows `next` at once and keeps it; settles what the save says (a conflict shows the saved choices, a refusal puts the earlier ones back, a missing deck scope goes back to the defaults). */
  async function keep(next: ModelChoices): Promise<ModelChoiceSave | { mode: "session" }> {
    const target = scope, before = raw
    setFor(target, next)
    if (storage === "unavailable") return { mode: "session" }
    let result: ModelChoiceSave
    try { result = await store.saveChoices(target, next) } catch { setStorage("unavailable"); return { mode: "session" } }
    setMode(store.mode()); setReason(store.reason())
    if (result.conflict) setFor(target, result.conflict)
    else if (result.refused) setFor(target, before)
    else if (result.deckUnavailable) { setDeckState(result.deckUnavailable); setScopeKind("user"); setFor(target, before) }
    return result
  }
  const settleWords = (result: ModelChoiceSave | { mode: "session" }, words: (mode: SaveMode | "session") => string) =>
    "conflict" in result && result.conflict ? MODEL_CHOICE_CONFLICT : "refused" in result && result.refused ? MODEL_CHOICE_REFUSED : "deckUnavailable" in result && result.deckUnavailable ? (result.deckUnavailable === "not-available" ? MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE : MODEL_CHOICE_SCOPE_DECK_NOT_SAVED) : words(result.mode)
  function choose(task: P2TaskId, value: string) {
    const source = sources[task]
    if (loading || storage === "pending" || source.kind === "fixed" || !source.isChoice(value)) return
    const resolved = resolveInScope(source, scope, value, userEffective[task])
    const target = scope
    keep({ ...raw, [task]: value }).then(result => setFeedback(settleWords(result, savedIn => choiceFeedback(taskLabel(task), resolved, value, savedIn, target))))
  }
  function reset() {
    if (storage === "pending") return
    const target = scope
    keep(modelChoiceDefaults()).then(result => setFeedback(settleWords(result, () => (target.kind === "deck" ? "This presentation now follows your reusable defaults." : P2_RESET_FEEDBACK))))
  }
  function pickScope(next: "user" | "deck") {
    if (next === "deck" && !(deckId && deckState === "ok")) return
    setScopeKind(next)
    setFeedback("")
  }

  const activeSource = sources[activeTask]
  const active = resolveInScope(activeSource, scope, choices[activeTask], userEffective[activeTask])
  const compareId = comparison && comparison.task === activeTask && activeSource.compareIds.includes(comparison.id) ? comparison.id : firstOther(activeSource, active.modelId)
  const kept = staticTasks(sources, liveCatalogue)
  const anyPresets = P2_TASKS.some(task => sources[task.id].options.presets.length > 0)
  const deckNote = !deckId ? MODEL_CHOICE_SCOPE_DECK_NONE : deckState === "not-available" ? MODEL_CHOICE_SCOPE_DECK_UNAVAILABLE : deckState === "not-saved" ? MODEL_CHOICE_SCOPE_DECK_NOT_SAVED : scope.kind === "deck" ? MODEL_CHOICE_SCOPE_DECK_RULE : ""

  return <>
    <header className="sp-heading"><div><p className="sp-eyebrow">WORK WITH DECKSTER</p><h1>Intelligence</h1><p>Choose the model behind each part of your story.</p></div>
      <span className="sp-draft-badge sp-ip-pill sp-p2-pill" data-state={status.state === "saved" ? "kept" : status.state} data-p2-status={status.state} data-model-choice-mode={mode}>
        {status.state === "saved" ? <CheckCircle2 size={14} aria-hidden="true" /> : status.state === "session" ? <AlertCircle size={14} aria-hidden="true" /> : <span />}{status.label}
      </span></header>
    <div className="sp-context-bar sp-ip-bar" data-model-choice-bar="true"><ScopeControl scope={scope.kind} deckAvailable={Boolean(deckId) && deckState === "ok"} note={deckNote} onPick={pickScope} /><div className="sp-ip-bar-end"><IntelligenceReadiness /></div></div>
    <p className="sp-p2-note" id="sp-p2-note" data-p2-note="true"><Info size={14} aria-hidden="true" />{note}</p>
    {live.state === "fallback" && <p className="sp-p2-note sp-mc2-quiet" data-model-choice-fallback="true">{MODEL_CHOICE_FALLBACK_NOTE}</p>}
    {kept.length > 0 && <p className="sp-p2-note sp-mc2-quiet" data-model-choice-static={kept.join(" ")}>{kept.map(taskLabel).join(", ")} {kept.length === 1 ? "keeps" : "keep"} the built-in list: the model catalog has no group open for {kept.length === 1 ? "it" : "them"}.</p>}
    <span className="sp-feedback sp-p2-feedback" role="status">{feedback}</span>

    <div className="sp-model-layout sp-p2-layout" data-model-choice="true" data-model-choice-source={live.state} data-model-choice-scope={scope.kind}>
      <div className="sp-p2-main">
      <section className="sp-p2-card" aria-labelledby="sp-p2-tasks-heading">
        <div className="sp-p2-card-head"><h2 id="sp-p2-tasks-heading">FIVE TASKS, FIVE CHOICES</h2>
          {changed > 0 && <button type="button" className="sp-p2-reset" data-p2-reset="true" onClick={reset}><RotateCcw size={12} aria-hidden="true" /><span>{scope.kind === "deck" ? "Use my reusable defaults" : P2_RESET_LABEL}</span></button>}
        </div>
        <div role="list" aria-label="Model activity groups">
          {P2_TASKS.map(task => {
            const Icon = task.id === "voice_narration" ? AudioLines : taskDetails[task.id].icon
            const source = sources[task.id]
            const resolved = resolveInScope(source, scope, choices[task.id], userEffective[task.id])
            const options = source.options
            const empty = source.kind === "live" && options.presets.length === 0 && options.models.length === 0
            return <div className="sp-p2-row" role="listitem" data-active={activeTask === task.id} data-model-task={task.id} data-model-choice-source={source.kind === "fixed" ? "fixed" : loading ? "loading" : source.kind} key={task.id}>
              <button type="button" className="sp-task-inspect sp-p2-inspect" aria-pressed={activeTask === task.id} aria-label={task.id === "voice_narration" ? `Show ${task.label} choices` : `Compare ${task.label} models`} onClick={() => setActiveTask(task.id)}>
                <span className="sp-task-icon"><Icon size={19} strokeWidth={1.7} aria-hidden="true" /></span>
                <span><strong>{task.label}</strong><small>{task.descriptors.join(" · ")}</small></span>
              </button>
              <div className="sp-p2-current" data-p2-current={task.id}>{loading && source.kind !== "fixed" ? <><strong>{MODEL_CHOICE_LOADING}</strong><span /></> : <><strong>{resolved.name}</strong><span>{originLine(resolved)}</span></>}</div>
              <div className="sp-p2-pick">
                {source.kind === "fixed"
                  ? <p className="sp-mc2-fixed" data-model-choice-fixed={task.id}>{MODEL_CHOICE_FIXED_NOTE}</p>
                  : <>
                    <label className="sr-only" htmlFor={`sp-p2-model-${task.id}`}>{task.label} model</label>
                    {loading
                      ? <select id={`sp-p2-model-${task.id}`} aria-describedby="sp-p2-note" value="" disabled onChange={() => undefined}><option value="">{MODEL_CHOICE_LOADING}</option></select>
                      : <select id={`sp-p2-model-${task.id}`} aria-describedby={["sp-p2-note", anyPresets ? "sp-mc2-cost" : "", empty ? `sp-mc2-none-${task.id}` : ""].filter(Boolean).join(" ")} value={choices[task.id]} onFocus={() => { if (activeTask !== task.id) setActiveTask(task.id) }} onChange={event => choose(task.id, event.target.value)}>
                        <option value={P2_DEFAULT_CHOICE}>{defaultOption(source, scope, userEffective[task.id]).label}</option>
                        {options.presets.length > 0 && <optgroup label="Presets">{options.presets.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
                        {options.models.length > 0 && <optgroup label="Specific models">{options.models.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</optgroup>}
                      </select>}
                    {empty && <small className="sp-mc2-none" id={`sp-mc2-none-${task.id}`} data-model-choice-none={task.id}>{MODEL_CHOICE_NO_MODELS}</small>}
                  </>}
              </div>
            </div>
          })}
        </div>
      </section>
      {anyPresets && !loading && <p className="sp-p2-note sp-mc2-quiet sp-mc2-cost" id="sp-mc2-cost" data-model-choice-cost="true">{MODEL_CHOICE_COST_NOTE}</p>}
      <ModelsUsedForDeck data={used} live={liveCatalogue} />
      <ManagedByDeckster />
      <details className="sp-provenance sp-p2-provenance"><summary>About this catalog <span>{liveCatalogue ? `Live catalog · ${liveCatalogue.version ?? "version not named"}` : `Design snapshot · ${catalog.version}`}</span></summary>
        <p>{liveCatalogue ? "Model names, presets and the models open for each task come from Deckster’s model catalog. Only models certified for a task are offered." : provenanceText}</p></details>
      </div>

      <aside className="sp-model-inspector sp-p2-inspector" aria-labelledby="sp-comparison-heading" data-p2-inspector={activeTask}>
        <div className="sp-inspector-top"><span className="sp-eyebrow"><ArrowDownUp size={14} aria-hidden="true" /> MODEL COMPARISON</span><h2 id="sp-comparison-heading">{taskLabel(activeTask)}</h2>
          <p>{activeTask === "voice_narration" ? "Narration still uses the existing delivery controls." : taskDetails[activeTask].example}</p></div>
        <div className="sp-current-model"><span>Your current choice</span><strong>{loading && activeSource.kind !== "fixed" ? MODEL_CHOICE_LOADING : active.name}</strong><small>{loading && activeSource.kind !== "fixed" ? "" : originLine(active)}</small></div>
        {activeSource.kind === "fixed" ? <p className="sp-comparison-note" data-model-choice-none="fixed">{MODEL_CHOICE_FIXED_NOTE}</p>
          : loading ? null
          : <Comparison source={activeSource} current={active.modelId} compareId={compareId} label={taskLabel(activeTask)} onCompare={id => setComparison({ task: activeTask, id })} onUse={id => choose(activeTask, `model:${id}`)} />}
      </aside>
    </div>
  </>
}

/** Where a choice applies: two labelled radios. "This presentation" needs the Builder's session the page was opened from, and the router's deck scope. */
function ScopeControl({ scope, deckAvailable, note, onPick }: { scope: "user" | "deck"; deckAvailable: boolean; note: string; onPick: (scope: "user" | "deck") => void }) {
  return <div className="sp-ip-scope-group sp-mc2-scope-group">
    <fieldset className="sp-preview-switcher sp-ip-scope sp-mc2-scope" aria-describedby={note ? "sp-mc2-scope-note" : undefined}>
      <legend className="sr-only">Where your choices apply</legend>
      <label data-checked={scope === "user" ? "true" : "false"}><input type="radio" name="sp-mc2-scope" value="user" checked={scope === "user"} onChange={() => onPick("user")} /><UserRound size={15} aria-hidden="true" />Reusable defaults</label>
      <label data-checked={scope === "deck" ? "true" : "false"} data-disabled={deckAvailable ? undefined : "true"}><input type="radio" name="sp-mc2-scope" value="deck" checked={scope === "deck"} disabled={!deckAvailable} onChange={() => onPick("deck")} /><FileText size={15} aria-hidden="true" />This presentation</label>
    </fieldset>
    {note && <span className="sp-ip-scope-note" id="sp-mc2-scope-note">{note}</span>}
  </div>
}

const countLabel = (value: number | null) => (value === null ? "Not listed" : value.toLocaleString("en-US"))
const yesNo = (value: boolean | undefined) => (value ? "Yes" : "No")

function Comparison({ source, current, compareId, label, onCompare, onUse }: { source: RowSource; current: string | null; compareId: string | null; label: string; onCompare: (id: string) => void; onUse: (id: string) => void }) {
  if (compareId === null) return <p className="sp-comparison-note" data-model-choice-none="compare">{MODEL_CHOICE_NO_MODELS}</p>
  const chosen = current ? source.info(current) : null
  const alternative = source.info(compareId)
  const same = current === compareId
  const extras = source.kind === "static" && catalogRefreshed
  const cell = (fn: (id: string) => string, id: string | null) => (id && catalog.models[id] ? fn(id) : "Not fixed")
  return <>
    <label className="sp-field"><span>Compare with</span><select value={compareId} onChange={event => onCompare(event.target.value)}>{source.compareIds.map(id => <option key={id} value={id}>{source.info(id)?.name ?? id}</option>)}</select></label>
    <table className="sp-comparison-table">
      <caption className="sr-only">{source.kind === "live" ? "Catalog comparison" : "Static catalog comparison"} for {label}</caption>
      <thead><tr><th scope="col">Detail</th><th scope="col">Current</th><th scope="col">Compare</th></tr></thead>
      <tbody>
        <tr><th scope="row">Context window</th><td>{chosen ? countLabel(chosen.contextWindow) : "Not fixed"}</td><td>{countLabel(alternative?.contextWindow ?? null)}</td></tr>
        <tr><th scope="row">Image output</th><td>{chosen ? yesNo(chosen.imageOutput) : "Not fixed"}</td><td>{yesNo(alternative?.imageOutput)}</td></tr>
        <tr><th scope="row">Tool support</th><td>{chosen ? yesNo(chosen.tools) : "Not fixed"}</td><td>{yesNo(alternative?.tools)}</td></tr>
        {extras && <>
          <tr><th scope="row">Release status</th><td>{cell(id => releaseLabel(catalog.models[id].releaseStage), current)}</td><td>{cell(id => releaseLabel(catalog.models[id].releaseStage), compareId)}</td></tr>
          <tr><th scope="row">Price per 1M tokens</th><td>{cell(id => priceLabel(catalog.models[id]), current)}</td><td>{cell(id => priceLabel(catalog.models[id]), compareId)}</td></tr>
          <tr><th scope="row">Input types</th><td>{cell(id => inputsLabel(catalog.models[id].inputModalities), current)}</td><td>{cell(id => inputsLabel(catalog.models[id].inputModalities), compareId)}</td></tr>
        </>}
      </tbody>
    </table>
    <p className="sp-comparison-note">{source.kind === "live" ? "Catalog specifications only. Speed, quality, pricing, and live availability have not been verified." : catalogRefreshed ? "Snapshot specifications and public list prices only. Speed, quality, and live availability have not been verified." : "Snapshot specifications only. Speed, quality, pricing, and live availability have not been verified."}</p>
    <button type="button" className="sp-button sp-button-accent" style={same ? DISABLED_ACTION_OPAQUE : undefined} disabled={same} onClick={() => onUse(compareId)}>Use this model</button>
  </>
}

/** "Used for this deck": the models one build of this presentation actually used, in the router doc's words (lib/studio-model-choice.ts usedReasonCopy). It draws nothing without data: no deck, no build id
 * (the Builder's build_phase.build_id; the link that carries it from the Builder is not built yet), or no answer from /api/model-choice/used. */
export function ModelsUsedForDeck({ data, live }: { data: unknown; live: ChoiceCatalogue | null }) {
  const rows = modelsUsedRows(data, live)
  if (rows.length === 0) return null
  return <section className="sp-p2-card sp-mc2-used" data-model-choice-used="true" aria-labelledby="sp-mc2-used-heading">
    <div className="sp-p2-card-head"><h2 id="sp-mc2-used-heading">USED FOR THIS DECK</h2></div>
    <ul>{rows.map(row => <li key={row.key}><strong>{row.label}</strong><span>{row.copy}</span></li>)}</ul>
  </section>
}
