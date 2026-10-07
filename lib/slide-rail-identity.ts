/**
 * Studio slide rail keyed by slide identity (F8 / S-03, frontend half).
 *
 * Behind NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED (exact 'true', default off).
 *
 * Source of truth is Layout's slide inventory (backend flag LAYOUT_SLIDE_THUMBNAILS_ENABLED):
 *   GET {layout}/api/presentations/{presentation_id}/slides/inventory
 * Identity = slide_id, order = array position, count = slide_count. A preview is shown only
 * where `thumbnail_url` is non-null (the backend nulls it when the slide changed since the
 * capture). This module is pure: no React, no storage side effects, no model or image calls.
 *
 * Feature detection: a 404/405 (route absent, backend flag off) or a body that is not a valid
 * inventory means "unavailable" and the rail keeps today's behaviour. A failed read keeps the
 * last good inventory. The rail is never broken by this module.
 */

export const STUDIO_RAIL_SLIDE_IDENTITY_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_RAIL_SLIDE_IDENTITY_ENABLED === 'true'

export interface SlideInventoryRow {
  slideId: string
  slideIndex: number
  layout: string | null
  contentVersion: string | null
  /** Non-null only while the preview matches the slide's current content. */
  thumbnailUrl: string | null
  thumbnailStale: boolean
  /** Optional additive field (not in contract v1): used when the backend sends it. */
  title: string | null
}

export interface SlideInventory {
  presentationId: string
  slideCount: number
  slides: SlideInventoryRow[]
}

/** Same shape as SlideThumbnail in components/slide-thumbnail-strip.tsx. */
export interface SlideRailRow {
  slideNumber: number
  slideId: string
  slideIndex: number
  actualSlideIndex: number
  title: string
  thumbnailUrl?: string
}

const MAX_URL_LENGTH = 8192
const MAX_TITLE_LENGTH = 200
const MAX_SLIDE_ID_LENGTH = 100
const MAX_REMEMBERED_TITLES = 500

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function validSlideId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SLIDE_ID_LENGTH && value === value.trim()
}

function safeThumbnailUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_URL_LENGTH) return null
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? trimmed : null
  } catch {
    return null
  }
}

function cleanTitle(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH) return null
  // The rail already renders "Slide N" for a missing title; never remember that label.
  return /^Slide \d+$/i.test(trimmed) ? null : trimmed
}

/**
 * Validates the inventory body. Returns null (treated as "unavailable") for anything that is
 * not an identity-bearing, ordered inventory of this exact presentation.
 */
export function parseSlideInventory(body: unknown, expectedPresentationId: string): SlideInventory | null {
  if (!record(body) || body.presentation_id !== expectedPresentationId) return null
  const slides = body.slides
  if (!Array.isArray(slides) || !Number.isSafeInteger(body.slide_count) || body.slide_count !== slides.length) return null
  const seen = new Set<string>()
  const rows: SlideInventoryRow[] = []
  for (let position = 0; position < slides.length; position += 1) {
    const slide = slides[position]
    if (!record(slide) || !validSlideId(slide.slide_id) || seen.has(slide.slide_id)) return null
    if (slide.slide_index !== undefined && slide.slide_index !== position) return null
    seen.add(slide.slide_id)
    rows.push({
      slideId: slide.slide_id,
      slideIndex: position,
      layout: typeof slide.layout === 'string' ? slide.layout : null,
      contentVersion: typeof slide.content_version === 'string' ? slide.content_version : null,
      thumbnailUrl: slide.thumbnail_stale === true ? null : safeThumbnailUrl(slide.thumbnail_url),
      thumbnailStale: slide.thumbnail_stale === true,
      title: cleanTitle(slide.title),
    })
  }
  return { presentationId: expectedPresentationId, slideCount: rows.length, slides: rows }
}

export type SlideInventoryResult =
  | { kind: 'ok'; inventory: SlideInventory }
  | { kind: 'unavailable'; reason: string }
  | { kind: 'failed'; reason: string }

/**
 * One inventory read. `unavailable` = the contract is not served here (route absent or an
 * invalid body); `failed` = a transient problem (network, timeout, 5xx, auth).
 */
export async function fetchSlideInventory({
  baseUrl,
  presentationId,
  fetchImpl,
  signal,
}: {
  baseUrl: string
  presentationId: string
  fetchImpl: typeof fetch
  signal?: AbortSignal
}): Promise<SlideInventoryResult> {
  let response: Response
  try {
    response = await fetchImpl(
      `${baseUrl.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(presentationId)}/slides/inventory`,
      { cache: 'no-store', signal },
    )
  } catch (error) {
    return { kind: 'failed', reason: error instanceof Error ? error.name : 'network' }
  }
  if (response.status === 404 || response.status === 405) return { kind: 'unavailable', reason: `http_${response.status}` }
  if (!response.ok) return { kind: 'failed', reason: `http_${response.status}` }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { kind: 'unavailable', reason: 'invalid_json' }
  }
  const inventory = parseSlideInventory(body, presentationId)
  return inventory ? { kind: 'ok', inventory } : { kind: 'unavailable', reason: 'invalid_inventory' }
}

export interface SlideInventoryState {
  status: 'idle' | 'loading' | 'ready' | 'unavailable'
  inventory: SlideInventory | null
}

/**
 * Coalescing reader for one presentation. refresh() is debounced (refresh(true) is not); a refresh
 * requested while a read is in flight runs once more straight after it, so an ack that lands
 * mid-read is never lost. 404/405 or an invalid body is remembered for `unavailableTtlMs` (the endpoint is
 * absent, no need to ask on every frame); a transient failure keeps the last good inventory.
 */
export function createSlideInventoryController({
  presentationId,
  getBaseUrl,
  fetchImpl,
  onChange,
  now = Date.now,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
  debounceMs = 150,
  unavailableTtlMs = 60_000,
  timeoutMs = 8_000,
}: {
  presentationId: string
  getBaseUrl: () => string
  fetchImpl: typeof fetch
  onChange: (state: SlideInventoryState) => void
  now?: () => number
  setTimer?: (fn: () => void, ms: number) => unknown
  clearTimer?: (handle: unknown) => void
  debounceMs?: number
  unavailableTtlMs?: number
  timeoutMs?: number
}) {
  let state: SlideInventoryState = { status: 'idle', inventory: null }
  let disposed = false
  let inFlight = false
  let dirty = false
  let debounceHandle: unknown = null
  let abort: AbortController | null = null
  let unavailableUntil = 0

  const publish = (next: SlideInventoryState) => {
    if (next.status === state.status && next.inventory === state.inventory) return
    state = next
    if (!disposed) onChange(state)
  }

  const run = async () => {
    if (disposed) return
    if (inFlight) { dirty = true; return }
    if (state.status === 'unavailable' && now() < unavailableUntil) return
    let baseUrl: string
    try { baseUrl = getBaseUrl() } catch {
      unavailableUntil = now() + unavailableTtlMs
      publish({ status: 'unavailable', inventory: null })
      return
    }
    inFlight = true
    dirty = false
    abort = typeof AbortController === 'function' ? new AbortController() : null
    const timer = abort ? setTimer(() => abort?.abort(), timeoutMs) : null
    if (state.status === 'idle') publish({ status: 'loading', inventory: null })
    let result: SlideInventoryResult
    try {
      result = await fetchSlideInventory({ baseUrl, presentationId, fetchImpl, signal: abort?.signal })
    } finally {
      if (timer !== null) clearTimer(timer)
      abort = null
      inFlight = false
    }
    if (disposed) return
    if (result.kind === 'ok') publish({ status: 'ready', inventory: result.inventory })
    else if (result.kind === 'unavailable') {
      unavailableUntil = now() + unavailableTtlMs
      publish({ status: 'unavailable', inventory: null })
    } else if (state.status === 'loading') publish({ status: 'idle', inventory: null })
    // A transient failure on an already-ready (or unavailable) rail changes nothing.
    if (dirty) { dirty = false; void run() }
  }

  return {
    getState: () => state,
    /** Debounced by default (bursts of frames/counts); `immediate` is for a structural ack,
     *  whose server state is already final, so the rail should not wait. */
    refresh(immediate = false) {
      if (disposed) return
      if (debounceHandle !== null) clearTimer(debounceHandle)
      debounceHandle = null
      if (immediate) { void run(); return }
      debounceHandle = setTimer(() => { debounceHandle = null; void run() }, debounceMs)
    },
    dispose() {
      disposed = true
      if (debounceHandle !== null) clearTimer(debounceHandle)
      debounceHandle = null
      abort?.abort()
    },
  }
}

/** A remembered title per slide_id. Immutable use: functions return a new Map when changed. */
export type RailTitleMemory = ReadonlyMap<string, string>

function sameMemory(a: RailTitleMemory, b: RailTitleMemory): boolean {
  if (a.size !== b.size) return false
  for (const [id, title] of a) if (b.get(id) !== title) return false
  return true
}

/**
 * Titles are not part of inventory v1 (contract gap), so the rail remembers them by slide_id.
 * Learning is allowed only from a structure that is positionally aligned with Layout: the
 * caller passes `structureSlides` ONLY when no native CRUD has touched the deck since that
 * structure arrived, and its length must equal the inventory's (the same trust today's rich
 * path applies). Entries for slides no longer in the deck are dropped.
 */
export function learnRailTitles(
  previous: RailTitleMemory,
  inventory: SlideInventory,
  structureSlides: ReadonlyArray<unknown> | null,
): RailTitleMemory {
  const next = new Map<string, string>()
  for (const row of inventory.slides) {
    const remembered = previous.get(row.slideId)
    if (remembered) next.set(row.slideId, remembered)
  }
  if (structureSlides && structureSlides.length === inventory.slideCount) {
    inventory.slides.forEach((row, position) => {
      const slide = structureSlides[position]
      if (!record(slide)) return
      const title = cleanTitle(slide.title) ?? cleanTitle(slide.slide_type)
      if (title) next.set(row.slideId, title)
    })
  }
  return sameMemory(previous, next) ? previous : next
}

/** Rail rows in inventory order. The row title is the backend's, else remembered, else "Slide N". */
export function buildRailRows(inventory: SlideInventory, titles: RailTitleMemory): SlideRailRow[] {
  return inventory.slides.map((row, position) => ({
    slideNumber: position + 1,
    slideId: row.slideId,
    slideIndex: position,
    actualSlideIndex: position,
    title: row.title ?? titles.get(row.slideId) ?? `Slide ${position + 1}`,
    ...(row.thumbnailUrl ? { thumbnailUrl: row.thumbnailUrl } : {}),
  }))
}

// ---- optional per-tab title memory (sessionStorage; same 24 h TTL as the preview cache) ----

export const RAIL_TITLES_CACHE_VERSION = 1
export const RAIL_TITLES_CACHE_TTL = 24 * 60 * 60 * 1000

function clean(value: unknown): string | null {
  return typeof value === 'string' && value.trim() === value && value.length > 0 ? value : null
}

export function railTitlesStorageKey(ownerUserId: unknown, presentationId: unknown): string | null {
  const owner = clean(ownerUserId)
  const presentation = clean(presentationId)
  if (!owner || !presentation) return null
  return `deckster_rail_titles_v1_${encodeURIComponent(owner)}:${encodeURIComponent(presentation)}`
}

export function serializeRailTitles(
  titles: RailTitleMemory,
  ownerUserId: string,
  presentationId: string,
  now = Date.now(),
): string | null {
  if (!railTitlesStorageKey(ownerUserId, presentationId) || titles.size === 0 || !Number.isFinite(now) || now < 0) return null
  const entries = Array.from(titles).slice(0, MAX_REMEMBERED_TITLES)
  return JSON.stringify({
    version: RAIL_TITLES_CACHE_VERSION, ownerUserId, presentationId, savedAt: now,
    titles: Object.fromEntries(entries),
  })
}

export function restoreRailTitles(
  raw: string | null,
  ownerUserId: string,
  presentationId: string,
  now = Date.now(),
): RailTitleMemory {
  const empty = new Map<string, string>()
  if (!raw || !railTitlesStorageKey(ownerUserId, presentationId)) return empty
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return empty }
  if (!record(parsed) || parsed.version !== RAIL_TITLES_CACHE_VERSION
    || parsed.ownerUserId !== ownerUserId || parsed.presentationId !== presentationId
    || typeof parsed.savedAt !== 'number' || !Number.isFinite(parsed.savedAt)
    || parsed.savedAt < 0 || now < parsed.savedAt || now - parsed.savedAt > RAIL_TITLES_CACHE_TTL
    || !record(parsed.titles)) return empty
  const restored = new Map<string, string>()
  for (const [id, title] of Object.entries(parsed.titles)) {
    if (restored.size >= MAX_REMEMBERED_TITLES) break
    const cleaned = cleanTitle(title)
    if (validSlideId(id) && cleaned) restored.set(id, cleaned)
  }
  return restored
}
