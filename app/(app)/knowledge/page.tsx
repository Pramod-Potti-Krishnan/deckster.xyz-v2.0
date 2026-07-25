"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
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
import type { KgViewEdge, KgViewNode } from "@/components/knowledge/kg-graph-view"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export const dynamic = "force-dynamic"

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

type ImportNotice = { tone: "success" | "error" | "neutral"; text: string }

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
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/80">
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="h-3 w-20 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-3 h-8 w-16 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
      <div className="mt-2 h-3 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-800/70" />
    </div>
  )
}

function AccessState({
  kind,
}: {
  kind: "loading" | "locked" | "paused" | "unavailable"
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
        "The knowledge service could not be reached. Your existing graph has not been changed.",
    },
  }[kind]
  const Icon = content.icon

  return (
    <main className="mx-auto flex min-h-[calc(100vh-3.5rem)] max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
      <section className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_0%,rgba(124,58,237,0.18),transparent_38%),radial-gradient(circle_at_90%_85%,rgba(37,99,235,0.15),transparent_35%)]" />
        <div className="relative grid min-h-[500px] items-center gap-10 p-7 md:grid-cols-[0.9fr_1.1fr] md:p-12">
          <div className="max-w-xl">
            <div className="mb-5 inline-flex rounded-2xl border border-violet-200 bg-violet-50 p-3 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/50 dark:text-violet-300">
              <Icon className={cn("h-6 w-6", kind === "loading" && "animate-spin")} />
            </div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
              Deckster Knowledge
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {content.title}
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
              {content.description}
            </p>
            {kind === "locked" && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild><Link href="/pricing">View Pro plans</Link></Button>
                <Button asChild variant="outline"><Link href="/builder">Back to Builder</Link></Button>
              </div>
            )}
            {kind === "paused" && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button asChild>
                  <Link href="/settings/knowledge-graph">
                    <ShieldCheck className="mr-2 h-4 w-4" /> Review and enable
                  </Link>
                </Button>
                <Button asChild variant="outline"><Link href="/builder">Back to Builder</Link></Button>
              </div>
            )}
            {kind === "unavailable" && (
              <div className="mt-7 flex flex-wrap gap-3">
                <Button onClick={() => window.location.reload()}>
                  <RefreshCw className="mr-2 h-4 w-4" /> Try again
                </Button>
                <Button asChild variant="outline"><Link href="/settings/knowledge-graph">Open settings</Link></Button>
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
}: {
  selected: KgNodeDetail | null
  loading: boolean
  error: string | null
  topEntities: KgStats["top_entities"]
  onSelect: (nodeId: string) => void
}) {
  return (
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80 xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
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
  return <KnowledgePageForAccount key={kg.accountKey} kg={kg} />
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
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHits, setSearchHits] = useState<KgViewNode[] | null>(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [importNotice, setImportNotice] = useState<ImportNotice | null>(null)
  const dataGenerationRef = useRef(0)
  const dataAbortRef = useRef<AbortController | null>(null)
  const nodeGenerationRef = useRef(0)
  const nodeAbortRef = useRef<AbortController | null>(null)
  const searchGenerationRef = useRef(0)
  const searchAbortRef = useRef<AbortController | null>(null)
  const importGenerationRef = useRef(0)
  const importAbortRef = useRef<AbortController | null>(null)

  const loadData = useCallback(async () => {
    const generation = ++dataGenerationRef.current
    dataAbortRef.current?.abort()
    const controller = new AbortController()
    dataAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted && dataGenerationRef.current === generation

    setDataLoading(true)
    setLoadError(null)
    try {
      const [statsResponse, graphResponse] = await Promise.all([
        fetch("/api/knowledge-graph/stats", { signal: controller.signal }),
        fetch("/api/knowledge-graph/graph?limit=100", { signal: controller.signal }),
      ])
      if (!isCurrent()) return
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
      if (isCurrent()) {
        setStats(nextStats)
        setGraph(nextGraph)
      }
    } catch (error) {
      if (isCurrent()) {
        setLoadError(error instanceof Error ? error.message : "Your knowledge graph could not be loaded.")
      }
    } finally {
      if (isCurrent()) setDataLoading(false)
    }
  }, [])

  useEffect(() => {
    if (kg.isEntitled && kg.isSubscribed) {
      void loadData()
    } else {
      dataAbortRef.current?.abort()
      dataGenerationRef.current += 1
    }
  }, [kg.isEntitled, kg.isSubscribed, loadData])

  useEffect(() => {
    const generation = ++nodeGenerationRef.current
    nodeAbortRef.current?.abort()

    if (!selectedId) {
      setSelected(null)
      setSelectedError(null)
      setSelectedLoading(false)
      return
    }

    const controller = new AbortController()
    nodeAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted && nodeGenerationRef.current === generation

    setSelectedLoading(true)
    setSelected(null)
    setSelectedError(null)
    void fetch(`/api/knowledge-graph/nodes/${encodeURIComponent(selectedId)}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Entity details could not be loaded.")
        return response.json() as Promise<KgNodeDetail>
      })
      .then((detail) => {
        if (isCurrent()) setSelected(detail)
      })
      .catch((error) => {
        if (isCurrent()) {
          setSelectedError(error instanceof Error ? error.message : "Entity details could not be loaded.")
        }
      })
      .finally(() => {
        if (isCurrent()) setSelectedLoading(false)
      })
    return () => {
      controller.abort()
    }
  }, [selectedId])

  useEffect(() => () => {
    dataAbortRef.current?.abort()
    nodeAbortRef.current?.abort()
    searchAbortRef.current?.abort()
    importAbortRef.current?.abort()
    dataGenerationRef.current += 1
    nodeGenerationRef.current += 1
    searchGenerationRef.current += 1
    importGenerationRef.current += 1
  }, [])

  const clearSearchResults = useCallback(() => {
    searchAbortRef.current?.abort()
    searchGenerationRef.current += 1
    setSearchHits(null)
    setSearchError(null)
    setSearchLoading(false)
  }, [])

  const runSearch = useCallback(async () => {
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
      !controller.signal.aborted && searchGenerationRef.current === generation

    setSearchLoading(true)
    setSearchError(null)
    try {
      const response = await fetch("/api/knowledge-graph/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max_nodes: 10 }),
        signal: controller.signal,
      })
      if (!isCurrent()) return
      if (!response.ok) throw new Error("Search is unavailable right now.")
      const body = await response.json()
      if (!isCurrent()) return
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
      if (isCurrent()) {
        setSearchHits([])
        setSearchError(error instanceof Error ? error.message : "Search is unavailable right now.")
      }
    } finally {
      if (isCurrent()) setSearchLoading(false)
    }
  }, [clearSearchResults, searchQuery])

  const runImport = useCallback(async () => {
    const generation = ++importGenerationRef.current
    importAbortRef.current?.abort()
    const controller = new AbortController()
    importAbortRef.current = controller
    const isCurrent = () =>
      !controller.signal.aborted && importGenerationRef.current === generation

    setImporting(true)
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
        const response: Response = await fetch(
          `/api/knowledge-graph/backfill?cursor=${cursor}`,
          { method: "POST", signal: controller.signal }
        )
        const body: Record<string, unknown> = await response.json().catch(() => ({}))
        if (!isCurrent()) return
        if (!response.ok) {
          throw new Error(
            typeof body.error === "string"
              ? body.error
              : "Past sessions could not be imported."
          )
        }
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
          text: `Imported ${formatNumber(totals.processed)} of ${formatNumber(totalCandidates)} eligible session IDs…`,
        })
        cursor = typeof body.next_cursor === "number" ? body.next_cursor : null
        batchCount += 1
      }

      const incomplete = Math.max(totals.processed - totals.completed, 0)
      const nonRetryable = Math.max(incomplete - totals.retryable, 0)
      const partial = incomplete > 0
      setImportNotice({
        tone: nonRetryable > 0 ? "error" : partial ? "neutral" : "success",
        text:
          `${partial ? "Processed" : "Imported"} ${formatNumber(totals.processed)} session ID${totals.processed === 1 ? "" : "s"}: ` +
          `${formatNumber(totals.completed)} completed` +
          (totals.retryable ? `, ${formatNumber(totals.retryable)} need another attempt` : "") +
          (nonRetryable ? `, and ${formatNumber(nonRetryable)} could not be imported` : "") +
          `. ${formatNumber(totals.entitiesCreated)} new entities and ${formatNumber(totals.entitiesMerged)} reinforced.` +
          (totals.alreadyPresent
            ? ` ${formatNumber(totals.alreadyPresent)} were already in your graph.`
            : ""),
      })
      await loadData()
    } catch (error) {
      if (isCurrent()) {
        setImportNotice({
          tone: "error",
          text:
            (totals.processed ? `${formatNumber(totals.processed)} session IDs were processed before import paused. ` : "") +
            (error instanceof Error ? error.message : "Past sessions could not be imported."),
        })
      }
    } finally {
      if (isCurrent()) setImporting(false)
    }
  }, [loadData])

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

  if (kg.isLoading) return <AccessState kind="loading" />
  if (!kg.isEntitled) return <AccessState kind="locked" />
  if (!kg.serviceAvailable) return <AccessState kind="unavailable" />
  if (!kg.isSubscribed) return <AccessState kind="paused" />

  const lastUpdated = formatDate(stats?.last_updated_at)
  const visibleNodes = filteredGraph?.nodes.length ?? 0

  return (
    <main className="mx-auto min-h-[calc(100vh-3.5rem)] max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
      <header className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
            <Sparkles className="h-3.5 w-3.5" /> Your second brain
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">
            Knowledge
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Explore the entities, relationships, and source evidence accumulated from the decks you chose to connect.
          </p>
          {lastUpdated && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400">
              <Clock3 className="h-3.5 w-3.5" /> Last updated {lastUpdated}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={runImport} disabled={importing}>
            {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Import className="mr-2 h-4 w-4" />}
            {importing ? "Importing…" : "Import past sessions"}
          </Button>
          <Button asChild variant="ghost" size="icon">
            <Link href="/settings/knowledge-graph" aria-label="Knowledge Graph settings" title="Knowledge settings">
              <Settings className="h-4 w-4" />
            </Link>
          </Button>
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
          <span>{importNotice.text}</span>
          {!importing && (
            <button type="button" onClick={() => setImportNotice(null)} className="rounded p-0.5 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current" aria-label="Dismiss import message">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <section className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Knowledge graph summary">
        {dataLoading && !stats ? (
          <><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /><MetricSkeleton /></>
        ) : (
          <>
            <MetricCard icon={Database} label="Entities" value={stats?.node_count ?? 0} detail="Facts, people, products and ideas" accent="bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:ring-blue-900" />
            <MetricCard icon={GitBranch} label="Relations" value={stats?.edge_count ?? 0} detail="Connections across your knowledge" accent="bg-violet-50 text-violet-600 ring-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:ring-violet-900" />
            <MetricCard icon={FileText} label="Evidence" value={stats?.evidence_count ?? 0} detail="Source-backed supporting snippets" accent="bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-900" />
            <MetricCard icon={Layers3} label="Sessions" value={stats?.sessions_consolidated ?? 0} detail="Deck sessions contributing knowledge" accent="bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900" />
          </>
        )}
      </section>

      {loadError && (
        <section className="mb-4 flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center dark:border-amber-900/60 dark:bg-amber-950/30">
          <div className="flex gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Knowledge could not be loaded</p>
              <p className="mt-0.5 text-sm text-amber-700 dark:text-amber-300">{loadError}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadData()}>
            <RefreshCw className="mr-2 h-4 w-4" /> Retry
          </Button>
        </section>
      )}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
          <div className="border-b border-slate-200 p-4 dark:border-slate-800">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-slate-950 dark:text-white">
                  <Network className="h-4 w-4 text-violet-500" /> Knowledge map
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {graph
                    ? `Showing ${formatNumber(visibleNodes)} of ${formatNumber(graph.total_nodes)} entities`
                    : "Loading the most reinforced entities…"}
                </p>
              </div>

              <div className="relative w-full lg:max-w-sm">
                <form
                  onSubmit={(event) => { event.preventDefault(); void runSearch() }}
                  className="flex gap-2"
                  role="search"
                >
                  <div className="relative min-w-0 flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
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
                        onClick={() => { setSearchQuery(""); clearSearchResults() }}
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
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    {searchError && <p className="px-3 py-3 text-sm text-amber-700 dark:text-amber-300">{searchError}</p>}
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
            </div>

            {stats && stats.nodes_by_type.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Filter entities by type">
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
            )}
          </div>

          <div className="p-2 sm:p-3">
            {dataLoading && !graph && (
              <div className="flex min-h-[520px] items-center justify-center rounded-2xl bg-[#070b18]">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-violet-400/30 border-t-violet-400" />
                  <p className="mt-3 text-sm text-slate-400">Mapping your knowledge…</p>
                </div>
              </div>
            )}

            {!dataLoading && graph && graph.nodes.length === 0 && !loadError && (
              <div className="flex min-h-[520px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center">
                <div className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4 text-violet-300">
                  <Brain className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-white">Your graph is ready to grow</h3>
                <p className="mt-2 max-w-md text-sm leading-6 text-slate-400">
                  Build a deck with Knowledge enabled, or import eligible past sessions to create your first entities and connections.
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Button onClick={runImport} disabled={importing}><Import className="mr-2 h-4 w-4" /> Import past sessions</Button>
                  <Button asChild variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white"><Link href="/builder">Build a deck</Link></Button>
                </div>
              </div>
            )}

            {filteredGraph && filteredGraph.nodes.length > 0 && (
              <KgGraphView
                nodes={filteredGraph.nodes}
                edges={filteredGraph.edges}
                selectedId={selectedId}
                onSelect={setSelectedId}
              />
            )}

            {graph && graph.nodes.length > 0 && filteredGraph?.nodes.length === 0 && (
              <div className="flex min-h-[430px] flex-col items-center justify-center rounded-2xl bg-[#070b18] px-6 text-center sm:min-h-[520px]">
                <Network className="h-8 w-8 text-slate-500" />
                <p className="mt-3 text-sm font-medium text-slate-200">All entity types are hidden</p>
                <button type="button" onClick={() => setHiddenTypes(new Set())} className="mt-2 text-sm text-violet-300 hover:text-violet-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">Show the full graph</button>
              </div>
            )}
          </div>
        </section>

        <Inspector
          selected={selected}
          loading={selectedLoading}
          error={selectedError}
          topEntities={stats?.top_entities ?? []}
          onSelect={setSelectedId}
        />
      </div>
    </main>
  )
}
