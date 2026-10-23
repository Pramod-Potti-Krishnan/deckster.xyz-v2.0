"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronDown, Info } from "lucide-react"
import {
  buildModelsView, catalogueSummary, createCatalogueLoader, MODEL_CATALOG_NOT_AVAILABLE_TEXT,
  type CatalogueResult, type FetchJson, type GroupView, type ModelRow,
} from "@/lib/studio-model-catalog"
import "./intelligence-models.css"

/** NEXT_PUBLIC_STUDIO_MODEL_CATALOG (exact "true", default off; build-time). The Intelligence page's "Models" section (mounted by app/(app)/studio/intelligence/layout.tsx, below the page, so the page itself is
 * untouched): the models Deckster can use for each kind of work, read from Director's read-only model catalogue through the Studio route /api/models/catalogue (never from the browser to Director). Certified
 * models only, with their vendor, capabilities, context window and output size, a Premium badge and, where it is known, a speed class. "Show all models" adds the
 * rest (page by page, each marked as open for selection or not) and marks the proposed shortlist "Suggested" (the default list is that shortlist, so it is not marked there). No prices: Director's catalogue carries none. Read-only: nothing is chosen, sent or saved here. The static excerpt in the chooser above is
 * unchanged. */

const browserFetch: FetchJson = async url => {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" })
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  return { status: response.status, body }
}
// One loader for the page's life: a good answer is kept for its ttl_seconds (300 s when it names none), so opening the page again within that time asks nobody.
const loader = createCatalogueLoader({ fetchJson: browserFetch, now: () => Date.now() })

export type ModelsSectionProps = {
  open: boolean
  showAll: boolean
  /** null while the first read is in flight. */
  result: CatalogueResult | null
  more: "idle" | "loading" | "error"
  onOpen: () => void
  onShowAll: () => void
  onRetry: () => void
  onMore: () => void
}

const suggestedTitle = (row: ModelRow) => `${row.suggestedFor.length ? `Suggested for ${row.suggestedFor.join(", ")} work. ` : ""}A proposed shortlist, not final.`

function ModelRowView({ row }: { row: ModelRow }) {
  const meta = [row.provider, row.contextWindow && `${row.contextWindow} context`, row.maxOutput && `${row.maxOutput} output`, row.speed && `Speed: ${row.speed}`].filter(Boolean).join(" · ")
  return <li className="sp-mc-row" data-mc-model={row.slug} data-mc-selectable={row.selectable ? "true" : "false"}>
    <div className="sp-mc-row-head">
      <strong>{row.title}</strong>
      {row.suggested && <span className="sp-mc-badge sp-mc-badge-suggested" title={suggestedTitle(row)}>Suggested</span>}
      {row.premium && <span className="sp-mc-badge sp-mc-badge-premium">Premium</span>}
      {!row.selectable && <span className="sp-mc-badge sp-mc-badge-closed" title="Not certified yet, so it cannot be picked.">Not open for selection</span>}
    </div>
    {meta && <p className="sp-mc-meta">{meta}</p>}
    {row.chips.length > 0 && <ul className="sp-mc-chips" aria-label="Capabilities">{row.chips.map(chip => <li key={chip}>{chip}</li>)}</ul>}
  </li>
}

function GroupCard({ group, showAll }: { group: GroupView; showAll: boolean }) {
  return <section className="sp-mc-group" data-mc-group={group.key} aria-label={group.label}>
    <div className="sp-mc-group-head"><h3>{group.label}</h3><small>{group.certified} open for selection</small></div>
    {group.rows.length > 0
      ? <ul className="sp-mc-rows">{group.rows.map(row => <ModelRowView key={row.slug} row={row} />)}</ul>
      : <p className="sp-mc-none">{showAll ? "No models are listed yet." : "No models are open for selection yet."}</p>}
    {showAll && group.total !== null && group.rows.length > 0 && <p className="sp-mc-count">Showing {group.rows.length} of {group.total}</p>}
  </section>
}

/** The section as a function of its state: what each of loading, ready, empty, error, "not available yet" and "unavailable" looks like. */
export function ModelsSection({ open, showAll, result, more, onOpen, onShowAll, onRetry, onMore }: ModelsSectionProps) {
  const view = result?.kind === "ready" ? buildModelsView(result.catalogue, showAll) : null
  const version = result?.kind === "ready" ? result.catalogue.version : null
  return <section className="sp-mc" aria-labelledby="sp-mc-heading" data-model-catalog={result ? result.kind : "loading"} data-mc-open={open ? "true" : "false"}>
    <h2 id="sp-mc-heading" className="sp-mc-heading">
      <button type="button" className="sp-mc-toggle" aria-expanded={open} aria-controls="sp-mc-panel" onClick={onOpen}>
        <span className="sp-mc-title">Models</span>
        <span className="sp-mc-summary">{catalogueSummary(result, showAll)}</span>
        <ChevronDown size={16} aria-hidden="true" className="sp-mc-chevron" />
      </button>
    </h2>
    <div id="sp-mc-panel" className="sp-mc-panel" hidden={!open}>
      <div className="sp-mc-inner">
        {result === null && <p className="sp-mc-state" role="status">Loading the model catalog…</p>}
        {result?.kind === "not-available" && <div className="sp-mc-state" data-mc-state="not-available"><p><strong>{MODEL_CATALOG_NOT_AVAILABLE_TEXT}.</strong></p><p>It will appear here once it is set up. Nothing else on this page depends on it.</p></div>}
        {result?.kind === "unavailable" && <div className="sp-mc-state" data-mc-state="unavailable"><p><strong>The model catalog is unavailable.</strong></p><p>The answer was not one this page can read.</p></div>}
        {result?.kind === "error" && <div className="sp-mc-state" data-mc-state="error" role="alert">
          <p><strong>{result.reason === "signed-out" ? "Sign in again to see the model catalog." : "The model catalog could not be loaded right now."}</strong></p>
          <button type="button" className="sp-mc-button" onClick={onRetry}>Try again</button>
          {showAll && <button type="button" className="sp-mc-button" onClick={onShowAll}>Show only the open models</button>}
        </div>}
        {view && <>
          <div className="sp-mc-controls">
            <label className="sp-mc-switch"><input type="checkbox" checked={showAll} onChange={() => onShowAll()} /><span>Show all models</span></label>
            <p className="sp-mc-note"><Info size={14} aria-hidden="true" />{showAll ? "Every model Deckster knows about, by kind of work. Only certified models are open for selection." : "The models open for selection, by kind of work."} This list is read-only.</p>
            {version && <span className="sp-mc-version" title={version}>Catalog {version}</span>}
          </div>
          {view.empty
            ? <p className="sp-mc-state" data-mc-state="empty">{showAll ? "No models are listed yet." : "No models are open for selection yet."}</p>
            : <div className="sp-mc-groups">{view.groups.map(group => <GroupCard key={group.key} group={group} showAll={showAll} />)}</div>}
          {showAll && view.nextOffset !== null && <div className="sp-mc-more">
            <button type="button" className="sp-mc-button" disabled={more === "loading"} onClick={onMore}>{more === "loading" ? "Loading…" : "Show more models"}</button>
            {more === "error" && <span className="sp-mc-more-error" role="alert">Could not load more models. Try again.</span>}
          </div>}
        </>}
      </div>
    </div>
  </section>
}

export function IntelligenceModels() {
  const [open, setOpen] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [result, setResult] = useState<CatalogueResult | null>(null)
  const [more, setMore] = useState<"idle" | "loading" | "error">("idle")
  const [attempt, setAttempt] = useState(0)
  const run = useRef(0)

  // The first read starts when the page opens (so the header can say what there is) and again on a change of view or a retry. An answer that arrives after the view changed or the page was left is dropped.
  useEffect(() => {
    const id = ++run.current
    setResult(null)
    setMore("idle")
    loader.load(showAll).then(next => { if (run.current === id) setResult(next) })
    return () => { run.current++ }
  }, [showAll, attempt])

  function showMore() {
    if (result?.kind !== "ready" || more === "loading") return
    const id = run.current
    setMore("loading")
    loader.loadMore(result.catalogue).then(next => {
      if (run.current !== id) return
      if (next.kind === "ready") { setResult(next); setMore("idle") } else setMore("error")
    })
  }

  return <ModelsSection open={open} showAll={showAll} result={result} more={more}
    onOpen={() => setOpen(current => !current)} onShowAll={() => setShowAll(current => !current)} onRetry={() => setAttempt(current => current + 1)} onMore={showMore} />
}
