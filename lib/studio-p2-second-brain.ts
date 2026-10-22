// PASS2 SB-02/05/06/08/10 (flag NEXT_PUBLIC_STUDIO_P2_SECOND_BRAIN, default off). Import-free: the flag rule, the words, the routes and the small pure rules the Second Brain
// pieces use. The page keeps its own real Knowledge Graph (entities, relations, evidence); nothing here invents data, and nothing here writes.
//   SB-02  a read-only "Sources feeding your graph" list built from the evidence the graph already returns (no connections, no "This Mac") + the link to where uploads live;
//          with the Knowledge header-actions flag also on, that list sits in the header menu beside Import / Refresh / Settings (one Sources control, not two)
//   SB-05  the real 2D map, restyled toward the mockup: a soft glow, a count badge in each node, clearer label plates (no 3D)
//   SB-06  "Full screen" in the map toolbar (the browser's own full screen; Esc leaves it). No orbit animation.
//   SB-08  a three-number strip at the top of the inspector with the live numbers (mentions, evidence, sessions); no "Coverage" (it was sample-goal arithmetic)
//   SB-10  "Used in your decks": the contributing session ids resolved to deck titles from the person's own deck list

/** On only with the exact string "true" AND the Studio shell (the restyled page is the Studio one). Every other value is off. */
export function studioP2SecondBrainOn(flag: string | undefined | null, shell: string | undefined | null): boolean {
  return flag === 'true' && shell === 'true'
}

export const STUDIO_SB_WORDS = {
  sources: 'Sources',
  sourcesTitle: 'Sources feeding your graph',
  sourcesClose: 'Close sources',
  sourcesLoading: 'Reading the evidence behind your strongest entities…',
  sourcesEmpty: 'No sources are recorded in your graph yet.',
  sourcesPartial: 'Some entities could not be read, so this list may be incomplete.',
  sourcesRetry: 'Try again',
  sourcesActions: 'Knowledge actions',
  upload: 'Add a file or link in Studio',
  uploadHint: 'Uploads live in the chat composer in Studio. Nothing is added from this page.',
  fullScreen: 'Full screen',
  exitFullScreen: 'Exit full screen',
  usedInDecks: 'Used in your decks',
  decksLoading: 'Looking up your decks…',
  decksNone: 'No deck is recorded for this entity yet.',
  decksError: 'Your deck list could not be loaded.',
  decksRetry: 'Retry',
  untitledDeck: 'Untitled presentation',
} as const

/** Where a new presentation, and with it an upload, starts. A fresh session, never the last one. */
export const STUDIO_SB_UPLOAD_HREF = '/builder?session_id=new'

/** How many of the most reinforced entities the Sources list reads (one detail read each), and how a deck list is paged. */
export const STUDIO_SB_MAX_SOURCE_ENTITIES = 8
export const STUDIO_SB_SESSION_PAGE = 100
export const STUDIO_SB_SESSION_MAX_PAGES = 5

/** The opened deck is a real session: the same address the deck list uses. */
export function studioDeckHref(sessionId: string): string {
  return `/builder?session_id=${encodeURIComponent(sessionId)}`
}

export function studioSessionsPageUrl(page: number): string {
  const index = Number.isInteger(page) && page > 0 ? page : 0
  return `/api/sessions?limit=${STUDIO_SB_SESSION_PAGE}&offset=${index * STUDIO_SB_SESSION_PAGE}`
}

// ------------------------------------------------------------------ SB-08: the strip

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0)

export interface StudioStat { id: 'mentions' | 'evidence' | 'sessions'; label: string; value: number }

/** The three numbers of the entity the inspector shows, from the node-detail response that is already loaded. Anything unreadable counts as 0. */
export function studioStatStrip(mentions: unknown, evidenceCount: unknown, sessionCount: unknown): StudioStat[] {
  return [
    { id: 'mentions', label: 'Mentions', value: count(mentions) },
    { id: 'evidence', label: 'Evidence', value: count(evidenceCount) },
    { id: 'sessions', label: 'Sessions', value: count(sessionCount) },
  ]
}

// ------------------------------------------------------------------ SB-02: sources

const SOURCE_LABELS: Record<string, string> = { chunk: 'Uploaded document', table_summary: 'Table summary', researcher_context: 'Deck research', web: 'Web research' }

export function studioSourceTypeLabel(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Knowledge source'
  return SOURCE_LABELS[value] || value.replace(/_/g, ' ')
}

export interface StudioSource { key: string; name: string; kind: string; passages: number; entities: number }

interface EvidenceLike { document_filename?: unknown; source_type?: unknown }
interface DetailLike { evidence?: unknown }

/**
 * One row per source the entities' evidence names: the document filename, or (no filename) the kind of source ("Web research"). `passages` is how many
 * recorded passages came from it, `entities` how many of the read entities cite it. Most passages first, then by name. Unreadable records are skipped.
 */
export function studioAggregateSources(details: unknown): StudioSource[] {
  const rows = new Map<string, { name: string; kind: string; passages: number; entities: Set<number> }>()
  const list = Array.isArray(details) ? details : []
  list.forEach((detail, entityIndex) => {
    const evidence = detail && typeof detail === 'object' ? (detail as DetailLike).evidence : null
    if (!Array.isArray(evidence)) return
    for (const item of evidence as EvidenceLike[]) {
      if (!item || typeof item !== 'object') continue
      const filename = typeof item.document_filename === 'string' ? item.document_filename.trim() : ''
      const kind = studioSourceTypeLabel(item.source_type)
      const key = filename ? `file:${filename}` : `kind:${kind}`
      const row = rows.get(key) ?? { name: filename || kind, kind, passages: 0, entities: new Set<number>() }
      row.passages += 1
      row.entities.add(entityIndex)
      rows.set(key, row)
    }
  })
  return [...rows.entries()]
    .map(([key, row]) => ({ key, name: row.name, kind: row.kind, passages: row.passages, entities: row.entities.size }))
    .sort((a, b) => b.passages - a.passages || a.name.localeCompare(b.name))
}

/** "3 passages" / "1 passage". */
export function studioPassagesText(passages: number): string {
  return `${passages} ${passages === 1 ? 'passage' : 'passages'}`
}

// ------------------------------------------------------------------ SB-10: used in decks

export interface StudioDeckRow { id: string; title: string; slideCount: number | null; href: string }
interface SessionLike { id?: unknown; title?: unknown; slideCount?: unknown }

/** Folds one page of the deck list ({ sessions }) into an id -> { title, slideCount } map. Rows without a string id are skipped. */
export function studioIndexSessions(into: Record<string, { title: string | null; slideCount: number | null }>, sessions: unknown): Record<string, { title: string | null; slideCount: number | null }> {
  if (!Array.isArray(sessions)) return into
  for (const session of sessions as SessionLike[]) {
    if (!session || typeof session !== 'object' || typeof session.id !== 'string' || !session.id) continue
    into[session.id] = {
      title: typeof session.title === 'string' && session.title.trim() ? session.title.trim() : null,
      slideCount: typeof session.slideCount === 'number' && Number.isFinite(session.slideCount) && session.slideCount >= 0 ? Math.floor(session.slideCount) : null,
    }
  }
  return into
}

/**
 * The contributing session ids of an entity as deck rows, in the order the entity returned them, each id once. An id the deck list does not know
 * (archived, deleted, or beyond the pages read) is not shown as a deck; it is counted in `missing`.
 */
export function studioResolveDecks(sessionIds: unknown, byId: Record<string, { title: string | null; slideCount: number | null }>): { decks: StudioDeckRow[]; missing: number } {
  const decks: StudioDeckRow[] = []
  let missing = 0
  const seen = new Set<string>()
  for (const id of Array.isArray(sessionIds) ? sessionIds : []) {
    if (typeof id !== 'string' || !id || seen.has(id)) continue
    seen.add(id)
    const known = Object.prototype.hasOwnProperty.call(byId, id) ? byId[id] : null
    if (!known) { missing += 1; continue }
    decks.push({ id, title: known.title ?? STUDIO_SB_WORDS.untitledDeck, slideCount: known.slideCount, href: studioDeckHref(id) })
  }
  return { decks, missing }
}

/** "12 slides" / "1 slide" / "" when the count is not known. */
export function studioSlidesText(slideCount: number | null): string {
  if (slideCount === null || !Number.isFinite(slideCount) || slideCount < 0) return ''
  return `${slideCount} ${slideCount === 1 ? 'slide' : 'slides'}`
}

/** "1 earlier session is no longer in your deck list." / "N earlier sessions are ..." / "" for none. */
export function studioMissingDecksText(missing: number): string {
  if (!Number.isFinite(missing) || missing < 1) return ''
  return missing === 1 ? '1 earlier session is no longer in your deck list.' : `${Math.floor(missing)} earlier sessions are no longer in your deck list.`
}

// ------------------------------------------------------------------ SB-05: the map

export interface StudioNodeBadge { text: string; fontSize: number }

/** The count drawn inside a node: its mentions, "99+" above 99. Nothing for a node with no readable positive count. Sized to the node and the text. */
export function studioNodeBadge(mentionCount: unknown, radius: number): StudioNodeBadge | null {
  const value = count(mentionCount)
  if (value < 1 || !Number.isFinite(radius) || radius <= 0) return null
  const text = value > 99 ? '99+' : String(value)
  const fontSize = Math.round(Math.max(8, Math.min(radius * 0.9, (radius * 1.7) / text.length, 14)) * 10) / 10
  return { text, fontSize }
}

/** The soft glow around a node reaches this far past its edge. */
export const STUDIO_NODE_HALO = 2.3

/** One halo gradient id per entity type (types can hold any characters, so the id is the type's position in the sorted list). */
export function studioHaloId(types: readonly string[], type: string): string {
  const index = types.indexOf(type)
  return `kg-p2-halo-${index < 0 ? 0 : index}`
}

// ------------------------------------------------------------------ SB-06: full screen

interface FullscreenDocument { fullscreenEnabled?: unknown; fullscreenElement?: unknown }

/** The Full screen button exists only where the browser allows the page to go full screen. */
export function studioFullscreenSupported(doc: FullscreenDocument | null | undefined): boolean {
  return Boolean(doc) && doc?.fullscreenEnabled === true
}

/** Whether `element` is the one element currently shown full screen. */
export function studioFullscreenActive(doc: FullscreenDocument | null | undefined, element: unknown): boolean {
  return Boolean(doc) && Boolean(element) && doc?.fullscreenElement === element
}

export function studioFullscreenLabel(active: boolean): string {
  return active ? STUDIO_SB_WORDS.exitFullScreen : STUDIO_SB_WORDS.fullScreen
}
