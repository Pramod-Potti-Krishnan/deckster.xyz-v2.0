/**
 * Second Brain (Knowledge page) fixes from the J6 pass-2 findings (card PASS2-J6-FINDINGS, KNOWLEDGE-2 run 0109439e).
 *
 * Every use is gated in app/(app)/knowledge/page.tsx by NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES (exact "true", default off). With the flag off
 * none of this runs and the page is byte-for-byte what it was. This module is pure: no React, no requests. The only side effects are
 * `console.warn` (technical detail goes to the console, never to the person) and the per-browser import marker below.
 *
 *  S6  normalizeKgStats / normalizeKgGraph: a response that lacks `nodes_by_type`, `top_entities`, `nodes` or `edges` is treated as empty
 *      instead of throwing while the page renders.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

/** Treat missing arrays in the stats response as empty. Returns the SAME object when nothing needed fixing (the page compares snapshots by identity). */
export function normalizeKgStats<T>(raw: T): T | null {
  if (!isRecord(raw)) return null
  const byType = Array.isArray(raw.nodes_by_type)
    ? raw.nodes_by_type.filter(item => isRecord(item) && typeof item.entity_type === "string" && item.entity_type !== "")
    : []
  const top = Array.isArray(raw.top_entities)
    ? raw.top_entities.filter(item => isRecord(item) && typeof item.node_id === "string" && typeof item.name === "string" && typeof item.entity_type === "string")
    : []
  if (Array.isArray(raw.nodes_by_type) && byType.length === raw.nodes_by_type.length &&
    Array.isArray(raw.top_entities) && top.length === raw.top_entities.length) return raw as T
  return { ...raw, nodes_by_type: byType, top_entities: top } as T
}

/** Treat a missing node or edge list in the graph response as empty. null when the response is not an object at all. */
export function normalizeKgGraph<T>(raw: T): T | null {
  if (!isRecord(raw)) return null
  const nodes = Array.isArray(raw.nodes) ? raw.nodes.filter(item => isRecord(item) && typeof item.node_id === "string") : []
  const edges = Array.isArray(raw.edges)
    ? raw.edges.filter(item => isRecord(item) && typeof item.src_node_id === "string" && typeof item.dst_node_id === "string")
    : []
  if (Array.isArray(raw.nodes) && nodes.length === raw.nodes.length &&
    Array.isArray(raw.edges) && edges.length === raw.edges.length && typeof raw.total_nodes === "number") return raw as T
  return { ...raw, nodes, edges, total_nodes: typeof raw.total_nodes === "number" ? raw.total_nodes : nodes.length } as T
}
