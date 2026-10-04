"use client"

import { useRef, useState } from "react"
import { AlertCircle, FileText, Network, RefreshCw, Search, X } from "lucide-react"
import { typeColor, type KgViewNode } from "./kg-graph-view"

/** Presentation of the existing node-detail response; no additional source requests. */
interface KnowledgeDetail {
  node: KgViewNode
  evidence: Array<{
    snippet: string
    source_type: string | null
    session_id: string
    document_filename: string | null
    page_number: number | null
    created_at?: string | null
  }>
  provenance_session_ids: string[]
  edges: Array<{ src_name: string; dst_name: string; relation: string; weight: number }>
}

const friendly = (value: string) => value.replace(/_/g, " ").toLowerCase()
function sourceLabel(value: string | null) {
  const labels: Record<string, string> = { chunk: "Uploaded document", table_summary: "Table summary", researcher_context: "Deck research", web: "Web research" }
  return value ? labels[value] || friendly(value) : "Knowledge source"
}
function addedDate(value?: string | null) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

export function StudioKnowledgeInspector({ selected, selectedId, loading, error, topEntities, onSelect, onRetry, onClear }: {
  selected: KnowledgeDetail | null
  selectedId: string | null
  loading: boolean
  error: string | null
  topEntities: Array<{ node_id: string; name: string; entity_type: string }>
  onSelect: (nodeId: string) => void
  onRetry: () => void
  onClear: () => void
}) {
  const [view, setView] = useState<"overview" | "evidence" | "relations">("overview")
  const [query, setQuery] = useState("")
  const evidenceInput = useRef<HTMLInputElement>(null)
  const clearFilter = () => { setQuery(""); evidenceInput.current?.focus() }
  const evidence = selected?.evidence.filter(item => `${item.snippet} ${item.document_filename || ""} ${sourceLabel(item.source_type)}`.toLowerCase().includes(query.trim().toLowerCase())) ?? []

  return <aside data-studio-knowledge-role="inspector" data-studio-knowledge-inspector="true" aria-label="Knowledge entity and source evidence">
    <header className="ski-heading"><div><p>ENTITY & SOURCES</p><h2>What your sources support</h2></div>{selectedId && <button type="button" className="ski-icon" onClick={onClear} aria-label="Clear selected entity"><X size={15} /></button>}</header>
    <div className="ski-body">
      {loading && <div className="ski-loading" role="status"><span /><span /><span /><p>Loading entity and recorded evidence…</p></div>}
      {!loading && error && <div className="ski-notice" role="alert"><AlertCircle size={18} /><strong>Entity details unavailable</strong><p>{error}</p><button type="button" className="ski-button" onClick={onRetry}><RefreshCw size={13} />Retry details</button></div>}
      {!loading && !error && !selected && <><div className="ski-notice"><Network size={26} /><strong>Follow an idea to its sources.</strong><p>Select an entity on the map or in search to inspect its recorded relationships and evidence.</p></div>{topEntities.length > 0 && <section><h3 className="ski-label">Most reinforced</h3><div className="ski-entity-list">{topEntities.map(entity => <button type="button" key={entity.node_id} onClick={() => onSelect(entity.node_id)}><i style={{ backgroundColor: typeColor(entity.entity_type) }} /><span><strong>{entity.name}</strong><small>{friendly(entity.entity_type)}</small></span></button>)}</div></section>}</>}
      {!loading && !error && selected && <>
        <div className="ski-identity"><p><i style={{ backgroundColor: typeColor(selected.node.entity_type) }} />{friendly(selected.node.entity_type)}</p><h3>{selected.node.name}</h3><span>{selected.node.mention_count ?? 0} mentions · {selected.provenance_session_ids.length} contributing sessions</span></div>
        <div className="ski-tabs" role="group" aria-label="Entity inspection view"><button type="button" aria-pressed={view === "overview"} onClick={() => setView("overview")}>Overview</button><button type="button" aria-pressed={view === "evidence"} onClick={() => setView("evidence")}>Evidence <span>{selected.evidence.length}</span></button><button type="button" aria-pressed={view === "relations"} onClick={() => setView("relations")}>Relations <span>{selected.edges.length}</span></button></div>
        <p className="ski-scope">Recorded detail returned for this entity. Counts describe this response; they may not include every source in your graph.</p>
        {view === "overview" && <section className="ski-overview"><p>{selected.node.description || "No entity description was recorded."}</p><div className="ski-overview-actions"><button type="button" className="ski-button" onClick={() => setView("evidence")}><FileText size={14} />Review source evidence</button><button type="button" className="ski-button" onClick={() => setView("relations")}><Network size={14} />Explore relations</button></div><details className="ski-details"><summary>Contributing session references <span>{selected.provenance_session_ids.length}</span></summary><p className="ski-scope">Recorded identifiers only. This inspector does not load or change those presentations.</p>{selected.provenance_session_ids.length ? <ul>{selected.provenance_session_ids.map((id, index) => <li key={`${id}-${index}`}><code>{id}</code></li>)}</ul> : <p>No contributing session references were returned.</p>}</details></section>}
        {view === "evidence" && <section aria-label="Returned source evidence"><div className="ski-search"><Search size={14} /><input ref={evidenceInput} value={query} onChange={event => setQuery(event.target.value)} aria-label="Filter recorded evidence" placeholder="Find a passage or source" />{query && <button type="button" aria-label="Clear evidence filter" onClick={clearFilter}><X size={13} /></button>}</div><p className="ski-scope" role="status">{evidence.length} of {selected.evidence.length} returned snippets{query.trim() ? " match this local filter" : " shown"}.</p>{evidence.length ? <div className="ski-evidence-list">{evidence.map(item => {
          const date = addedDate(item.created_at)
          return <article className="ski-evidence" key={`${item.session_id}-${selected.evidence.indexOf(item)}`}><header><FileText size={15} /><div><h4>{item.document_filename || sourceLabel(item.source_type)}</h4><p>{sourceLabel(item.source_type)}{item.page_number != null ? ` · p.${item.page_number}` : ""}{date ? ` · Added ${date}` : ""}</p></div></header>{item.snippet.length > 210 ? <details className="ski-passage"><summary><span>“{item.snippet.slice(0, 209)}…”</span><small>Read full returned passage</small></summary><blockquote>{item.snippet}</blockquote></details> : <blockquote>{item.snippet || "No passage text was returned."}</blockquote>}<details className="ski-details"><summary>Source session reference</summary><code>{item.session_id || "No session reference returned"}</code></details></article>
        })}</div> : <div className="ski-notice"><FileText size={22} /><strong>{query.trim() ? "No matching recorded passages" : "No evidence snippets returned"}</strong><p>{query.trim() ? "Try another passage, source filename, or type. This filter searches only the evidence already loaded for this entity." : "This response does not include evidence text for this entity."}</p>{query && <button type="button" className="ski-button" onClick={clearFilter}>Show all returned evidence</button>}</div>}</section>}
        {view === "relations" && <section aria-label="Returned relationships">{selected.edges.length ? <div className="ski-relation-list">{selected.edges.map((edge, index) => <article key={`${edge.src_name}-${edge.relation}-${edge.dst_name}-${index}`}><strong>{edge.src_name}<span aria-label="relates to"> → </span>{edge.dst_name}</strong><p>{friendly(edge.relation)}</p></article>)}</div> : <div className="ski-notice"><Network size={22} /><strong>No relations returned</strong><p>No recorded relations were included for this entity.</p></div>}</section>}
      </>}
    </div>
  </aside>
}
