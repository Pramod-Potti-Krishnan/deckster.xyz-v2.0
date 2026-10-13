"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { AlertCircle, ArrowDownUp, ArrowRight, AudioLines, BookOpen, CheckCircle2, ChevronDown, Compass, Database, FileText, ImageIcon, Info, LockKeyhole, PenLine, Presentation, RotateCcw, Search, Settings2, SlidersHorizontal, Sparkles, UserRound, X } from "lucide-react"
import { StudioWorkflowAction } from "@/components/studio-libraries/studio-workflow-action"
import { BackToBuilderButton } from "@/components/layout/app-header"
import baseCatalog from "./model-catalog-snapshot.json"
import refreshedCatalog from "./model-catalog-snapshot-2026-10.json"
import { StudioIntroReplay } from "@/components/studio-intro-replay"
import "@/components/studio-libraries/destination-intros.css"
import "./personal-workspaces.css"
import "./intelligence-workspace.css"
import "./intelligence-polish.css"

type TaskId = keyof typeof baseCatalog.tasks
type CatalogModel = {
  name: string; provider: string; contextWindow: number; imageOutput: boolean; tools: boolean
  releaseStage?: string; inputModalities?: string[]; structuredOutput?: boolean; pricePerMillionTokens?: { input: number; output: number }; priceNote?: string
}
type Catalog = {
  version: string; source: string
  tasks: Record<TaskId, { label: string; defaultModel: string; models: string[] }>
  models: Record<string, CatalogModel>
  retiredModels?: Record<string, { name: string; retiresOn: string; successor: string }>
}
/** NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 (default off; build-time). On: the 2026-10-13.1 snapshot replaces 2026-08-20.1, with the retiring
 * Gemini 2.5 Flash, Flash Lite and Pro swapped for their 3.x successors, and the comparison shows release status, inputs, structured output and
 * list price. Off: the 2026-08-20.1 catalog and every rendered byte are unchanged. */
const catalogRefreshed = process.env.NEXT_PUBLIC_STUDIO_MODEL_CATALOG_2026_10 === "true"
const catalog: Catalog = catalogRefreshed ? refreshedCatalog : baseCatalog
type ModelId = keyof typeof catalog.models
type Draft = Record<TaskId, string>
/** NEXT_PUBLIC_STUDIO_INTELLIGENCE_POLISH (default off; build-time), independent of the catalog flag. On, in Design preview only: the draft is kept in this
 * browser (localStorage, never the account) and restored on reload, with the view; a scope toggle (Reusable defaults, and This presentation shown disabled),
 * the "Your own intelligence" readiness popup, the "Managed by Deckster" section and a single save-status pill appear; and the repeated "not connected"
 * disclaimers become one note. No request is made, nothing is sent to a model, nothing is saved to the account. Off: every rendered byte is unchanged. */
const polish = process.env.NEXT_PUBLIC_STUDIO_INTELLIGENCE_POLISH === "true"
type DraftStorage = "pending" | "ok" | "unavailable"
type DraftStatus = { changed: number; storage: DraftStorage }
type SavedDraft = { draft: Draft; activeTask: TaskId; view: "current" | "design" }
const emptyBriefs = (): Draft => ({ planning_strategy: "", content_writing: "", research_analysis: "", imagery: "" })
const taskIds = Object.keys(catalog.tasks) as TaskId[]
const taskDetails = {
  planning_strategy: { icon: Compass, description: "Structure, storyline, and the big picture", example: "Turn a brief into a clear narrative and slide outline." },
  content_writing: { icon: PenLine, description: "Titles, slide copy, and thoughtful edits", example: "Shape a headline, explain an idea, or refine slide copy." },
  research_analysis: { icon: Search, description: "Sources, evidence, and deeper understanding", example: "Explore a topic and organize the evidence behind your story." },
  imagery: { icon: ImageIcon, description: "Images and visual storytelling", example: "Explore an image direction for the idea on your slide." },
}
const currentWorkflows: Record<TaskId, { where: string; controls: string[]; note: string; starter: string }> = {
  planning_strategy: {
    where: "Director chat in Studio",
    controls: ["Describe your audience, purpose, and the decision you want to support.", "Review Director’s approach and outline before building."],
    note: "Planning happens in the current conversation. No personal model assignment is applied here.",
    starter: "Help me plan a presentation. Ask about my audience, objective, and supporting evidence, then propose a clear storyline for my review before building.",
  },
  content_writing: {
    where: "Director chat and the Text element panel",
    controls: ["Discuss slide copy and revisions in Director chat.", "Open an existing text element or add Text to generate, edit, or refine its content."],
    note: "Element edits use the current slide and deck context. Check the existing edit controls in your presentation.",
    starter: "Help me refine the writing in this presentation. Review the audience and main message with me, then suggest clearer titles and concise slide copy before changing anything.",
  },
  research_analysis: {
    where: "Research settings in Studio’s composer",
    controls: ["Web search and Deep research are current build choices; Deep research includes web.", "Upload supporting documents in the composer. Knowledge Graph appears only when the existing access and setup checks permit it.", "Element research can use Web Search, Uploaded Documents, or Knowledge Graph when available."],
    note: "Build research settings lock after the outline is generated. Source choices are separate from model routing, and this page changes neither.",
    starter: "Help me identify the evidence this presentation needs. Review useful research questions and the sources I should provide. Ask me to confirm the available Studio research settings before building.",
  },
  imagery: {
    where: "Add Image and the Image element panel",
    controls: ["Generate, edit, or request a variation through the current image panel.", "Choose from photography, illustration, brand graphic, flat vector, isometric, minimal, or abstract styles.", "Use the panel’s aspect ratio, quality, theme, and position controls for this element."],
    note: "Image controls describe the desired result. The service owns its provider and model routing.",
    starter: "Help me define the visual direction for this presentation. Review which slides need photography, illustration, or diagrams, then suggest image prompts that support their purpose.",
  },
}

/** Current controls guide, alongside an opt-in prototype comparison. No model routing contract. */
export function IntelligenceWorkspace() {
  const [view, setView] = useState<"current" | "design">("current")
  const [activeTask, setActiveTask] = useState<TaskId>("planning_strategy")
  const [briefs, setBriefs] = useState<Draft>(emptyBriefs)
  const [resetBriefs, setResetBriefs] = useState<Draft | null>(null)
  const [briefFeedback, setBriefFeedback] = useState("")
  const [draftStatus, setDraftStatus] = useState<DraftStatus>({ changed: 0, storage: "pending" })
  function editBrief(value: string) {
    setBriefs(current => ({ ...current, [activeTask]: value }))
    setResetBriefs(null)
    setBriefFeedback("")
  }
  function resetLocalBriefs() {
    setResetBriefs(briefs)
    setBriefs(emptyBriefs())
    setBriefFeedback("Local briefs cleared. Undo is available until you edit a brief.")
  }
  function undoReset() {
    if (!resetBriefs) return
    setBriefs(resetBriefs)
    setResetBriefs(null)
    setBriefFeedback("Your local briefs were restored.")
  }
  const workflow = currentWorkflows[activeTask]
  const viewSwitcher = <div className="sp-preview-switcher" role="group" aria-label="Intelligence view"><button type="button" aria-pressed={view === "current"} onClick={() => setView("current")}>Current workflows</button><button type="button" aria-pressed={view === "design"} onClick={() => setView("design")}>Design preview</button></div>
  const dirty = taskIds.some(id => Boolean(briefs[id])) || Boolean(resetBriefs)
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])
  return <main className="sp-workspace sp-intelligence" data-studio-personal="intelligence" data-studio-intro-surface="models" data-intelligence-polish={polish ? "true" : undefined}>
    <header className="sp-heading"><div><p className="sp-eyebrow">WORK WITH DECKSTER</p><h1>Intelligence</h1><p>Give each part of your story a clear direction.</p></div>{polish && view === "design" ? <DraftStatusPill status={draftStatus} /> : <span className="sp-draft-badge"><span />{view === "current" ? "Current workflows" : "Design preview only"}</span>}</header>
    {polish && view === "design"
      ? <div className="sp-context-bar sp-ip-bar"><IntelligenceScope /><div className="sp-ip-bar-end"><IntelligenceReadiness />{viewSwitcher}</div></div>
      : <div className="sp-context-bar"><span><SlidersHorizontal size={16} aria-hidden="true" /> {view === "current" ? "Available controls · service-managed model routing" : "Prototype model catalog · local comparison"}</span>{viewSwitcher}</div>}
    <div className="sp-intelligence-view" hidden={view !== "current"}>
      <div className="sp-workflow-layout">
        <section className="sp-workflow-tasks" aria-labelledby="sp-workflows-heading"><div className="sp-section-heading"><h2 id="sp-workflows-heading">Choose the work you want to do</h2></div>{taskIds.map(id => { const Icon = taskDetails[id].icon; return <button type="button" key={id} className="sp-workflow-task" aria-pressed={activeTask === id} onClick={() => setActiveTask(id)}><span className="sp-task-icon"><Icon size={20} aria-hidden="true" /></span><span><strong>{catalog.tasks[id].label}</strong><small>{taskDetails[id].description}</small>{briefs[id] && <em>Local brief drafted</em>}</span><ArrowRight size={15} aria-hidden="true" /></button> })}<div className="sp-inline-note"><Info size={16} aria-hidden="true" /><p>Model assignments and reusable model preferences are not connected. Studio’s existing settings and permission checks remain authoritative.</p></div></section>
        {process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true" ? <section className="sp-workflow-inspector sp-workflow-inspector-fitted" data-studio-workflow-fit="true" aria-labelledby="sp-workflow-title">
          <div className="sp-workflow-content">
            <div className="sp-workflow-header"><span className="sp-eyebrow">CURRENT WORKFLOW</span><h2 id="sp-workflow-title">{catalog.tasks[activeTask].label}</h2><p className="sp-workflow-location">{workflow.where}</p></div>
            <details className="sp-workflow-guidance"><summary>Current controls &amp; guidance</summary><div className="sp-workflow-guidance-body"><ul className="sp-workflow-controls">{workflow.controls.map(control => <li key={control}>{control}</li>)}</ul><p className="sp-workflow-note">{workflow.note}</p><p className="sp-workflow-note">Review the editable brief in Studio, then send it when ready. Opening Studio does not enable settings, generate content, or apply model preferences.</p></div></details>
            <WorkflowBriefEditor task={activeTask} value={briefs[activeTask]} starter={workflow.starter} onChange={editBrief} />
          </div>
          <div className="sp-actions-row sp-workflow-actions"><StudioWorkflowAction action="brief" brief={briefs[activeTask].trim() || workflow.starter} className="sp-button sp-button-save">Review brief in Studio <ArrowRight size={14} /></StudioWorkflowAction><BackToBuilderButton /></div>
        </section> : <section className="sp-workflow-inspector" aria-labelledby="sp-workflow-title"><span className="sp-eyebrow">CURRENT WORKFLOW</span><h2 id="sp-workflow-title">{catalog.tasks[activeTask].label}</h2><p className="sp-workflow-location">{workflow.where}</p><ul className="sp-workflow-controls">{workflow.controls.map(control => <li key={control}>{control}</li>)}</ul><p className="sp-workflow-note">{workflow.note}</p><WorkflowBriefEditor task={activeTask} value={briefs[activeTask]} starter={workflow.starter} onChange={editBrief} /><p className="sp-workflow-note">Review the editable brief in Studio, then send it when ready. Opening Studio does not enable settings, generate content, or apply model preferences.</p><div className="sp-actions-row"><StudioWorkflowAction action="brief" brief={briefs[activeTask].trim() || workflow.starter} className="sp-button sp-button-save">Review brief in Studio <ArrowRight size={14} /></StudioWorkflowAction><BackToBuilderButton /></div></section>}
      </div>
      <div className="sp-draft-actions"><div><p><Info size={15} aria-hidden="true" /> Briefs stay while switching tasks and views. Leaving this page discards any brief you have not taken to Studio.</p><span className="sp-feedback" role="status">{briefFeedback}</span></div><div className="sp-action-buttons">{resetBriefs && <button className="sp-button" type="button" onClick={undoReset}>Undo reset</button>}<button className="sp-button" type="button" disabled={!taskIds.some(id => Boolean(briefs[id]))} onClick={resetLocalBriefs}><RotateCcw size={14} aria-hidden="true" />Reset local briefs</button></div></div>
    </div>
    <div className="sp-intelligence-view" hidden={view !== "design"}><ModelDesignPreview viewIsDesign={view === "design"} onRestoreView={() => setView("design")} onStatus={status => setDraftStatus(previous => previous.changed === status.changed && previous.storage === status.storage ? previous : status)} /></div>
    <StudioIntroReplay screen="models" autoStart={true} targetSelector='[data-studio-intro-surface="models"]' className="studio-destination-intro-replay" />
  </main>
}

/** Suggested text is an editable starting point, never a sent prompt or model choice. */
function WorkflowBriefEditor({ task, value, starter, onChange }: { task: TaskId; value: string; starter: string; onChange: (value: string) => void }) {
  const editor = useRef<HTMLTextAreaElement>(null)
  const helperId = `sp-brief-help-${task}`
  return <div className="sp-workflow-brief-editor">
    <label className="sp-field sp-workflow-brief"><span>Your brief for Director <small>Optional · local draft</small></span><textarea ref={editor} rows={4} maxLength={12000} value={value} placeholder={starter} aria-describedby={helperId} onChange={event => onChange(event.target.value)} /></label>
    <div className="sp-brief-tools"><button type="button" className="sp-button" disabled={Boolean(value)} onClick={() => {
      if (value) return
      onChange(starter)
      requestAnimationFrame(() => editor.current?.focus())
    }}>Use suggested brief</button><small id={helperId}>{value ? `${value.length.toLocaleString("en-US")} / 12,000 characters · local draft` : "Edit the suggestion before taking it to Studio."}</small></div>
  </div>
}

function defaultDraft(): Draft {
  return Object.fromEntries(taskIds.map(id => [id, "default"])) as Draft
}

/** Flag on: a retired model id (a draft or default saved before the refresh) resolves to its successor. Any other id, and every id with the flag off, passes through. */
export function resolveRetiredModel(id: string) {
  return catalogRefreshed ? catalog.retiredModels?.[id]?.successor ?? id : id
}

function modelFor(task: TaskId, choice: string) {
  const id = resolveRetiredModel(choice === "default" ? catalog.tasks[task].defaultModel : choice)
  return catalog.models[id as ModelId]
}

/** The model "Compare with" opens on: the first one the task offers that is not the current choice. */
function comparisonFor(id: TaskId, choice: string) {
  const choices = catalog.tasks[id].models as readonly string[]
  const current = choice === "default" ? catalog.tasks[id].defaultModel : choice
  return choices.find(model => model !== current) || current
}

/** Flag on: the draft key carries a format version and the catalog version, so a draft made against another catalog is never read back into this one. */
export const draftStorageKey = () => `deckster-studio-intelligence-draft-v1:${catalog.version}`

/** Flag on: reads a stored draft back through the current catalog. A retired id resolves to its successor; an id the task does not offer (or a field of the
 * wrong shape) falls back to the catalog starting point, so no retired or unknown id survives. A draft with nothing changed restores nothing. */
export function parseSavedDraft(raw: string | null): SavedDraft | null {
  if (!raw) return null
  let saved: { v?: unknown; catalog?: unknown; draft?: unknown; activeTask?: unknown; view?: unknown } | null
  try { saved = JSON.parse(raw) } catch { return null }
  if (!saved || typeof saved !== "object" || saved.v !== 1 || saved.catalog !== catalog.version || !saved.draft || typeof saved.draft !== "object") return null
  const stored = saved.draft as Record<string, unknown>
  const draft = defaultDraft()
  for (const id of taskIds) {
    const value = stored[id]
    if (typeof value !== "string") continue
    const resolved = resolveRetiredModel(value)
    if ((catalog.tasks[id].models as readonly string[]).includes(resolved)) draft[id] = resolved
  }
  if (!taskIds.some(id => draft[id] !== "default")) return null
  return { draft, activeTask: taskIds.find(id => id === saved.activeTask) ?? taskIds[0], view: saved.view === "design" ? "design" : "current" }
}

/** Flag on: the longer comparison scrolls under the sticky action, and a disabled button is 60% opaque so the rows show through it.
 * Disabled keeps its look (the same 60% blend) on a fully opaque button. */
const DISABLED_ACTION_OPAQUE = { opacity: 1, background: "color-mix(in srgb, var(--sp-active) 60%, var(--sp-panel))", color: "color-mix(in srgb, var(--sp-teal) 60%, var(--sp-panel))" }
const releaseLabel = (stage?: string) => stage === "ga" ? "Stable (GA)" : stage === "preview" ? "Preview" : "Not stated"
const inputsLabel = (inputs?: string[]) => inputs?.length ? inputs.map(kind => kind === "file" ? "files" : kind).join(", ").replace(/^./, first => first.toUpperCase()) : "Not listed"
const priceLabel = (model: CatalogModel) => model.pricePerMillionTokens ? `$${model.pricePerMillionTokens.input.toFixed(2)} in / $${model.pricePerMillionTokens.output.toFixed(2)} out` : model.priceNote || "Not listed"

const provenanceText = "Model names, task defaults, and specifications come from the accepted Studio v4 prototype catalog. They are examples for reviewing this experience, not your account permissions or current service routing. No connected model catalog, benchmark results, or preference-saving service is used here."

/** A design candidate. The draft lives in memory; with the polish flag on it is also kept in this browser (localStorage, never the account). No catalog fetch or generation. */
function ModelDesignPreview({ viewIsDesign = false, onRestoreView, onStatus }: { viewIsDesign?: boolean; onRestoreView?: () => void; onStatus?: (status: DraftStatus) => void } = {}) {
  const [draft, setDraft] = useState<Draft>(defaultDraft)
  const [activeTask, setActiveTask] = useState<TaskId>("planning_strategy")
  const [comparison, setComparison] = useState<string>(catalog.tasks.planning_strategy.models[1])
  const [feedback, setFeedback] = useState("")
  const [storage, setStorage] = useState<DraftStorage>("pending")
  const [restored, setRestored] = useState(false)
  const changed = taskIds.filter(task => draft[task] !== "default").length
  const task = catalog.tasks[activeTask]
  const chosen = modelFor(activeTask, draft[activeTask])
  const alternative = modelFor(activeTask, comparison)

  function inspect(id: TaskId) {
    setActiveTask(id)
    setComparison(comparisonFor(id, draft[id]))
  }

  function restore(saved: SavedDraft) {
    setDraft(saved.draft)
    setActiveTask(saved.activeTask)
    setComparison(comparisonFor(saved.activeTask, saved.draft[saved.activeTask]))
    setFeedback("Your earlier draft was restored.")
  }

  // Flag on: the viewer's draft is read once after hydration, then kept on every change and cleared when nothing is changed (Reset draft included).
  // Every storage access is guarded; if one throws, the draft is session-only and leaving the page is warned about instead.
  useEffect(() => {
    if (!polish) return
    let saved: SavedDraft | null = null
    let ok = true
    try { saved = parseSavedDraft(window.localStorage.getItem(draftStorageKey())) } catch { ok = false }
    if (saved) { restore(saved); if (saved.view === "design") onRestoreView?.() }
    setStorage(ok ? "ok" : "unavailable")
    setRestored(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on mount
  }, [])
  useEffect(() => {
    if (!polish || !restored || storage === "unavailable") return
    try {
      if (changed) window.localStorage.setItem(draftStorageKey(), JSON.stringify({ v: 1, catalog: catalog.version, draft, activeTask, view: viewIsDesign ? "design" : "current" }))
      else window.localStorage.removeItem(draftStorageKey())
    } catch { setStorage("unavailable") }
  }, [restored, storage, changed, draft, activeTask, viewIsDesign])
  useEffect(() => {
    if (polish) onStatus?.({ changed, storage })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the callback is a setter on the parent
  }, [changed, storage])
  useEffect(() => {
    if (!polish || !changed || storage !== "unavailable") return
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", warn)
    return () => window.removeEventListener("beforeunload", warn)
  }, [changed, storage])

  function choose(id: TaskId, requested: string) {
    const value = resolveRetiredModel(requested)
    if (value !== "default" && !(catalog.tasks[id].models as readonly string[]).includes(value)) return
    setDraft(previous => ({ ...previous, [id]: value }))
    setFeedback(`${catalog.tasks[id].label}: ${modelFor(id, value).name} selected in this draft.`)
  }

  return (
    <div className="sp-design-preview">
      {polish ? <p className="sp-design-warning" id="sp-model-note"><Info size={16} aria-hidden="true" />Prototype examples only, not your account’s models or permissions. Nothing is applied, saved to your account, or sent to a model. {storage === "unavailable" ? "This browser cannot keep a draft, so reloading or leaving this page discards it." : "Your draft stays in this browser until you reset it."}</p>
        : <p className="sp-design-warning"><Info size={16} aria-hidden="true" />Prototype examples only. These model names, starting points, and specifications do not describe your account’s current choices or permissions.</p>}

      <div className="sp-model-layout">
        <section className="sp-task-list" aria-labelledby="sp-tasks-heading">
          <div className="sp-section-heading"><h2 id="sp-tasks-heading">Your models, by task</h2><span>{changed ? `${changed} draft change${changed === 1 ? "" : "s"}` : "Catalog starting points"}</span></div>
          {taskIds.map(id => {
            const entry = catalog.tasks[id]
            const Icon = taskDetails[id].icon
            const selected = modelFor(id, draft[id])
            return (
              <div className="sp-task-row" data-active={activeTask === id} key={id} data-model-task={id}>
                <button type="button" className="sp-task-inspect" aria-pressed={activeTask === id} aria-label={`Compare ${entry.label} models`} onClick={() => inspect(id)}>
                  <span className="sp-task-icon"><Icon size={20} strokeWidth={1.6} aria-hidden="true" /></span>
                  <span><strong>{entry.label}</strong><small>{taskDetails[id].description}</small></span>
                  <ArrowRight size={15} className="sp-task-arrow" aria-hidden="true" />
                </button>
                <div className="sp-task-choice">
                  <label className="sr-only" htmlFor={`sp-model-${id}`}>{entry.label} model</label>
                  <select id={`sp-model-${id}`} value={draft[id]} onFocus={() => { if (activeTask !== id) inspect(id) }} onChange={event => choose(id, event.target.value)}>
                    <option value="default">Prototype starting point · {modelFor(id, "default").name}</option>
                    {entry.models.map(modelId => <option key={modelId} value={modelId}>{catalog.models[modelId as ModelId].name}</option>)}
                  </select>
                  <span>{selected.provider} <span aria-hidden="true">·</span> {draft[id] === "default" ? "Prototype starting point" : "Local design choice"}</span>
                </div>
              </div>
            )
          })}
          {polish ? <div className="sp-later-row"><AudioLines size={19} aria-hidden="true" /><div><strong>Voice model preferences</strong><span>Narration uses the existing delivery controls.</span></div></div>
            : <div className="sp-later-row"><AudioLines size={19} aria-hidden="true" /><div><strong>Voice model preferences</strong><span>Model assignment is not connected here. Narration uses the existing delivery controls.</span></div><span className="sp-small-badge">Design only</span></div>}
          {polish && <ManagedByDeckster />}
        </section>

        <aside className="sp-model-inspector" aria-labelledby="sp-comparison-heading">
          <div className="sp-inspector-top"><span className="sp-eyebrow"><ArrowDownUp size={14} aria-hidden="true" /> MODEL COMPARISON</span><h2 id="sp-comparison-heading">{task.label}</h2><p>{taskDetails[activeTask].example}</p></div>
          <div className="sp-current-model"><span>Your design preview assignment</span><strong>{chosen.name}</strong><small>{chosen.provider} · {draft[activeTask] === "default" ? "Prototype starting point" : "Specific design example"}</small></div>
          <label className="sp-field"><span>Compare with</span><select value={comparison} onChange={event => setComparison(event.target.value)}>{task.models.map(id => <option key={id} value={id}>{catalog.models[id as ModelId].name}</option>)}</select></label>
          <table className="sp-comparison-table">
            <caption className="sr-only">Static catalog comparison for {task.label}</caption>
            <thead><tr><th scope="col">Prototype detail</th><th scope="col">Preview</th><th scope="col">Compare</th></tr></thead>
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
          <button type="button" className="sp-button sp-button-accent" style={catalogRefreshed && chosen === alternative ? DISABLED_ACTION_OPAQUE : undefined} disabled={chosen === alternative} onClick={() => choose(activeTask, comparison)}>Use in design preview <ArrowRight size={15} aria-hidden="true" /></button>
        </aside>
      </div>

      <div className="sp-draft-actions">
        {polish ? <div><span className="sp-feedback" role="status">{feedback}</span></div>
          : <div><p id="sp-model-save-note"><Info size={15} aria-hidden="true" /> These choices stay on this page. Applying preferences is not connected.</p><span className="sp-feedback" role="status">{feedback || "Nothing is saved to your account or sent to a model."}</span></div>}
        <div className="sp-action-buttons"><button className="sp-button" type="button" disabled={!changed} onClick={() => { setDraft(defaultDraft()); setFeedback("Draft reset to catalog starting points.") }}><RotateCcw size={14} aria-hidden="true" /> Reset draft</button><button className="sp-button sp-button-save" type="button" disabled aria-describedby={polish ? "sp-model-note" : "sp-model-save-note"}>Apply to Deckster</button></div>
      </div>

      <details className="sp-provenance"><summary>About this catalog <span>Design snapshot · {catalog.version}</span></summary><p>{provenanceText + (polish ? "" : " Reloading or leaving this page discards the draft.")}</p></details>
    </div>
  )
}

/** Flag on: the one status pill that replaces the header chip in Design preview. It describes the draft only; nothing here is saved to the account. */
function DraftStatusPill({ status }: { status: DraftStatus }) {
  const unsaved = status.changed > 0 && status.storage === "unavailable"
  const kept = status.changed > 0 && !unsaved
  return <span className="sp-draft-badge sp-ip-pill" data-state={kept ? "kept" : unsaved ? "session" : "clean"}>
    {kept ? <CheckCircle2 size={14} aria-hidden="true" /> : unsaved ? <AlertCircle size={14} aria-hidden="true" /> : <span />}
    {kept ? "Draft kept on this device" : unsaved ? "Session only" : "No draft changes"}
  </span>
}

/** Flag on: where a preference applies. Only reusable defaults exist here; This presentation has no backing in this page, so it is shown disabled with a note. */
function IntelligenceScope() {
  return <div className="sp-ip-scope-group">
    <div className="sp-preview-switcher sp-ip-scope" role="group" aria-label="Model preference scope">
      <button type="button" aria-pressed={true}><UserRound size={15} aria-hidden="true" />Reusable defaults</button>
      <button type="button" aria-pressed={false} disabled aria-describedby="sp-ip-scope-note"><FileText size={15} aria-hidden="true" />This presentation</button>
    </div>
    <span className="sp-ip-scope-note" id="sp-ip-scope-note">Choices for one presentation aren’t available in this preview.</span>
  </div>
}

const readinessCollections = [
  { id: "research", icon: BookOpen, name: "Research & documents", learns: "Evidence, language, and the way you frame a story." },
  { id: "datasets", icon: Database, name: "Datasets", learns: "Familiar metrics, units, and ways to explain the numbers." },
  { id: "presentations", icon: Presentation, name: "Presentations", learns: "Your recurring structures, titles, and visual style." },
]

/** Flag on: "Your own intelligence". A static concept popup: it reads none of the viewer's documents, datasets or presentations, so it shows no counts and starts nothing. */
function IntelligenceReadiness() {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<CSSProperties>({})
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current?.getBoundingClientRect()
      if (!rect) return
      const width = Math.min(560, window.innerWidth - 24)
      const top = Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 260))
      setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)), top, maxHeight: window.innerHeight - top - 16 })
    }
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !popup.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return
      event.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    place()
    closeButton.current?.focus()
    window.addEventListener("resize", place)
    document.addEventListener("scroll", place, true)
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => {
      window.removeEventListener("resize", place)
      document.removeEventListener("scroll", place, true)
      document.removeEventListener("pointerdown", outside)
      document.removeEventListener("keydown", escape)
    }
  }, [open])
  return <>
    <button ref={trigger} type="button" className="sp-ip-readiness-trigger" data-open={open ? "true" : undefined} aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(current => !current)}><Sparkles size={16} aria-hidden="true" /><span>Your own intelligence</span><small>Preview</small><ChevronDown size={14} aria-hidden="true" /></button>
    {open && <div ref={popup} className="sp-ip-popup" style={position} role="dialog" aria-labelledby="sp-ip-readiness-title">
      <header><span className="sp-ip-popup-mark"><Sparkles size={19} aria-hidden="true" /></span><div><h2 id="sp-ip-readiness-title">Your own intelligence</h2><p>See how your Second Brain could become a personal model.</p></div><button ref={closeButton} type="button" className="sp-icon-button" aria-label="Close intelligence readiness" onClick={() => { setOpen(false); trigger.current?.focus() }}><X size={16} aria-hidden="true" /></button></header>
      <div className="sp-ip-popup-body">
        <div className="sp-ip-popup-summary"><strong>Three collections a personal model could learn from</strong><span>Concept preview · a sample target of 5 items per collection</span></div>
        <div className="sp-ip-collections">{readinessCollections.map(({ id, icon: Icon, name, learns }) => <section key={id}><Icon size={19} aria-hidden="true" /><div><strong>{name}</strong><span>{learns}</span></div><small>Sample target · 5 items</small></section>)}</div>
        <p className="sp-ip-popup-note">A preview of the experience: none of your documents, datasets or presentations are read, no sources are sent, and no model is trained.</p>
        <details className="sp-ip-popup-details"><summary>What would a real training flow need?<ChevronDown size={14} aria-hidden="true" /></summary><p>Choose and approve the material, check its quality and usage rights, estimate the cost, then evaluate a trained model before using it. Including a source for Director does not authorize training.</p><p>The five-item target only illustrates progress. A working service would determine readiness from quality, quantity, and the training task. Private hosting and fine-tuning remain product directions, not connected features.</p></details>
      </div>
    </div>}
  </>
}

const managedTasks = [
  { id: "structure_layout", label: "Structure & Layout", description: "Deckster manages how slides are structured and laid out." },
  { id: "visual_review", label: "Visual Review", description: "Deckster manages the visual quality checks." },
  { id: "utilities", label: "Utilities", description: "Deckster manages small supporting steps." },
  { id: "embeddings", label: "Embeddings", description: "Deckster manages how your sources are searched, independent of your model choices." },
]

/** Flag on: the tasks Deckster picks for itself. Names only; the catalog lists no model for them, so none is shown. */
function ManagedByDeckster() {
  return <details className="sp-ip-managed"><summary><span><LockKeyhole size={15} aria-hidden="true" /><strong>Managed by Deckster</strong><small>{managedTasks.length} supporting tasks</small></span><ChevronDown size={15} aria-hidden="true" /></summary>
    <div className="sp-ip-managed-grid">{managedTasks.map(task => <div key={task.id}><Settings2 size={15} aria-hidden="true" /><h3>{task.label}</h3><p>{task.description}</p></div>)}</div>
  </details>
}
