"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowDownUp, ArrowRight, AudioLines, Compass, ImageIcon, Info, PenLine, RotateCcw, Search, SlidersHorizontal } from "lucide-react"
import { StudioWorkflowAction } from "@/components/studio-libraries/studio-workflow-action"
import { BackToBuilderButton } from "@/components/layout/app-header"
import catalog from "./model-catalog-snapshot.json"
import "./personal-workspaces.css"
import "./intelligence-workspace.css"

type TaskId = keyof typeof catalog.tasks
type ModelId = keyof typeof catalog.models
type Draft = Record<TaskId, string>
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
  const dirty = taskIds.some(id => Boolean(briefs[id])) || Boolean(resetBriefs)
  useEffect(() => {
    if (!dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault() }
    window.addEventListener("beforeunload", beforeUnload)
    return () => window.removeEventListener("beforeunload", beforeUnload)
  }, [dirty])
  return <main className="sp-workspace sp-intelligence" data-studio-personal="intelligence">
    <header className="sp-heading"><div><p className="sp-eyebrow">WORK WITH DECKSTER</p><h1>Intelligence</h1><p>Give each part of your story a clear direction.</p></div><span className="sp-draft-badge"><span />{view === "current" ? "Current workflows" : "Design preview only"}</span></header>
    <div className="sp-context-bar"><span><SlidersHorizontal size={16} aria-hidden="true" /> {view === "current" ? "Available controls · service-managed model routing" : "Prototype model catalog · local comparison"}</span><div className="sp-preview-switcher" role="group" aria-label="Intelligence view"><button type="button" aria-pressed={view === "current"} onClick={() => setView("current")}>Current workflows</button><button type="button" aria-pressed={view === "design"} onClick={() => setView("design")}>Design preview</button></div></div>
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
    <div className="sp-intelligence-view" hidden={view !== "design"}><ModelDesignPreview /></div>
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

function modelFor(task: TaskId, choice: string) {
  const id = choice === "default" ? catalog.tasks[task].defaultModel : choice
  return catalog.models[id as ModelId]
}

/** A deliberately in-memory design candidate. No catalog fetch, persistence or generation. */
function ModelDesignPreview() {
  const [draft, setDraft] = useState<Draft>(defaultDraft)
  const [activeTask, setActiveTask] = useState<TaskId>("planning_strategy")
  const [comparison, setComparison] = useState<string>(catalog.tasks.planning_strategy.models[1])
  const [feedback, setFeedback] = useState("")
  const changed = taskIds.filter(task => draft[task] !== "default").length
  const task = catalog.tasks[activeTask]
  const chosen = modelFor(activeTask, draft[activeTask])
  const alternative = modelFor(activeTask, comparison)

  function inspect(id: TaskId) {
    setActiveTask(id)
    const choices = catalog.tasks[id].models as readonly string[]
    const current = draft[id] === "default" ? catalog.tasks[id].defaultModel : draft[id]
    setComparison(choices.find(model => model !== current) || current)
  }

  function choose(id: TaskId, value: string) {
    if (value !== "default" && !(catalog.tasks[id].models as readonly string[]).includes(value)) return
    setDraft(previous => ({ ...previous, [id]: value }))
    setFeedback(`${catalog.tasks[id].label}: ${modelFor(id, value).name} selected in this draft.`)
  }

  return (
    <div className="sp-design-preview">
      <p className="sp-design-warning"><Info size={16} aria-hidden="true" />Prototype examples only. These model names, starting points, and specifications do not describe your account’s current choices or permissions.</p>

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
          <div className="sp-later-row"><AudioLines size={19} aria-hidden="true" /><div><strong>Voice model preferences</strong><span>Model assignment is not connected here. Narration uses the existing delivery controls.</span></div><span className="sp-small-badge">Design only</span></div>
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
            </tbody>
          </table>
          <p className="sp-comparison-note">Snapshot specifications only. Speed, quality, pricing, and live availability have not been verified.</p>
          <button type="button" className="sp-button sp-button-accent" disabled={chosen === alternative} onClick={() => choose(activeTask, comparison)}>Use in design preview <ArrowRight size={15} aria-hidden="true" /></button>
        </aside>
      </div>

      <div className="sp-draft-actions">
        <div><p id="sp-model-save-note"><Info size={15} aria-hidden="true" /> These choices stay on this page. Applying preferences is not connected.</p><span className="sp-feedback" role="status">{feedback || "Nothing is saved to your account or sent to a model."}</span></div>
        <div className="sp-action-buttons"><button className="sp-button" type="button" disabled={!changed} onClick={() => { setDraft(defaultDraft()); setFeedback("Draft reset to catalog starting points.") }}><RotateCcw size={14} aria-hidden="true" /> Reset draft</button><button className="sp-button sp-button-save" type="button" disabled aria-describedby="sp-model-save-note">Apply to Deckster</button></div>
      </div>

      <details className="sp-provenance"><summary>About this catalog <span>Design snapshot · {catalog.version}</span></summary><p>Model names, task defaults, and specifications come from the accepted Studio v4 prototype catalog. They are examples for reviewing this experience, not your account permissions or current service routing. No connected model catalog, benchmark results, or preference-saving service is used here. Reloading or leaving this page discards the draft.</p></details>
    </div>
  )
}
