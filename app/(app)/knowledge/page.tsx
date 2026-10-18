"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { StudioIntroReplay } from "@/components/studio-intro-replay"
import "@/components/studio-libraries/destination-intros.css"
import {
  AlertCircle,
  ArrowRight,
  Brain,
  Clock3,
  Database,
  FileText,
  GitBranch,
  Import,
  Layers3,
  Loader2,
  Lock,
  Network,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react"
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph"
import { KgGraphView, typeColor } from "@/components/knowledge/kg-graph-view"
import { StudioKnowledgeInspector } from "@/components/knowledge/studio-knowledge-inspector"
import { StudioKnowledgeSourcesMenu } from "@/components/knowledge/studio-knowledge-sources-menu"
import { StudioKnowledgeEmptyMap } from "@/components/knowledge/studio-knowledge-empty-state"
import { isEmptyGraph } from "@/lib/studio-knowledge-empty-state"
import { KnowledgeSectionBoundary } from "@/components/knowledge/knowledge-section-boundary"
import { KnowledgeImportConfirm } from "@/components/knowledge/knowledge-import-confirm"
import { StudioKnowledgeFilterTabs } from "@/components/knowledge/studio-knowledge-filter-tabs"
import {
  clearImportMarker, IMPORT_FAILED_TEXT, importConfirmWarning, importFailureText, normalizeKgGraph, normalizeKgStats, OFFLINE_IMPORT_TEXT, ownerTag,
  plainKnowledgeError, readImportMarker, resumedImportNotice, touchImportMarker, writeImportMarker,
} from "@/lib/studio-knowledge-fixes"
import type { KgGraphPresentationState, KgViewEdge, KgViewNode } from "@/components/knowledge/kg-graph-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import "@/components/knowledge/studio-knowledge.css"

export const dynamic = "force-dynamic"
const STUDIO_SHELL = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === "true"
// J6 pass-2 fixes (card PASS2-J6-FINDINGS). Exact "true" enables them; default off, and then the page is exactly as before.
const KNOWLEDGE_FIXES = process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES === "true"
// J6 finding L4 (card PASS2-J6-FINDINGS): the map filter as "Everything N" + one tab per kind in plain words (the Studio shell only). Exact "true" enables it; default off.
const KNOWLEDGE_FILTER_TABS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_FILTER_TABS === "true"
// J6 finding L5 (card PASS2-J6-FINDINGS): one "Sources" menu and the search field in the header (the Studio shell only). Exact "true" enables it; default off.
const KNOWLEDGE_HEADER_ACTIONS = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_HEADER_ACTIONS === "true"
// J6 finding L9 (card PASS2-J6-FINDINGS): the empty map on the map's own dark canvas, and a side panel that says there is nothing to follow yet (the Studio shell only). Exact "true" enables it; default off.
const KNOWLEDGE_EMPTY_STATE = STUDIO_SHELL && process.env.NEXT_PUBLIC_STUDIO_KNOWLEDGE_EMPTY_STATE === "true"

interface KgStats {
  node_count: number
  edge_count: number
  evidence_count: number
  sessions_consolidated: number
  nodes_by_type: Array<{ entity_type: string; count: number }>
  top_entities: Array<{
    node_id: string
    name: string
    entity_type: string
    salience: number
    mention_count?: number
  }>
  last_updated_at: string | null
}

interface KgGraphData {
  nodes: KgViewNode[]
  edges: KgViewEdge[]
  total_nodes: number
}

// Graph fitting depends on node/edge identity. Preserve that identity for an
// unchanged JSON response, including equivalent object key ordering, so an
// ordinary refresh does not reset the user's map transform.
function sameKnowledgeSnapshot(previous: unknown, next: unknown): boolean {
  if (Object.is(previous, next)) return true
  if (!previous || !next || typeof previous !== "object" || typeof next !== "object") return false
  if (Array.isArray(previous) || Array.isArray(next)) {
    return Array.isArray(previous) && Array.isArray(next) && previous.length === next.length &&
      previous.every((value, index) => sameKnowledgeSnapshot(value, next[index]))
  }
  const before = previous as Record<string, unknown>
  const after = next as Record<string, unknown>
  const keys = Object.keys(before)
  return keys.length === Object.keys(after).length &&
    keys.every(key => Object.hasOwn(after, key) && sameKnowledgeSnapshot(before[key], after[key]))
}

interface KgNodeDetail {
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

// kind (flag on only): "failed" = the import request itself failed (the banner offers Retry); "resumed" / "interrupted" = found on return
// to the page: an import this browser started never reported finishing (the banner offers Refresh / nothing).
type ImportNotice = { tone: "success" | "error" | "neutral"; text: string; kind?: "failed" | "resumed" | "interrupted" }

// Evaluates a section's markup while rendering as ITS OWN component, so an error thrown by the expression is caught by the section's boundary.
function LazySection({ render }: { render: () => ReactNode }) {
  return <>{render()}</>
}

// Flag on: the singular where the count is 1 ("1 new entity"). Flag off: always the form the page used before.
const noun = (count: number | undefined, one: string, many: string) => (KNOWLEDGE_FIXES && count === 1 ? one : many)

function formatNumber(value: number | undefined): string {
  return new Intl.NumberFormat().format(value ?? 0)
}

function formatDate(value: string | null | undefined): string | null {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
}

function friendlyType(value: string): string {
  return value.replace(/_/g, " ").toLowerCase()
}

function friendlySource(value: string | null): string {
  if (!value) return "Knowledge source"
  const labels: Record<string, string> = {
    chunk: "Uploaded document",
    table_summary: "Table summary",
    researcher_context: "Deck research",
    web: "Web research",
  }
  return labels[value] || value.replace(/_/g, " ")
}

function MetricCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: typeof Database
  label: string
  value: number
  detail: string
  accent: string
}) {
  return (
    <div data-studio-knowledge-role="metric" className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
            {formatNumber(value)}
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <div className={cn("rounded-xl p-2.5 ring-1 ring-inset", accent)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  )
}

function MetricSkeleton() {
  return (
    <div data-studio-knowledge-role="metric" className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
    </div>
  )
}

function MetricUnavailable({ label }: { label: string }) {
  return <div data-studio-knowledge-role="metric" className="rounded-2xl border border-slate-200 bg-white p-4"><div><div><p>{label}</p><p>Not loaded</p><p>Counts require a loaded graph.</p></div></div></div>
}

function AccessState({
  kind,
  onRetry,
}: {
  kind: "loading" | "locked" | "paused" | "unavailable"
  onRetry?: () => void
}) {
  const content = {
    loading: {
      icon: Loader2,
      title: "Opening your knowledge space",
      description: "Checking access and loading your graph…",
    },
    locked: {
      icon: Lock,
      title: "Your second brain, built deck by deck",
      description:
        "Knowledge is available on Pro plans and above. It connects entities, facts, and sources from the work you choose to add.",
    },
    paused: {
      icon: Brain,
      title: "Knowledge Graph is ready when you are",
      description:
        "Enable it once to let Deckster accumulate reusable, citable knowledge across the decks you build.",
    },
    unavailable: {
      icon: AlertCircle,
      title: "Knowledge is temporarily unavailable",
      description:
        "Your Knowledge access and settings could not be verified. Try again to check availability. Your existing graph has not been changed.",
    },
  }[kind]
  const Icon = content.icon

  return (
    <main data-studio-v4-access={kind} className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section data-studio-v4-access-role="card" className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div data-studio-v4-access-role="wash" className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,0.18),transparent_38%),radial-gradient(circle_at_90%_85%,rgba(37,99,235,0.15),transparent_35%)]" />
        <div className="relative grid min-h-[500px] items-center gap-10 p-7 md:grid-cols-[0.9fr_1.1fr] md:p-12">
          <div className="max-w-xl">
            <div data-studio-v4-access-role="icon" className="mb-5 inline-flex rounded-2xl border border-violet-200 bg-violet-50 p-3 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/50 dark:text-violet-300">
              <Icon className={cn("h-6 w-6", kind === "loading" && "animate-spin")} />
            </div>
            <p data-studio-v4-access-role="caption" className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              Deckster Knowledge
            </p>
            <h1 data-studio-v4-access-role="heading" className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {content.title}
            </h1>
            <p data-studio-v4-access-role="body" className="mt-4 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
              {content.description}
            </p>
            {kind === "locked" && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button data-studio-v4-access-role="primary" asChild><Link href="/pricing">View Pro plans</Link></Button>
                <Button data-studio-v4-access-role="secondary" asChild variant="outline"><Link href="/builder">{process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === "true" ? "Back to Studio" : "Back to Builder"}</Link></Button>
              </div>
            )}
            {kind === "paused" && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button data-studio-v4-access-role="primary" asChild>
                  <Link href="/settings/knowledge-graph">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Review and enable
                  </Link>
                </Button>
                <Button data-studio-v4-access-role="secondary" asChild variant="outline"><Link href="/builder">{process.env.NEXT_PUBLIC_STUDIO_V4_LABELS === "true" ? "Back to Studio" : "Back to Builder"}</Link></Button>
              </div>
            )}
            {kind === "unavailable" && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button data-studio-v4-access-role="primary" onClick={onRetry || (() => window.location.reload())}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Try again
                </Button>
                <Button data-studio-v4-access-role="secondary" asChild variant="outline"><Link href="/settings/knowledge-graph">Open settings</Link></Button>
              </div>
            )}
          </div>

          <div className="relative hidden min-h-[360px] overflow-hidden rounded-3xl border border-white/10 bg-[#070b18] shadow-2xl md:block">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(91,33,182,0.36),transparent_58%)]" />
            <div className="absolute inset-0 opacity-40 [background-image:radial-gradient(rgba(148,163,184,0.45)_1px,transparent_1px)] [background-size:24px_24px]" />
            {[
              ["20%", "28%", "h-7 w-7 bg-blue-400"],
              ["48%", "20%", "h-10 w-10 bg-violet-400"],
              ["72%", "34%", "h-6 w-6 bg-emerald-400"],
              ["34%", "58%", "h-8 w-8 bg-amber-400"],
              ["66%", "67%", "h-9 w-9 bg-rose-400"],
              ["82%", "76%", "h-5 w-5 bg-indigo-400"],
            ].map(([left, top, classes], index) => (
              <div
                key={index}
                className={cn("absolute rounded-full border-2 border-white/80 opacity-75 shadow-[0_0_24px_currentColor]", classes)}
                style={{ left, top }}
              />
            ))}
            <div className="absolute bottom-5 left-5 rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-400 backdrop-blur">
              Your private graph appears here
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}

function Inspector({
  selected,
  loading,
  error,
  topEntities,
  onSelect,
  selectedId,
  onRetry,
  onClear,
  emptyGraph,
}: {
  selected: KgNodeDetail | null
  loading: boolean
  error: string | null
  topEntities: KgStats["top_entities"]
  onSelect: (nodeId: string) => void
  selectedId: string | null
  onRetry: () => void
  onClear: () => void
  emptyGraph?: boolean
}) {
  if (STUDIO_SHELL) return <StudioKnowledgeInspector key={selectedId || "unselected"} selected={selected?.node.node_id === selectedId ? selected : null} selectedId={selectedId} loading={loading} error={error} topEntities={topEntities} onSelect={onSelect} onRetry={onRetry} onClear={onClear} emptyGraph={emptyGraph} />
  return (
    <aside data-studio-knowledge-role="inspector" className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
      <div className="border-b border-slate-200 px-4 py-4 dark:border-slate-800">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
          Entity detail
        </p>
        <h2 className="mt-1 text-base font-semibold text-slate-950 dark:text-white">
          What Deckster knows
        </h2>
      </div>

      <div className="p-4">
        {loading && (
          <div className="space-y-3" aria-label="Loading entity detail">
            <div className="h-5 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
            <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
            <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800/70" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            {error}
            {KNOWLEDGE_FIXES && (
              <button type="button" onClick={onRetry} className="mt-2 block rounded-md border border-amber-300 px-2.5 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950/50">
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && !selected && (
          <div>
            <div className="flex flex-col items-center px-2 py-6 text-center">
              <div className="rounded-2xl bg-violet-50 p-3 text-violet-600 dark:bg-violet-950/50 dark:text-violet-300">
                <Network className="h-6 w-6" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-white">Select an entity</p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Explore its connections and the evidence Deckster retained from your sources.
              </p>
            </div>
            {topEntities.length > 0 && (
              <div className="mt-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">Most reinforced</p>
                <div className="space-y-1">
                  {topEntities.slice(0, 6).map((entity) => (
                    <button
                      key={entity.node_id}
                      type="button"
                      onClick={() => onSelect(entity.node_id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-slate-800"
                    >
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: typeColor(entity.entity_type) }} />
                      <span className="min-w-0 flex-1 truncate font-medium text-slate-800 dark:text-slate-200">{entity.name}</span>
                      <span className="text-[10px] uppercase text-slate-400">{entity.entity_type}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!loading && !error && selected && (
          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: typeColor(selected.node.entity_type) }} />
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {friendlyType(selected.node.entity_type)}
                </span>
              </div>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">
                {selected.node.name}
              </h3>
              {selected.node.description && (
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  {selected.node.description}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                  {formatNumber(selected.node.mention_count)} mentions
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 dark:bg-slate-800">
                  {formatNumber(selected.provenance_session_ids.length)} sessions
                </span>
              </div>
            </div>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Relations</h4>
                <span className="text-xs tabular-nums text-slate-400">{selected.edges.length}</span>
              </div>
              {selected.edges.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No recorded relations yet.</p>
              ) : (
                <div className="space-y-2">
                  {selected.edges.slice(0, 8).map((edge, index) => (
                    <div key={`${edge.src_name}-${edge.relation}-${edge.dst_name}-${index}`} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/70">
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        {edge.src_name}
                        <span className="mx-1.5 text-violet-500">→</span>
                        {edge.dst_name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {edge.relation.replace(/_/g, " ").toLowerCase()}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Evidence</h4>
                <span className="text-xs tabular-nums text-slate-400">{selected.evidence.length}</span>
              </div>
              {selected.evidence.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No evidence snippets are available for this entity.</p>
              ) : (
                <div className="space-y-3">
                  {selected.evidence.slice(0, 6).map((evidence, index) => {
                    const evidenceDate = formatDate(evidence.created_at)
                    return (
                      <blockquote key={`${evidence.session_id}-${index}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
                        <p className="text-sm leading-5 text-slate-700 dark:text-slate-200">
                          “{evidence.snippet.length > 210 ? `${evidence.snippet.slice(0, 209)}…` : evidence.snippet}”
                        </p>
                        <footer className="mt-3 flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-slate-600 dark:text-slate-300">
                              {evidence.document_filename || friendlySource(evidence.source_type)}
                              {evidence.page_number != null ? ` · p.${evidence.page_number}` : ""}
                            </span>
                            {evidenceDate && <span className="mt-0.5 block">Added {evidenceDate}</span>}
                          </span>
                        </footer>
                      </blockquote>
                    )
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </aside>
  )
}

type KnowledgeGraphAccess = ReturnType<typeof useKnowledgeGraph>

export default function KnowledgePage() {
  const kg = useKnowledgeGraph()

  // Account identity is a React ownership boundary. Switching users remounts
  // the workspace synchronously, so graph/search/selection state from the
  // previous account can never be rendered while the new account resolves.
  const account = <KnowledgePageForAccount key={kg.accountKey} kg={kg} />
  // Flag on: the whole-page safety net. A render error nobody anticipated shows a plain notice with "Try again" in the page's place,
  // not Next's application-error screen (which replaces the whole app).
  return KNOWLEDGE_FIXES ? <KnowledgeSectionBoundary label="Second Brain page" page resetKey={kg.accountKey}>{account}</KnowledgeSectionBoundary> : account
}

function KnowledgePageForAccount({ kg }: { kg: KnowledgeGraphAccess }) {
  const [stats, setStats] = useState<KgStats | null>(null)
  const [graph, setGraph] = useState<KgGraphData | null>(null)
  const [dataLoading, setDataLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selected, setSelected] = useState<KgNodeDetail | null>(null)
  const [selectedLoading, setSelectedLoading] = useState(false)
  const [selectedError, setSelectedError] = useState<string | null>(null)
  const [detailAttempt, setDetailAttempt] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHits, setSearchHits] = useState<KgViewNode[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null)
  // Flag on: the confirm dialog in front of "Import past sessions" (null = closed; warning = another import may still be running).
  const [importConfirm, setImportConfirm] = useState<{ warning: string | null } | null>(null)
  const dataGenerationRef = useRef(0)
  const dataAbortRef = useRef<AbortController | null>(null)
  const nodeGenerationRef = useRef(0)
  const nodeAbortRef = useRef<AbortController | null>(null)
  const searchGenerationRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const importGenerationRef = useRef(0)
  const importAbortRef = useRef<AbortController | null>(null)
  const importActiveRef = useRef(false)
  // Flag on: true from the moment the browser starts leaving this document (reload, navigation, closing the tab).
  const pageLeavingRef = useRef(false)
  const interruptedImportRef = useRef({ owner: kg.accountKey, interrupted: false })
  const mountedRef = useRef(true)
  const admissionWaitersRef = useRef(new Set<() => void>())

  // Match the rendered gate below. Hook loading can temporarily hide resolved
  // settings while checking access; it is not itself a durable revocation.
  const accessStatus = kg.isLoading ? "pending" :
    !kg.isEntitled || !kg.serviceAvailable || (kg.error && !kg.settings) || !kg.isSubscribed ? "blocked" : "ready"
  const accessRef = useRef({ owner: kg.accountKey, lifetime: 0, revision: 0, status: accessStatus })
  if (accessRef.current.owner !== kg.accountKey || (accessStatus === "blocked" && accessRef.current.status !== "blocked")) {
    accessRef.current.lifetime += 1
    accessRef.current.revision += 1
  }
  accessRef.current.owner = kg.accountKey
  accessRef.current.status = accessStatus
  const accessRevision = accessRef.current.revision
  const operationOwner = kg.accountKey
  const operationLifetime = accessRef.current.lifetime
  const retiredLifetimeRef = useRef(accessRef.current.lifetime)

  // Retain presentation only while this access lifetime remains valid. Pending
  // still unmounts every private graph element; resolved loss or an observed
  // entitlement transition retires the holder before children can use it.
  const presentationContextRef = useRef({
    lifetime: operationLifetime,
    entitlementKey: kg.entitlementKey,
    generation: 0,
    stateRef: { current: null as KgGraphPresentationState | null },
  })
  if (presentationContextRef.current.lifetime !== operationLifetime ||
    presentationContextRef.current.entitlementKey !== kg.entitlementKey) {
    presentationContextRef.current = {
      lifetime: operationLifetime,
      entitlementKey: kg.entitlementKey,
      generation: presentationContextRef.current.generation + 1,
      stateRef: { current: null },
    }
  }
  const presentationContext = presentationContextRef.current
  const selectKnowledgeNode = useCallback((nodeId: string) => {
    const access = accessRef.current
    if (!mountedRef.current || access.status !== "ready" || access.owner !== operationOwner ||
      access.lifetime !== operationLifetime || presentationContextRef.current !== presentationContext) return
    setSelectedId(nodeId)
  }, [operationOwner, operationLifetime, presentationContext])

  const wakeAdmissionWaiters = useCallback(() => {
    for (const wake of [...admissionWaitersRef.current]) wake()
  }, [])

  const waitForAdmission = useCallback((owner: string, lifetime: number, signal: AbortSignal): Promise<boolean> => {
    const outcome = () => {
      const current = accessRef.current
      if (!mountedRef.current || signal.aborted || current.owner !== owner || current.lifetime !== lifetime || current.status === "blocked") return false
      return current.status === "ready" ? true : null
    }
    const immediate = outcome()
    if (immediate !== null) return Promise.resolve(immediate)
    return new Promise(resolve => {
      const wake = () => {
        const admitted = outcome()
        if (admitted === null) return
        admissionWaitersRef.current.delete(wake)
        signal.removeEventListener("abort", wake)
        resolve(admitted)
      }
      admissionWaitersRef.current.add(wake)
      signal.addEventListener("abort", wake, { once: true })
      wake()
    })
  }, [])

  useLayoutEffect(() => {
    const currentLifetime = accessRef.current.lifetime
    if (retiredLifetimeRef.current !== currentLifetime) {
      retiredLifetimeRef.current = currentLifetime
      const interruptedImport = importActiveRef.current
      const retainInterruptedNotice = interruptedImportRef.current.owner === accessRef.current.owner &&
        (interruptedImport || interruptedImportRef.current.interrupted)
      interruptedImportRef.current = { owner: accessRef.current.owner, interrupted: retainInterruptedNotice }
      importActiveRef.current = false
      dataAbortRef.current?.abort()
      nodeAbortRef.current?.abort()
      searchAbortRef.current?.abort()
      importAbortRef.current?.abort()
      dataGenerationRef.current += 1
      nodeGenerationRef.current += 1
      searchGenerationRef.current += 1
      importGenerationRef.current += 1
      setStats(null)
      setGraph(null)
      setDataLoading(true)
      setLoadError(null)
      setSelectedId(null)
      setSelected(null)
      setSelectedLoading(false)
      setSelectedError(null)
      setSearchHits(null)
      setSearchLoading(false)
      setSearchError(null)
      setImporting(false)
      setImportConfirm(null)
      setImportNotice(retainInterruptedNotice ? { tone: "neutral", text: "Import interrupted because Knowledge access changed. No further batches will be sent from this import. Already dispatched requests may have completed; their results have not been verified here. Refresh your graph after access is restored before starting another import." } : null)
    }
    wakeAdmissionWaiters()
  }, [accessRevision, accessStatus, wakeAdmissionWaiters])

  const loadData = useCallback(async () => {
    const owner = operationOwner
    const lifetime = operationLifetime
    if (!mountedRef.current || accessRef.current.status !== "ready" || accessRef.current.owner !== owner || accessRef.current.lifetime !== lifetime) return
    const generation = ++dataGenerationRef.current
    dataAbortRef.current?.abort()
    const controller = new AbortController()
    dataAbortRef.current = controller
    const isCurrent = () =>
      mountedRef.current && !controller.signal.aborted && dataGenerationRef.current === generation &&
      accessRef.current.owner === owner && accessRef.current.lifetime === lifetime && accessRef.current.status === "ready"
    const admitted = () => waitForAdmission(owner, lifetime, controller.signal)

    setDataLoading(true)
    setLoadError(null)
    try {
      const [statsResponse, graphResponse] = await Promise.all([
        fetch("/api/knowledge-graph/stats", { signal: controller.signal }),
        fetch("/api/knowledge-graph/graph?limit=100", { signal: controller.signal }),
      ])
      if (!await admitted() || !isCurrent()) return
      if (!statsResponse.ok || !graphResponse.ok) {
        const unavailable = statsResponse.status === 503 || graphResponse.status === 503
        throw new Error(
          unavailable
            ? "The Knowledge Graph service is not activated or is temporarily unavailable."
            : "Your knowledge graph could not be loaded."
        )
      }
      const [nextStats, nextGraph] = await Promise.all([
        statsResponse.json() as Promise<KgStats>,
        graphResponse.json() as Promise<KgGraphData>,
      ])
      if (await admitted() && isCurrent()) {
        // Flag on: a response missing nodes_by_type / top_entities / nodes / edges is treated as empty instead of crashing the render.
        const loadedStats = KNOWLEDGE_FIXES ? normalizeKgStats(nextStats) : nextStats
        const loadedGraph = KNOWLEDGE_FIXES ? normalizeKgGraph(nextGraph) : nextGraph
        if (KNOWLEDGE_FIXES && !loadedGraph) throw new Error("Your knowledge graph could not be loaded.")
        setStats(current => isCurrent() ? loadedStats : current)
        setGraph(current => isCurrent() && !sameKnowledgeSnapshot(current, loadedGraph) ? loadedGraph : current)
      }
    } catch (error) {
      if (await admitted() && isCurrent()) {
        setLoadError(KNOWLEDGE_FIXES
          ? plainKnowledgeError(error, "Your knowledge graph could not be loaded.")
          : error instanceof Error ? error.message : "Your knowledge graph could not be loaded.")
      }
    } finally {
      if (await admitted() && isCurrent()) setDataLoading(false)
    }
  }, [operationOwner, operationLifetime, waitForAdmission])

  useEffect(() => {
    if (accessStatus === "ready") {
      void loadData()
    }
  }, [accessRevision, accessStatus, loadData])

  useEffect(() => {
    if (!KNOWLEDGE_FIXES) return
    const leaving = () => { pageLeavingRef.current = true }
    const returned = () => { pageLeavingRef.current = false }
    window.addEventListener("pagehide", leaving)
    window.addEventListener("pageshow", returned)
    return () => {
      window.removeEventListener("pagehide", leaving)
      window.removeEventListener("pageshow", returned)
    }
  }, [])

  // Flag on: an import this browser started that never reported finishing (the page was reloaded or closed, or it runs in another tab)
  // is announced on return. Read when the page becomes usable (access "ready"), and again if access is retired and restored, because
  // retiring access clears the notice; an existing notice (for example "interrupted because Knowledge access changed") is never replaced.
  // The marker is written and cleared by the import itself.
  useEffect(() => {
    if (!KNOWLEDGE_FIXES || accessStatus !== "ready" || importActiveRef.current) return
    const marker = readImportMarker(ownerTag(operationOwner))
    if (!marker) return
    const found = resumedImportNotice(marker)
    setImportNotice(current => current ?? { tone: "neutral", kind: found.kind, text: found.text })
  }, [operationOwner, accessStatus, accessRevision])

  useEffect(() => {
    const generation = ++nodeGenerationRef.current
    nodeAbortRef.current?.abort()

    if (!selectedId) {
      setSelected(null)
      setSelectedError(null)
      setSelectedLoading(false)
      return
    }
    const owner = operationOwner
    const lifetime = operationLifetime
    if (!mountedRef.current || accessRef.current.status !== "ready" || accessRef.current.owner !== owner || accessRef.current.lifetime !== lifetime) return

    const controller = new AbortController()
    nodeAbortRef.current = controller
    const isCurrent = () =>
      mountedRef.current && !controller.signal.aborted && nodeGenerationRef.current === generation &&
      accessRef.current.owner === owner && accessRef.current.lifetime === lifetime && accessRef.current.status === "ready"
    const admitted = () => waitForAdmission(owner, lifetime, controller.signal)

    setSelectedLoading(true)
    setSelected(null)
    setSelectedError(null)
    void fetch(`/api/knowledge-graph/nodes/${encodeURIComponent(selectedId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!await admitted() || !isCurrent()) return null
        if (!response.ok) throw new Error("Entity details could not be loaded.")
        return response.json() as Promise<KgNodeDetail>
      })
      .then(async (detail) => {
        if (detail && await admitted() && isCurrent()) setSelected(detail)
      })
      .catch(async (error) => {
        if (await admitted() && isCurrent()) {
          setSelectedError(KNOWLEDGE_FIXES
            ? plainKnowledgeError(error, "Entity details could not be loaded.")
            : error instanceof Error ? error.message : "Entity details could not be loaded.")
        }
      })
      .finally(async () => {
        if (await admitted() && isCurrent()) setSelectedLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [selectedId, detailAttempt, accessRevision, accessStatus, operationOwner, operationLifetime, waitForAdmission])

  useLayoutEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      dataAbortRef.current?.abort()
      nodeAbortRef.current?.abort()
      searchAbortRef.current?.abort()
      importAbortRef.current?.abort()
      dataGenerationRef.current += 1
      nodeGenerationRef.current += 1
      searchGenerationRef.current += 1
      importGenerationRef.current += 1
      importActiveRef.current = false
      wakeAdmissionWaiters()
    }
  }, [wakeAdmissionWaiters])

  const clearSearchResults = useCallback(() => {
    searchAbortRef.current?.abort()
    searchGenerationRef.current += 1
    setSearchHits(null)
    setSearchError(null)
    setSearchLoading(false)
  }, [])

  const runSearch = useCallback(async () => {
    const owner = operationOwner
    const lifetime = operationLifetime
    if (!mountedRef.current || accessRef.current.status !== "ready" || accessRef.current.owner !== owner || accessRef.current.lifetime !== lifetime) return
    const query = searchQuery.trim()
    if (!query) {
      clearSearchResults()
      return
    }

    const generation = ++searchGenerationRef.current
    searchAbortRef.current?.abort()
    const controller = new AbortController()
    searchAbortRef.current = controller
    const isCurrent = () =>
      mountedRef.current && !controller.signal.aborted && searchGenerationRef.current === generation &&
      accessRef.current.owner === owner && accessRef.current.lifetime === lifetime && accessRef.current.status === "ready"
    const admitted = () => waitForAdmission(owner, lifetime, controller.signal)

    setSearchLoading(true)
    setSearchError(null)
    try {
      const response = await fetch("/api/knowledge-graph/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_nodes: 10 }),
        signal: controller.signal,
      })
      if (!await admitted() || !isCurrent()) return
      if (!response.ok) throw new Error("Search is unavailable right now.")
      const body = await response.json()
      if (!await admitted() || !isCurrent()) return
      const nodes = Array.isArray(body.nodes) ? body.nodes : []
      setSearchHits(
        nodes.map((node: Partial<KgViewNode>) => ({
          node_id: String(node.node_id ?? ""),
          name: String(node.name ?? "Unnamed entity"),
          entity_type: String(node.entity_type ?? "CONCEPT"),
          description: node.description ?? null,
          salience: Number(node.salience ?? 1),
          mention_count: Number(node.mention_count ?? 1),
        })).filter((node: KgViewNode) => Boolean(node.node_id))
      )
    } catch (error) {
      if (await admitted() && isCurrent()) {
        setSearchHits([])
        setSearchError(KNOWLEDGE_FIXES
          ? plainKnowledgeError(error, "Search is unavailable right now.")
          : error instanceof Error ? error.message : "Search is unavailable right now.")
      }
    } finally {
      if (await admitted() && isCurrent()) setSearchLoading(false)
    }
  }, [clearSearchResults, searchQuery, operationOwner, operationLifetime, waitForAdmission])

  const runImport = useCallback(async () => {
    const owner = operationOwner
    const lifetime = operationLifetime
    if (!mountedRef.current || accessRef.current.status !== "ready" || accessRef.current.owner !== owner || accessRef.current.lifetime !== lifetime) return
    const generation = ++importGenerationRef.current
    importAbortRef.current?.abort()
    const controller = new AbortController()
    importAbortRef.current = controller
    const isCurrent = () =>
      mountedRef.current && !controller.signal.aborted && importGenerationRef.current === generation &&
      accessRef.current.owner === owner && accessRef.current.lifetime === lifetime && accessRef.current.status === "ready"
    const admitted = () => waitForAdmission(owner, lifetime, controller.signal)

    importActiveRef.current = true
    interruptedImportRef.current = { owner, interrupted: false }
    setImporting(true)
    // Flag on: remember in this browser that an import started, so a reload (or a second tab) can say one may still be running.
    const markerOwner = KNOWLEDGE_FIXES ? ownerTag(owner) : ""
    const markerStartedAt = Date.now()
    if (KNOWLEDGE_FIXES) writeImportMarker(markerOwner, markerStartedAt, markerStartedAt)
    setImportNotice({ tone: "neutral", text: "Importing eligible past sessions. This can take a few minutes…" })
    const totals = {
      processed: 0,
      completed: 0,
      retryable: 0,
      alreadyPresent: 0,
      entitiesCreated: 0,
      entitiesMerged: 0,
    }
    try {
      let cursor: number | null = 0
      let batchCount = 0
      let foundAny = false
      while (cursor !== null && batchCount < 20) {
        if (!await admitted() || !isCurrent()) return
        const response: Response = await fetch(
          `/api/knowledge-graph/backfill?cursor=${cursor}`,
          { method: "POST", signal: controller.signal }
        )
        if (!await admitted() || !isCurrent()) return
        const body: Record<string, unknown> = await response.json().catch(() => ({}))
        if (!await admitted() || !isCurrent()) return
        if (!response.ok) {
          throw new Error(
            KNOWLEDGE_FIXES
              ? importFailureText(response.status, body.error)
              : typeof body.error === "string"
              ? body.error
              : "Past sessions could not be imported."
          )
        }
        if (KNOWLEDGE_FIXES) touchImportMarker(markerOwner, markerStartedAt)
        if (body.no_sessions_found && !foundAny) {
          setImportNotice({ tone: "neutral", text: "No eligible past sessions with uploads or research were found." })
          return
        }

        foundAny = true
        const processed = Number(body.sessions_processed ?? 0)
        const completed = Number(body.sessions_completed ?? 0)
        totals.processed += processed
        totals.completed += completed
        totals.retryable += Number(body.sessions_retryable ?? 0)
        totals.alreadyPresent += Number(body.sessions_already_consolidated ?? 0)
        totals.entitiesCreated += Number(body.entities_created ?? 0)
        totals.entitiesMerged += Number(body.entities_merged ?? 0)

        const totalCandidates = Number(body.total_candidates ?? totals.processed)
        setImportNotice({
          tone: "neutral",
          text: `Processed ${formatNumber(totals.processed)} of ${formatNumber(totalCandidates)} eligible session ${noun(totalCandidates, "ID", "IDs")} · ${formatNumber(totals.completed)} completed…`,
        })
        cursor = typeof body.next_cursor === "number" ? body.next_cursor : null
        batchCount += 1
      }

      const incomplete = Math.max(totals.processed - totals.completed, 0)
      const nonRetryable = Math.max(incomplete - totals.retryable, 0)
      const moreBatchesRemain = cursor !== null
      const partial = incomplete > 0 || moreBatchesRemain
      if (!await admitted() || !isCurrent()) return
      setImportNotice({
        tone: nonRetryable > 0 ? "error" : partial ? "neutral" : "success",
        text:
          `${partial ? "Processed" : "Imported"} ${formatNumber(totals.processed)} session ID${totals.processed === 1 ? "" : "s"}: ` +
          `${formatNumber(totals.completed)} completed` +
          (totals.retryable ? `, ${formatNumber(totals.retryable)} ${noun(totals.retryable, "needs", "need")} another attempt` : "") +
          (nonRetryable ? `, and ${formatNumber(nonRetryable)} could not be imported` : "") +
          `. ${formatNumber(totals.entitiesCreated)} new ${noun(totals.entitiesCreated, "entity", "entities")} and ${formatNumber(totals.entitiesMerged)} reinforced.` +
          (totals.alreadyPresent
            ? ` ${formatNumber(totals.alreadyPresent)} ${noun(totals.alreadyPresent, "was", "were")} already in your graph.`
            : "") +
          (moreBatchesRemain
            ? " This bounded import stopped before all eligible sessions were processed. More sessions remain according to the returned cursor. You can run Import past sessions again."
            : ""),
      })
      if (await admitted() && isCurrent()) await loadData()
    } catch (error) {
      if (await admitted() && isCurrent()) {
        setImportNotice({
          tone: "error",
          ...(KNOWLEDGE_FIXES ? { kind: "failed" as const } : {}),
          text:
            (totals.processed ? `${formatNumber(totals.processed)} session ${noun(totals.processed, "ID was", "IDs were")} processed before import paused. ` : "") +
            (KNOWLEDGE_FIXES
              ? plainKnowledgeError(error, IMPORT_FAILED_TEXT, OFFLINE_IMPORT_TEXT)
              : error instanceof Error ? error.message : "Past sessions could not be imported."),
        })
      }
    } finally {
      if (await admitted() && isCurrent()) {
        // Flag on: the import finished (or failed) in this tab, so there is nothing left to announce. An import cut short by leaving the page
        // within the app never gets here, and its marker stays. A reload or a closed tab makes the browser reject the request that is in
        // flight, which lands here as a network failure: pagehide comes first, so that case keeps the marker too.
        if (KNOWLEDGE_FIXES && !pageLeavingRef.current) clearImportMarker(markerOwner, markerStartedAt)
        importActiveRef.current = false
        setImporting(false)
      }
    }
  }, [loadData, operationOwner, operationLifetime, waitForAdmission])

  // Flag on: every way to start an import (the header button, the empty-map button, the failed-import banner's Retry) only opens the confirm
  // dialog. The import starts from the dialog's own button and from nowhere else.
  const requestImport = useCallback(() => {
    if (importActiveRef.current) return
    setImportConfirm({ warning: importConfirmWarning(readImportMarker(ownerTag(operationOwner))) })
  }, [operationOwner])

  const filteredGraph = useMemo(() => {
    if (!graph || hiddenTypes.size === 0) return graph
    const nodes = graph.nodes.filter((node) => !hiddenTypes.has(node.entity_type))
    const ids = new Set(nodes.map((node) => node.node_id))
    return {
      ...graph,
      nodes,
      edges: graph.edges.filter((edge) => ids.has(edge.src_node_id) && ids.has(edge.dst_node_id)),
    }
  }, [graph, hiddenTypes])

  // The opaque key contains no graph data. An unchanged filtered snapshot may
  // restore its view after a temporary check; material data/filter changes fit.
  const presentationKey = useMemo(() => ({}), [filteredGraph])
  const graphPresentation = useMemo(() => ({
    key: presentationKey,
    stateRef: presentationContext.stateRef,
  }), [presentationKey, presentationContext])

  if (kg.isLoading) return <AccessState kind="loading" />
  if (!kg.isEntitled) return <AccessState kind="locked" />
  if (!kg.serviceAvailable || (kg.error && !kg.settings)) return <AccessState kind="unavailable" onRetry={() => void kg.refetch()} />
  if (!kg.isSubscribed) return <AccessState kind="paused" />

  const lastUpdated = formatDate(stats?.last_updated_at)
  const visibleNodes = filteredGraph?.nodes.length ?? 0
  const selectedMapNode = selectedId ? graph?.nodes.find(node => node.node_id === selectedId) : undefined
  const selectionOutsideMap = Boolean(selectedId && graph && !filteredGraph?.nodes.some(node => node.node_id === selectedId))
  // Flag on: the graph loaded and has nothing in it (the page's own empty-map condition).
  const graphIsEmpty = KNOWLEDGE_EMPTY_STATE && isEmptyGraph({ dataLoading, graph, loadError })

  // Flag on: a render error inside one section shows a plain notice in that section's place; the rest of the page keeps working.
  // Flag off: returns the node untouched.
  const guardSection = (label: string, node: ReactNode, resetKey?: unknown) =>
    KNOWLEDGE_FIXES ? <KnowledgeSectionBoundary label={label} resetKey={resetKey}>{node}</KnowledgeSectionBoundary> : node

  const summaryCards = (
<section data-studio-knowledge-role="summary" className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Knowledge graph summary">
        {dataLoading && !stats ? (
          <><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></>
        ) : STUDIO_SHELL && !stats ? (
          <>{["Entities", "Relations", "Evidence", "Sessions"].map(label => <MetricUnavailable key={label} label={label} />)}</>
        ) : (
          <>
            <MetricCard icon={Database} label="Entities" value={stats?.node_count ?? 0} detail="Facts, people, products and ideas" accent="bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900" />
            <MetricCard icon={GitBranch} label="Relations" value={stats?.edge_count ?? 0} detail="Connections across your knowledge" accent="bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900" />
            <MetricCard icon={FileText} label="Evidence" value={stats?.evidence_count ?? 0} detail="Source-backed supporting snippets" accent="bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900" />
            <MetricCard icon={Layers3} label="Sessions" value={stats?.sessions_consolidated ?? 0} detail="Deck sessions contributing knowledge" accent="bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900" />
          </>
        )}
      </section>
  )
  const renderTypeFilters = () => (
stats && stats.nodes_by_type.length > 0 && (
              <div data-studio-knowledge-role="filters" className="mt-4 flex flex-wrap gap-1.5" aria-label="Filter entities by type">
                {stats.nodes_by_type.map((item) => {
                  const active = !hiddenTypes.has(item.entity_type)
                  return (
                    <button
                      key={item.entity_type}
                      type="button"
                      aria-pressed={active}
                      onClick={() => {
                        setHiddenTypes((current) => {
                          const next = new Set(current)
                          if (next.has(item.entity_type)) next.delete(item.entity_type)
                          else next.add(item.entity_type)
                          return next
                        })
                      }}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                        active
                          ? "border-slate-200 bg-white text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                          : "border-transparent bg-slate-100 text-slate-400 opacity-60 dark:bg-slate-800/60"
                      )}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: typeColor(item.entity_type) }} />
                      {friendlyType(item.entity_type)} <span className="text-slate-400">{formatNumber(item.count)}</span>
                    </button>
                  )
                })}
                {hiddenTypes.size > 0 && (
                  <button type="button" onClick={() => setHiddenTypes(new Set())} className="rounded-full px-2.5 py-1 text-xs font-medium text-violet-600 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-violet-300 dark:hover:bg-violet-950/40">
                    Show all
                  </button>
                )}
              </div>
            )
  )
  // Flag on: evaluated inside its own boundary, so a bad field here cannot throw from the page body itself.
  const typeFilters = KNOWLEDGE_FILTER_TABS
    ? <StudioKnowledgeFilterTabs nodesByType={stats?.nodes_by_type} hiddenTypes={hiddenTypes} onPick={setHiddenTypes} colorFor={typeColor} />
    : KNOWLEDGE_FIXES
    ? <KnowledgeSectionBoundary label="type filters" resetKey={stats}><LazySection render={renderTypeFilters} /></KnowledgeSectionBoundary>
    : renderTypeFilters()
  const headerContext = <>
<p data-studio-knowledge-role="description" className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Explore the entities, relationships, and source evidence accumulated from the decks you chose to connect.
          </p>
          {lastUpdated && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock3 className="h-3.5 w-3.5" /> Last updated {lastUpdated}
            </p>
          )}
  </>
  // Flag on (J6 L5): the search field sits in the header; the one block of markup, the same handlers. Flag off: rendered in the map header, as before.
  const knowledgeSearch = (
    <div data-studio-knowledge-role="search" className="relative w-full lg:max-w-sm">
      <form
        onSubmit={(event) => { event.preventDefault(); void runSearch() }}
        className="flex gap-2"
        role="search"
      >
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            ref={STUDIO_SHELL ? searchInputRef : undefined}
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value)
              clearSearchResults()
            }}
            className="pl-9 pr-8"
            placeholder="Search your knowledge…"
            aria-label="Search your knowledge graph"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); clearSearchResults(); if (STUDIO_SHELL) searchInputRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:text-slate-200"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button type="submit" variant="outline" size="icon" disabled={searchLoading} aria-label="Run search">
          {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>

      {searchHits !== null && (
        <div data-studio-knowledge-role={STUDIO_SHELL ? "search-results" : undefined} className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
          {STUDIO_SHELL && <div className="sk-search-summary"><span>{searchError ? "Search unavailable" : `${searchHits.length} returned results`}</span><button type="button" aria-label="Close knowledge search results" onClick={() => { clearSearchResults(); searchInputRef.current?.focus() }}><X size={13} /></button></div>}
          {searchError && (KNOWLEDGE_FIXES
            ? <div className="flex items-center justify-between gap-3 px-3 py-3"><p className="min-w-0 text-sm text-amber-700 dark:text-amber-300">{searchError}</p><button type="button" onClick={() => void runSearch()} className="shrink-0 rounded-md border border-amber-300 px-2.5 py-0.5 text-xs font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 dark:border-amber-800 dark:text-amber-100 dark:hover:bg-amber-950/50">Retry</button></div>
            : <p className="px-3 py-3 text-sm text-amber-700 dark:text-amber-300">{searchError}</p>)}
          {!searchError && searchHits.length === 0 && <p className="px-3 py-3 text-sm text-slate-500">No matching entities found.</p>}
          {!searchError && searchHits.map((node) => (
            <button
              key={node.node_id}
              type="button"
              onClick={() => { setSelectedId(node.node_id); clearSearchResults() }}
              className="flex w-full items-center gap-2 border-b border-slate-100 px-3 py-2.5 text-left last:border-0 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500 dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: typeColor(node.entity_type) }} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-800 dark:text-slate-200">{node.name}</span>
              <span className="text-[10px] uppercase text-slate-400">{node.entity_type}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <main data-studio-knowledge="true" data-studio-intro-surface="knowledge" className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header data-studio-knowledge-role="header" className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div data-studio-knowledge-role="caption" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            <Sparkles className="h-3.5 w-3.5" /> Your second brain
          </div>
          <h1 data-studio-knowledge-role="title" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            {STUDIO_SHELL ? "Second Brain" : "Knowledge"}
          </h1>
          {STUDIO_SHELL && <p className="sk-page-subtitle">Your sources and ideas, connected in one view.</p>}
          {STUDIO_SHELL ? <details data-studio-knowledge-role="context"><summary>About this knowledge{lastUpdated ? ` · Updated ${lastUpdated}` : ""}</summary>{headerContext}</details> : headerContext}
        </div>
        <div data-studio-knowledge-role={KNOWLEDGE_HEADER_ACTIONS ? "header-tools" : "actions"} className="flex flex-wrap gap-2">
          {KNOWLEDGE_HEADER_ACTIONS && (
            <StudioKnowledgeSourcesMenu
              sessions={stats?.sessions_consolidated}
              importing={importing}
              loading={dataLoading}
              onImport={KNOWLEDGE_FIXES ? requestImport : runImport}
              onRefresh={() => void loadData()}
              settingsHref="/settings/knowledge-graph"
            />
          )}
          {KNOWLEDGE_HEADER_ACTIONS && knowledgeSearch}
          {!KNOWLEDGE_HEADER_ACTIONS && STUDIO_SHELL && <Button variant="outline" disabled={dataLoading || importing} onClick={() => void loadData()}><RefreshCw className={cn("mr-2 h-4 w-4", dataLoading && "animate-spin")} />{dataLoading ? "Refreshing…" : "Refresh"}</Button>}
          {!KNOWLEDGE_HEADER_ACTIONS && (
            <Button variant="outline" onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}>
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
              {importing ? "Importing…" : "Import past sessions"}
            </Button>
          )}
          {!KNOWLEDGE_HEADER_ACTIONS && (
            <Button asChild variant="ghost" size="icon">
              <Link href="/settings/knowledge-graph" aria-label="Knowledge Graph settings" title="Knowledge settings">
                <Settings className="h-4 w-4" />
              </Link>
            </Button>
          )}
        </div>
      </header>

      {importNotice && (
        <div
          role="status"
          className={cn(
            "mb-4 flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm",
            importNotice.tone === "success" && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200",
            importNotice.tone === "error" && "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200",
            importNotice.tone === "neutral" && "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200"
          )}
        >
          <span className={KNOWLEDGE_FIXES ? "min-w-0 flex-1" : undefined}>{importNotice.text}</span>
          {KNOWLEDGE_FIXES && importNotice.kind === "failed" && !importing && (
            <button type="button" onClick={() => requestImport()} className="shrink-0 rounded-md border border-red-300 bg-white/70 px-2.5 py-0.5 text-xs font-medium text-red-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current dark:border-red-800 dark:bg-transparent dark:text-red-200 dark:hover:bg-red-950/50">
              Retry
            </button>
          )}
          {KNOWLEDGE_FIXES && importNotice.kind === "resumed" && (
            <button type="button" disabled={dataLoading} onClick={() => void loadData()} className="shrink-0 rounded-md border border-blue-300 bg-white/70 px-2.5 py-0.5 text-xs font-medium text-blue-800 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current disabled:opacity-60 dark:border-blue-800 dark:bg-transparent dark:text-blue-200 dark:hover:bg-blue-950/50">
              Refresh
            </button>
          )}
          {!importing && (
            <button type="button" onClick={() => { interruptedImportRef.current.interrupted = false; if (KNOWLEDGE_FIXES && importNotice.kind === "interrupted") clearImportMarker(ownerTag(operationOwner)); setImportNotice(null) }} className="rounded p-0.5 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label="Dismiss import message">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {guardSection("summary", STUDIO_SHELL ? <details data-studio-knowledge-role="summary-disclosure"><summary><span>Knowledge summary</span><span>{stats ? `${formatNumber(stats.node_count)} ${noun(stats.node_count, "entity", "entities")} · ${formatNumber(stats.edge_count)} ${noun(stats.edge_count, "relation", "relations")} · ${formatNumber(stats.evidence_count)} evidence · ${formatNumber(stats.sessions_consolidated)} ${noun(stats.sessions_consolidated, "session", "sessions")}` : dataLoading ? "Loading counts…" : "Counts not loaded"}</span></summary>{summaryCards}</details> : summaryCards, stats)}

      {loadError && (
        <section data-studio-knowledge-role={STUDIO_SHELL ? "load-error" : undefined} role={STUDIO_SHELL ? "alert" : undefined} className="mb-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Knowledge could not be loaded</p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">{loadError}</p>
              {STUDIO_SHELL && graph && <p className="sk-stale-note">Showing the last loaded snapshot. Counts and source status may have changed.</p>}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </section>
      )}

      <div data-studio-knowledge-role="layout" className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <section data-studio-knowledge-role="map-panel" className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div data-studio-knowledge-role="map-header" className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                  <Network className="h-4 w-4 text-violet-500" /> Knowledge map
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {graph
                    ? `Showing ${formatNumber(visibleNodes)} of ${formatNumber(graph.total_nodes)} ${noun(graph.total_nodes, "entity", "entities")}`
                    : STUDIO_SHELL && !dataLoading ? "Graph not loaded" : "Loading the most reinforced entities…"}
                </p>
              </div>

              {KNOWLEDGE_HEADER_ACTIONS ? null : knowledgeSearch}
            </div>

            {typeFilters}
            {STUDIO_SHELL && <details data-studio-knowledge-role="map-support"><summary>Map scope{hiddenTypes.size > 0 ? ` · ${hiddenTypes.size} types hidden` : ""}</summary>{graph && <p className="sk-refresh-note" role="status">{dataLoading ? "Refreshing the loaded snapshot…" : `${graph.nodes.length} entities loaded · type filters apply to this snapshot. Search can find entities beyond this map.`}</p>}<p className="sk-refresh-note">Scroll to zoom, drag to explore, or use the map controls. Entity list offers the same loaded entities in a readable list.</p></details>}
          </div>

          {STUDIO_SHELL && selectionOutsideMap && <div className="sk-map-selection-note" role="status"><span>{selectedMapNode ? "The selected entity is hidden by your type filters. Use the inspector to review its details." : "The selected entity is outside this loaded map. Use the inspector to review its details."}</span>{selectedMapNode && <button type="button" onClick={() => setHiddenTypes(current => { const next = new Set(current); next.delete(selectedMapNode.entity_type); return next })}>Show {friendlyType(selectedMapNode.entity_type)} entities</button>}</div>}

          <div data-studio-knowledge-role="map-content" className="p-2 sm:p-3">
            {STUDIO_SHELL && !dataLoading && loadError && (!graph || graph.nodes.length === 0) && <div data-studio-knowledge-role="map-recovery"><AlertCircle size={28} /><h3>{graph ? 'Last loaded map was empty' : 'Your knowledge map is unavailable'}</h3><p>{graph ? 'Refresh to check the current graph. Existing records have not been changed.' : 'Load your graph to review recorded entities and source evidence. Unavailable data is not an empty library.'}</p><div className="sk-recovery-actions"><Button variant="outline" disabled={dataLoading || importing} onClick={() => void loadData()}><RefreshCw size={14} />Retry graph</Button><Button variant="ghost" asChild><Link href="/settings/knowledge-graph">Review settings</Link></Button></div></div>}
            {dataLoading && !graph && (
              <div data-studio-knowledge-role={STUDIO_SHELL ? "map-loading" : undefined} role="status" className="flex min-h-[520px] items-center justify-center rounded-2xl bg-[#070b18]">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                  <p className="mt-3 text-sm text-slate-400">Mapping your knowledge…</p>
                </div>
              </div>
            )}

            {graphIsEmpty && (
              <StudioKnowledgeEmptyMap importing={importing} onImport={KNOWLEDGE_FIXES ? requestImport : runImport} />
            )}
            {!KNOWLEDGE_EMPTY_STATE && !dataLoading && graph && graph.nodes.length === 0 && !loadError && (
              <div data-studio-knowledge-role={STUDIO_SHELL ? "map-empty" : undefined} className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center">
                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-violet-300">
                  <Brain className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">Your graph is ready to grow</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Build a deck with Knowledge enabled, or import eligible past sessions to create your first entities and connections.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={KNOWLEDGE_FIXES ? requestImport : runImport} disabled={importing}><Import className="mr-2 h-4 w-4" /> Import past sessions</Button>
                  <Button asChild variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"><Link href="/builder">Build a deck</Link></Button>
                </div>
              </div>
            )}

            {filteredGraph && filteredGraph.nodes.length > 0 && guardSection("knowledge map", (
              <KgGraphView
                key={presentationContext.generation}
                nodes={filteredGraph.nodes}
                edges={filteredGraph.edges}
                selectedId={selectedId}
                onSelect={selectKnowledgeNode}
                presentation={graphPresentation}
              />
            ), graph)}

            {graph && graph.nodes.length > 0 && filteredGraph?.nodes.length === 0 && (
              <div data-studio-knowledge-role={STUDIO_SHELL ? "map-filtered" : undefined} className="flex min-h-[430px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center sm:min-h-[520px]">
                <Network className="h-8 w-8 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-200">All entity types are hidden</p>
                <button type="button" onClick={() => setHiddenTypes(new Set())} className="mt-2 text-sm text-violet-300 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Show the full graph</button>
              </div>
            )}
          </div>
        </section>

        {guardSection("entity inspector", (
          <Inspector
            selected={selected}
            loading={selectedLoading}
            error={selectedError}
            topEntities={stats?.top_entities ?? []}
            onSelect={selectKnowledgeNode}
            selectedId={selectedId}
            onRetry={() => setDetailAttempt(attempt => attempt + 1)}
            onClear={() => setSelectedId(null)}
            {...(KNOWLEDGE_EMPTY_STATE ? { emptyGraph: graphIsEmpty } : {})}
          />
        ), selected ?? selectedId)}
      </div>
      {KNOWLEDGE_FIXES && (
        <KnowledgeImportConfirm
          open={importConfirm !== null}
          warning={importConfirm?.warning ?? null}
          onCancel={() => setImportConfirm(null)}
          onConfirm={() => { setImportConfirm(null); if (!importActiveRef.current) void runImport() }}
        />
      )}
      <StudioIntroReplay screen="knowledge" autoStart={true} targetSelector='[data-studio-intro-surface="knowledge"]' className="studio-destination-intro-replay" />
    </main>
  )
}
