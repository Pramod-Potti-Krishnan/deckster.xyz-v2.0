/**
 * Second Brain (Knowledge page) fixes from the J6 pass-2 findings (card PASS2-J6-FINDINGS, KNOWLEDGE-2 run 0109439e).
 *
 * Every use is gated in app/(app)/knowledge/page.tsx by NEXT_PUBLIC_STUDIO_KNOWLEDGE_FIXES (exact "true", default off). With the flag off
 * none of this runs and the page is byte-for-byte what it was. This module is pure: no React, no requests. The only side effects are
 * `console.warn` (technical detail goes to the console, never to the person) and the per-browser import marker.
 *
 *  S6  normalizeKgStats / normalizeKgGraph: a response that lacks `nodes_by_type`, `top_entities`, `nodes` or `edges` is treated as empty
 *      instead of throwing while the page renders.
 *  S2  isNetworkFailure / plainKnowledgeError: the browser's "Failed to fetch" never reaches the person.
 *  S3  importFailureText: the backend's error string is logged, the person sees one fixed sentence.
 *  S1  import marker: a per-viewer localStorage marker written when an import starts, refreshed after every batch, removed when the
 *      import finishes in the tab that ran it. There is no import status endpoint (the backfill route is the only import API and it is
 *      cursor-driven from the browser), so a reload or a second tab can only learn "an import was started and never reported finishing".
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

// ---------------------------------------------------------------------------------------------------------------------------------
// Import marker (per browser, per account, cleared when the import finishes in the tab that ran it)
// ---------------------------------------------------------------------------------------------------------------------------------

export const IMPORT_MARKER_PREFIX = "deckster:knowledge:import-marker:v1:"
/** The longest a single dispatched batch can keep running server-side is the route's maxDuration (300 s); this leaves room on top. */
export const IMPORT_FRESH_MS = 10 * 60 * 1000
export const IMPORT_MARKER_MAX_AGE_MS = 24 * 60 * 60 * 1000

export interface ImportMarker { v: 1; startedAt: number; activeAt: number }
export type ImportMarkerState = "running" | "interrupted"

/** The storage key carries a hash of the account key, never the key itself (it can be an email address). */
export function ownerTag(accountKey: string): string {
  let hash = 0x811c9dc5
  for (let index = 0; index < accountKey.length; index++) {
    hash ^= accountKey.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage
  } catch {
    return null
  }
}

export function readImportMarker(owner: string, now: number = Date.now(), store: Storage | null = browserStorage()): ImportMarker | null {
  if (!store) return null
  try {
    const key = IMPORT_MARKER_PREFIX + owner
    const raw = store.getItem(key)
    if (!raw) return null
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
    if (!isRecord(parsed) || parsed.v !== 1 || typeof parsed.startedAt !== "number" || typeof parsed.activeAt !== "number") {
      store.removeItem(key)
      return null
    }
    if (now - parsed.activeAt > IMPORT_MARKER_MAX_AGE_MS) {
      store.removeItem(key)
      return null
    }
    return { v: 1, startedAt: parsed.startedAt, activeAt: parsed.activeAt }
  } catch {
    return null
  }
}

/** Marks an import as started (or, with `startedAt` kept, as still active). Storage that is full, blocked or missing is ignored. */
export function writeImportMarker(owner: string, startedAt: number, now: number = Date.now(), store: Storage | null = browserStorage()): void {
  if (!store) return
  try {
    const marker: ImportMarker = { v: 1, startedAt, activeAt: now }
    store.setItem(IMPORT_MARKER_PREFIX + owner, JSON.stringify(marker))
  } catch {
    // no usable storage: the reload case simply stays as it was
  }
}

/** Refreshes `activeAt` of the marker THIS import wrote (same `startedAt`); never resurrects a cleared marker or overwrites another import's. */
export function touchImportMarker(owner: string, startedAt: number, now: number = Date.now(), store: Storage | null = browserStorage()): void {
  const marker = readImportMarker(owner, now, store)
  if (marker && marker.startedAt === startedAt) writeImportMarker(owner, startedAt, now, store)
}

/** Removes the marker. With `startedAt`, only if it is still the one that import wrote (another tab may have started a newer import). */
export function clearImportMarker(owner: string, startedAt?: number, store: Storage | null = browserStorage()): void {
  if (!store) return
  try {
    if (startedAt !== undefined) {
      const marker = readImportMarker(owner, Date.now(), store)
      if (marker && marker.startedAt !== startedAt) return
    }
    store.removeItem(IMPORT_MARKER_PREFIX + owner)
  } catch {
    // ignore
  }
}

export function importMarkerState(marker: ImportMarker, now: number = Date.now()): ImportMarkerState {
  return now - marker.activeAt <= IMPORT_FRESH_MS ? "running" : "interrupted"
}

const clock = (at: number): string => {
  try {
    return new Date(at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
  } catch {
    return ""
  }
}

/** What the page says when it finds a marker it did not write in this tab's own running import (after a reload, or in a second tab). */
export function resumedImportNotice(marker: ImportMarker, now: number = Date.now()): { kind: "resumed" | "interrupted"; text: string } {
  if (importMarkerState(marker, now) === "running") {
    return {
      kind: "resumed",
      text: `An import may still be running. It was started at ${clock(marker.startedAt)} and can take a few minutes to finish. Refresh in a few minutes to see what it added.`,
    }
  }
  return {
    kind: "interrupted",
    text: "An earlier import stopped before it finished, because the page was closed or reloaded. Sessions it already added are kept. Run Import past sessions again to continue; sessions already in your graph are skipped.",
  }
}

/** The line the confirm dialog adds when another import may still be running. null when there is nothing to warn about. */
