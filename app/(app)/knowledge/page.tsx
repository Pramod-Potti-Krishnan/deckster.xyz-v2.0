"use client"

/**
 * KG v2 P3 — the Knowledge page (D-KG4: dedicated surface, not settings).
 *
 * Shows the user's cross-session knowledge graph: header stats, an
 * interactive top-100 graph view, entity search, node inspector with
 * own-document evidence, and the "Import my past sessions" backfill action.
 * Subscribe/pause/purge stay on the settings page (linked).
 */

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useKnowledgeGraph } from "@/hooks/use-knowledge-graph"
import { KgGraphView, typeColor } from "@/components/knowledge/kg-graph-view"
import type { KgViewEdge, KgViewNode } from "@/components/knowledge/kg-graph-view"
import { Button } from "@/components/ui/button"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Brain, FileText, Import, Lock, Search, Settings } from "lucide-react"

export const dynamic = "force-dynamic"

interface KgStats {
  node_count: number
  edge_count: number
  evidence_count: number
  sessions_consolidated: number
  nodes_by_type: Array<{ entity_type: string; count: number }>
  top_entities: Array<{ node_id: string; name: string; entity_type: string; salience: number }>
  last_updated_at: string | null
}

interface KgNodeDetail {
  node: KgViewNode
  evidence: Array<{
    snippet: string
    source_type: string | null
    session_id: string
    document_filename: string | null
    page_number: number | null
  }>
  provenance_session_ids: string[]
  edges: Array<{ src_name: string; dst_name: string; relation: string; weight: number }>
}

export default function KnowledgePage() {
  const kg = useKnowledgeGraph()
  const [stats, setStats] = useState<KgStats | null>(null)
  const [graph, setGraph] = useState<{ nodes: KgViewNode[]; edges: KgViewEdge[]; total_nodes: number } | null>(null)
  const [selected, setSelected] = useState<KgNodeDetail | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchHits, setSearchHits] = useState<KgViewNode[] | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    setLoadError(null)
    try {
      const [statsResp, graphResp] = await Promise.all([
        fetch("/api/knowledge-graph/stats"),
        fetch("/api/knowledge-graph/graph?limit=100"),
      ])
      if (statsResp.ok) setStats(await statsResp.json())
      else if (statsResp.status === 503) {
        setLoadError("The Knowledge Graph backend is not activated yet.")
        return
      }
      if (graphResp.ok) setGraph(await graphResp.json())
    } catch {
      setLoadError("Couldn't reach the knowledge graph service.")
    }
  }, [])

  useEffect(() => {
    if (kg.isEntitled && kg.isSubscribed) loadData()
  }, [kg.isEntitled, kg.isSubscribed, loadData])

  const selectNode = useCallback(async (nodeId: string) => {
    try {
      const resp = await fetch(`/api/knowledge-graph/nodes/${nodeId}`)
      if (resp.ok) setSelected(await resp.json())
    } catch {
      // best-effort — leave previous selection
    }
  }, [])

  const runSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchHits(null)
      return
    }
    try {
      const resp = await fetch("/api/knowledge-graph/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery.trim(), max_nodes: 10 }),
      })
      if (resp.ok) {
        const body = await resp.json()
        setSearchHits(body.nodes ?? [])
      }
    } catch {
      setSearchHits([])
    }
  }, [searchQuery])

  const runImport = useCallback(async () => {
    setImporting(true)
    setImportResult(null)
    try {
      const resp = await fetch("/api/knowledge-graph/backfill", { method: "POST" })
      const body = await resp.json()
      if (!resp.ok) {
        setImportResult(body.error || "Import failed.")
      } else if (body.no_sessions_found) {
        setImportResult("No past sessions with uploads or research were found.")
      } else {
        setImportResult(
          `Imported ${body.sessions_processed} session${body.sessions_processed === 1 ? "" : "s"} — ` +
          `${body.entities_created} new entities, ${body.entities_merged} reinforced` +
          (body.sessions_already_consolidated
            ? ` (${body.sessions_already_consolidated} already in your graph).`
            : ".")
        )
        await loadData()
      }
    } catch {
      setImportResult("Import failed — service unreachable.")
    } finally {
      setImporting(false)
    }
  }, [loadData])

  // ── Gating states ──────────────────────────────────────────────────────
  if (!kg.isLoading && !kg.isEntitled) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> Knowledge
          </CardTitle>
          <CardDescription>Your accumulated knowledge across every deck you build</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-full bg-slate-100 p-4 dark:bg-slate-800">
              <Lock className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="max-w-md text-sm text-muted-foreground">
              The Knowledge Graph is available on Pro plans and above. Every deck you build
              teaches Deckster your world — entities, numbers, and relationships from your
              documents become reusable, citable knowledge.
            </p>
            <Button asChild><Link href="/pricing">View Plans</Link></Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!kg.isLoading && kg.isEntitled && !kg.isSubscribed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" /> Knowledge
          </CardTitle>
          <CardDescription>Your accumulated knowledge across every deck you build</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <Brain className="h-10 w-10 text-muted-foreground" />
            <p className="max-w-md text-sm text-muted-foreground">
              Turn on the Knowledge Graph and every deck you build starts teaching Deckster
              your world. Facts from your uploads become citable sources in future decks —
              and you can watch your graph grow right here.
            </p>
            <Button asChild>
              <Link href="/settings/knowledge-graph">
                <Settings className="mr-2 h-4 w-4" /> Enable in Settings
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const listedEntities = searchHits ?? stats?.top_entities ?? []

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5" /> Knowledge
            </CardTitle>
            <CardDescription>
              {stats
                ? `${stats.node_count} entities · ${stats.edge_count} relations · ` +
                  `${stats.evidence_count} evidence snippets · from ${stats.sessions_consolidated} session${stats.sessions_consolidated === 1 ? "" : "s"}`
                : "Loading your knowledge graph…"}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={runImport} disabled={importing}>
              <Import className="mr-2 h-4 w-4" />
              {importing ? "Importing…" : "Import my past sessions"}
            </Button>
            <Button asChild variant="ghost" size="sm">
              <Link href="/settings/knowledge-graph"><Settings className="h-4 w-4" /></Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loadError && <p className="text-sm text-amber-600">{loadError}</p>}
          {importResult && <p className="text-sm text-green-600">{importResult}</p>}

          {stats && stats.node_count === 0 && !loadError && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <p className="max-w-md text-sm text-muted-foreground">
                Your graph is empty so far. Build a deck with the Knowledge Graph toggle on —
                or import your past sessions — and watch it fill up.
              </p>
            </div>
          )}

          {graph && graph.nodes.length > 0 && (
            <>
              <KgGraphView
                nodes={graph.nodes}
                edges={graph.edges}
                selectedId={selected?.node.node_id}
                onSelect={selectNode}
              />
              {graph.total_nodes > graph.nodes.length && (
                <p className="text-xs text-muted-foreground">
                  Showing the {graph.nodes.length} most-reinforced of {graph.total_nodes} entities.
                </p>
              )}
            </>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            {/* Entity search + list */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Search your knowledge…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && runSearch()}
                />
                <Button variant="outline" size="icon" onClick={runSearch} aria-label="Search">
                  <Search className="h-4 w-4" />
                </Button>
              </div>
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 dark:divide-slate-800 dark:border-slate-800">
                {listedEntities.length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">
                    {searchHits !== null ? "No matches in your graph." : "No entities yet."}
                  </li>
                )}
                {listedEntities.map((n) => (
                  <li key={n.node_id}>
                    <button
                      type="button"
                      onClick={() => selectNode(n.node_id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-slate-900"
                    >
                      <span
                        className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: typeColor(n.entity_type) }}
                      />
                      <span className="truncate font-medium">{n.name}</span>
                      <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                        {n.entity_type}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {/* Node inspector */}
            <div className="rounded-lg border border-gray-200 p-3 dark:border-slate-800">
              {!selected ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Select an entity to see what Deckster knows about it — and where that
                  knowledge came from.
                </p>
              ) : (
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-3 w-3 rounded-full"
                        style={{ backgroundColor: typeColor(selected.node.entity_type) }}
                      />
                      <h3 className="font-semibold">{selected.node.name}</h3>
                      <span className="text-xs text-muted-foreground">{selected.node.entity_type}</span>
                    </div>
                    {selected.node.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{selected.node.description}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Seen {selected.node.mention_count}× across {selected.provenance_session_ids.length} session{selected.provenance_session_ids.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {selected.edges.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Relations</p>
                      {selected.edges.slice(0, 6).map((e, i) => (
                        <p key={i} className="text-sm">
                          {e.src_name} <span className="text-muted-foreground">→ {e.relation.replace(/_/g, " ")} →</span> {e.dst_name}
                        </p>
                      ))}
                    </div>
                  )}
                  {selected.evidence.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</p>
                      {selected.evidence.slice(0, 4).map((ev, i) => (
                        <blockquote key={i} className="border-l-2 border-gray-200 pl-2 text-sm dark:border-slate-700">
                          “{ev.snippet.length > 180 ? `${ev.snippet.slice(0, 179)}…` : ev.snippet}”
                          {ev.document_filename && (
                            <span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              {ev.document_filename}
                              {ev.page_number != null ? `, p.${ev.page_number}` : ""}
                            </span>
                          )}
                        </blockquote>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {stats && stats.nodes_by_type.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {stats.nodes_by_type.map((t) => (
                <span
                  key={t.entity_type}
                  className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-0.5 text-xs dark:border-slate-800"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ backgroundColor: typeColor(t.entity_type) }}
                  />
                  {t.entity_type.toLowerCase()} · {t.count}
                </span>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
