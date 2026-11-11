// AUDIT P-29 (production frontend audit, "Slide-strip and Publish preview images"): on production the slide rail says "No preview" on every loaded slide and the Publish dialog says "Deck preview unavailable".
// Flag NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK (exact "true", default off, build-time). Off, the rail, the Publish preview and every inventory reader are byte for byte what they were: nothing in here runs.
//
// ROOT CAUSE. Both read Layout's slide inventory, GET {Layout}/api/presentations/{id}/slides/inventory (lib/slide-rail-identity.ts fetchSlideInventory). Layout serves that route only while its
// LAYOUT_SLIDE_THUMBNAILS_ENABLED is on; production's is off, so the route answers 405 (404 on other builds). lib/slide-rail-identity.ts treats 404/405 as "unavailable": the rail keeps the path that has no preview
// source, and the Publish preview has no image to ask for. The presentation itself reads fine on the same host (GET {Layout}/api/presentations/{id}, 200, the canvas renders).
//
// WHAT THE PRESENTATION GET CAN AND CANNOT GIVE. It carries the slide list (slide_id, layout, title text) but NO preview images: Layout registers images in a separate sidecar store behind the same flag, so with the
// flag off no image exists anywhere to be found. So this cannot make thumbnail IMAGES appear. What it can do, and does:
//   1. RAIL. When the inventory answers 404 or 405, the rail's slide list (ids, order, titles, layouts) is derived from the presentation GET and handed to the rail as an inventory whose every row has status "none"
//      (no preview, none coming). That is the status Layout's own inventory gives a slide with no producer, and it is the one the rail's live-preview fallback (NEXT_PUBLIC_STUDIO_RAIL_LIVE_PREVIEW_FALLBACK_ENABLED,
//      F9-A) already acts on: with that flag on each card draws the slide itself in a view-only frame instead of "No preview". With it off the rail still says "No preview", now with the deck's own slide titles.
//   2. PUBLISH. With no image from any source, the Publish preview shows slide 1 itself in a view-only frame (the same view-only viewer the rail and the deck cards use) when this Layout has the deck.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-audit-previews.mjs transpiles this file into a bare function scope with a fake `process`.

export function inventoryFallbackOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_INVENTORY_FALLBACK_ENABLED = inventoryFallbackOn(process.env.NEXT_PUBLIC_STUDIO_INVENTORY_FALLBACK)

/** The statuses that mean "the inventory route is not served here" (lib/slide-rail-identity.ts reports them as `http_404` / `http_405`). */
export function inventoryRouteAbsent(reason: string | null | undefined): boolean {
  return reason === 'http_404' || reason === 'http_405'
}

const MAX_TITLE_LENGTH = 200
const MAX_SLIDE_ID_LENGTH = 100
// Layout's own placeholder titles (slide_thumbnails.py STOCK_TITLES): a slide that only has one has no title yet.
const STOCK_TITLES = new Set(['slide title', 'presentation title', 'section title', 'diagram title', 'chart title', 'infographic title', 'comparison'])

/** The structural shape lib/slide-rail-identity.ts SlideInventory has (the rail's reader assigns it). */
export interface FallbackInventoryRow {
  slideId: string
  slideIndex: number
  layout: string | null
  contentVersion: string | null
  thumbnailUrl: string | null
  thumbnailStale: boolean
  thumbnailStatus: 'none'
  title: string | null
}
export interface FallbackInventory {
  presentationId: string
  slideCount: number
  slides: FallbackInventoryRow[]
}
export type FallbackInventoryResult = { kind: 'ok'; inventory: FallbackInventory } | { kind: 'unavailable'; reason: string }

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** HTML stripped to plain text, whitespace collapsed (Layout's plain_text). */
function plainText(value: unknown): string {
  if (typeof value !== 'string') return ''
  return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

/** Where a slide's title lives, most current first (Layout's _title_candidates): the structural title text box, then content.slide_title, then content.title. */
function titleCandidates(slide: Record<string, unknown>): unknown[] {
  const out: unknown[] = []
  if (Array.isArray(slide.text_boxes)) {
    for (const box of slide.text_boxes) {
      if (record(box) && box.slot_name === 'title' && (box.slot_kind === 'structural' || box.slot_kind === 'system')) out.push(box.content)
    }
  }
  if (record(slide.content)) out.push(slide.content.slide_title, slide.content.title)
  return out
}

/** The slide's title as plain text, or null (none, a placeholder, "Slide N", or too long). */
export function fallbackSlideTitle(slide: Record<string, unknown>): string | null {
  for (const candidate of titleCandidates(slide)) {
    const text = plainText(candidate)
    if (!text || STOCK_TITLES.has(text.toLowerCase())) continue
    if (text.length > MAX_TITLE_LENGTH || /^Slide \d+$/i.test(text)) return null
    return text
  }
  return null
}

/**
 * The inventory a presentation GET body stands for, or null. The body must be THIS presentation's (its id, when it names one, is the one asked for) with a non-empty slides array in which every slide is an object with
 * its own stable slide_id (a non-empty trimmed string of sane length, unique in the deck): a deck whose slides cannot be told apart by id cannot key the rail, and keeps today's behaviour. Every row is "none": no
 * image, none coming.
 */
export function inventoryFromPresentation(body: unknown, presentationId: string): FallbackInventory | null {
  if (!record(body) || !Array.isArray(body.slides) || body.slides.length === 0) return null
  for (const key of ['id', 'presentation_id']) {
    if (body[key] !== undefined && body[key] !== presentationId) return null
  }
  const seen = new Set<string>()
  const rows: FallbackInventoryRow[] = []
  for (let position = 0; position < body.slides.length; position += 1) {
    const slide = body.slides[position]
    if (!record(slide)) return null
    const id = slide.slide_id
    if (typeof id !== 'string' || !id || id.length > MAX_SLIDE_ID_LENGTH || id !== id.trim() || seen.has(id)) return null
    seen.add(id)
    rows.push({
      slideId: id,
      slideIndex: position,
      layout: typeof slide.layout === 'string' ? slide.layout : null,
      contentVersion: null,
      thumbnailUrl: null,
      thumbnailStale: false,
      thumbnailStatus: 'none',
      title: fallbackSlideTitle(slide),
    })
  }
  return { presentationId, slideCount: rows.length, slides: rows }
}

/** The presentation read (the one the Builder's own recovery makes). */
export function presentationReadUrl(baseUrl: string, presentationId: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/api/presentations/${encodeURIComponent(presentationId)}`
}

/**
 * ONE presentation read, turned into an inventory. Never throws: a failed read, a non-2xx answer, a body that is not JSON or not this presentation's deck is `unavailable` (the caller keeps what it had).
 * `fetchImpl` is the page's fetch; `signal` is the controller's own (its time limit and dispose reach this read too).
 */
export async function readInventoryFallback({
  baseUrl,
  presentationId,
  fetchImpl,
  signal,
}: {
  baseUrl: string
  presentationId: string
  fetchImpl: (input: string, init?: { cache?: 'no-store'; signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>
  signal?: AbortSignal
}): Promise<FallbackInventoryResult> {
  let response: { ok: boolean; status: number; json: () => Promise<unknown> }
  try {
    response = await fetchImpl(presentationReadUrl(baseUrl, presentationId), { cache: 'no-store', signal })
  } catch (error) {
    return { kind: 'unavailable', reason: record(error) && typeof error.name === 'string' ? error.name : 'network' }
  }
  if (!response.ok) return { kind: 'unavailable', reason: `http_${response.status}` }
  let body: unknown
  try {
    body = await response.json()
  } catch {
    return { kind: 'unavailable', reason: 'invalid_json' }
  }
  const inventory = inventoryFromPresentation(body, presentationId)
  return inventory ? { kind: 'ok', inventory } : { kind: 'unavailable', reason: 'invalid_presentation' }
}

/** Only the session's own Final deck may stand behind the Publish preview (the same ownership rule lib/studio-publish-preview.ts and lib/studio-publish-preview-inventory.ts apply). */
export interface PublishFrameSource {
  sessionId?: string | null
  ownerSessionId?: string | null
  finalPresentationId?: string | null
}

function nonempty(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The one read the Publish frame may make, or null: only while the preview is `unavailable` (no image from any source; `loading` and `ready` keep theirs), and only for this session's own held Final deck. */
export function publishFrameRequest(
  previewStatus: string,
  publishSessionId: string | null | undefined,
  source: PublishFrameSource | null | undefined,
): { key: string; session: string; presentationId: string } | null {
  if (previewStatus !== 'unavailable') return null
  const session = nonempty(publishSessionId)
  const presentationId = nonempty(source?.finalPresentationId)
  if (!session || nonempty(source?.sessionId) !== session || nonempty(source?.ownerSessionId) !== session || !presentationId) return null
  return { key: JSON.stringify([session, presentationId]), session, presentationId }
}
