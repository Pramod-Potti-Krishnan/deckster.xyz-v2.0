/**
 * Second Brain (Knowledge page) fixes from the J6 pass-2 findings (card PASS2-J6-FINDINGS, KNOWLEDGE-2 run 0109439e).
 *
 * Every use is gated in app/(app)/knowledge/page.tsx by NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES (exact "true", default off). With the flag off
 * none of this runs and the page is byte-for-byte what it was. This module is pure: no React, no requests. The only side effects are
 * `console.warn` (technical detail goes to the console, never to the person).
 *
 *  S6  normalizeKgStats / normalizeKgGraph: a response that lacks `nodes_by_type`, `top_entities`, `nodes` or `edges` is treated as empty
 *      instead of throwing while the page renders.
 *  S2  isNetworkFailure / plainKnowledgeError: the browser's "Failed to fetch" never reaches the person.
 *  S3  importFailureText: the backend's error string is logged, the person sees one fixed sentence.
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Plain-words errors
// ---------------------------------------------------------------------------------------------------------------------------------

export const OFFLINE_TEXT = "You seem to be offline, or Deckster can't be reached right now. Check your connection and try again."
export const OFFLINE_IMPORT_TEXT =
  "You seem to be offline, so Deckster couldn't confirm the import finished. Check your connection and try again. Sessions already imported are skipped."
export const IMPORT_FAILED_TEXT = "The import could not be completed. Please try again in a moment."
export const IMPORT_UNAVAILABLE_TEXT = "Knowledge is temporarily unavailable, so the import could not continue. Please try again in a moment."

// Compared by name, not by class, so the check holds across realms (iframes, test sandboxes).
const NETWORK_MESSAGE = /failed to fetch|networkerror|load failed|network request failed|fetch failed|network connection was lost|internet connection appears to be offline/i

/** A request that never got an answer. The browser rejects fetch() with a TypeError whose message is engine specific ("Failed to fetch", "Load failed", ...). */
export function isNetworkFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false
  const { name, message } = error as { name?: unknown; message?: unknown }
  return name === "TypeError" && typeof message === "string" && NETWORK_MESSAGE.test(message)
}

/**
 * The sentence a person sees for a failed request. Our own plain sentences (thrown as `new Error(sentence)` by the page) pass through.
 * A network failure becomes `offline`. Anything else (a JSON parse error, a programming error, a DOMException) becomes `fallback`.
 * The original error always goes to the console.
 */
export function plainKnowledgeError(error: unknown, fallback: string, offline: string = OFFLINE_TEXT): string {
  if (isNetworkFailure(error)) {
    console.warn("[knowledge] request failed (network)", error)
    return offline
  }
  const own = typeof error === "object" && error !== null && (error as { name?: unknown }).name === "Error"
  const message = own ? (error as { message?: unknown }).message : undefined
  if (typeof message === "string" && message) return message
  console.warn("[knowledge] request failed", error)
  return fallback
}

/** One fixed sentence for a failed import batch; the backend's own error string stays in the console. */
export function importFailureText(status: number, detail: unknown): string {
  console.warn("[knowledge] import batch failed", status, detail)
  return status === 503 ? IMPORT_UNAVAILABLE_TEXT : IMPORT_FAILED_TEXT
}
