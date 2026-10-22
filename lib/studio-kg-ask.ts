// STUDIO KG ASK, "Ask your second brain" (flag NEXT_PUBLIC_STUDIO_KG_ASK, default off). Import-free: the flag rule, the words, the one request shape, and the pure rules that turn
// the Researcher's answer into what the page shows. The page keeps its own real Knowledge Graph; nothing here invents data, and nothing here writes.
//
// What POST /api/v1/kg/query really returns (backend/researcher routers/kg.py + services/kg/retriever.py, schemas_kg.KgQueryRequest / KgQueryResponse): NOT a written answer.
// It is a retrieval "context pack": { user_id, context_pack (a text block meant to be injected into a slide prompt, not to be read), nodes[] (entities, the seeds carry
// a similarity), edges[] (src_name, relation, dst_name), citations[] (entity_name, snippet, source_type, source_ref, session_id, url, document_filename, page_number) }.
// There is no generation step and no LLM answer; the only paid call behind it is one text embedding of the question. So this feature shows the PASSAGES the person's graph holds
// on the question, each with where it came from (the source link, and the deck it was learned in), and says plainly that it is not a written answer.

/** On only with the exact string "true" AND the Studio shell (the restyled page is the Studio one, and the styling uses its tokens). Every other value is off. */
export function studioKgAskOn(flag: string | undefined | null, shell: string | undefined | null): boolean {
  return flag === 'true' && shell === 'true'
}

/** The only route the UI calls. The proxy refuses it with 404 unless the flag is exactly "true" in the server's build. */
export const STUDIO_KG_ASK_ENDPOINT = '/api/knowledge-graph/query'

/** A question longer than this is refused before any request (the backend has no maximum; this keeps one embedding call small and the box readable). */
export const STUDIO_KG_ASK_MAX_QUESTION = 500
/** The counter appears from here, so a long question is noticed before it is refused. */
export const STUDIO_KG_ASK_COUNTER_FROM = 450
/** A question that has not answered after this long shows the error state instead of waiting for ever. */
export const STUDIO_KG_ASK_TIMEOUT_MS = 30000

/** What the proxy sends to POST /api/v1/kg/query besides user_id and query_text (KgQueryRequest: max_nodes 1..50, hops 0..2, min_similarity 0..1; these are its own defaults). */
export const STUDIO_KG_QUERY_PARAMS = { max_nodes: 8, hops: 1, min_similarity: 0.6 } as const

/** How much of the answer the page shows. */
export const STUDIO_KG_ASK_MAX_PASSAGES = 8
export const STUDIO_KG_ASK_MAX_ENTITIES = 8
export const STUDIO_KG_ASK_MAX_CONNECTIONS = 5

export const STUDIO_KG_ASK_WORDS = {
  title: 'Ask your second brain',
  hint: 'Shows the passages your graph holds on your question, each with where it came from. It does not write an answer.',
  label: 'Your question',
  placeholder: 'What have I researched about…',
  submit: 'Ask',
  asking: 'Asking',
  loading: 'Searching your second brain…',
  clear: 'Clear',
  retry: 'Try again',
  notAnswer: 'These are passages from your own research, not a written answer.',
  passages: 'Passages',
  entities: 'Related ideas',
  connections: 'How they connect',
  openSource: 'Open source',
  openDeck: 'Open the deck',
  emptyTitle: 'Nothing in your second brain matches that yet',
  emptyBody: 'Try the names of the topics, companies or people you have researched. New decks and imported past sessions add to the graph.',
  guardEmpty: 'Type a question first.',
  guardTooLong: `Keep your question under ${STUDIO_KG_ASK_MAX_QUESTION} characters.`,
  errorBad: 'That question could not be sent. Check it and try again.',
  errorSignedOut: 'Sign in again to ask your second brain.',
  errorPlan: 'Asking your second brain needs a Pro plan or above.',
  errorMissing: 'Asking your second brain is not available here yet.',
  errorBusy: 'Too many questions in a row. Wait a moment, then try again.',
  errorDown: 'Your second brain is not reachable right now. Try again in a moment.',
  errorNetwork: 'Deckster could not be reached. Check your connection and try again.',
  errorTimeout: 'That took too long. Try again.',
  errorUnreadable: 'The result could not be read. Try again.',
} as const

// ------------------------------------------------------------------ the question

/** Characters the way the backend counts them (code points, not UTF-16 units). */
export function studioKgAskLength(value: unknown): number {
  return typeof value === 'string' ? Array.from(value.trim()).length : 0
}

export type StudioKgAskCheck = { ok: true; question: string } | { ok: false; reason: 'empty' | 'too_long'; message: string }

/** The one rule for a question, used by the box and by the proxy: a string, trimmed, 1 to STUDIO_KG_ASK_MAX_QUESTION characters. */
export function studioKgAskCheck(raw: unknown): StudioKgAskCheck {
  const question = typeof raw === 'string' ? raw.trim() : ''
  if (!question) return { ok: false, reason: 'empty', message: STUDIO_KG_ASK_WORDS.guardEmpty }
  if (Array.from(question).length > STUDIO_KG_ASK_MAX_QUESTION) return { ok: false, reason: 'too_long', message: STUDIO_KG_ASK_WORDS.guardTooLong }
  return { ok: true, question }
}

/** What the browser sends to the proxy. */
export function studioKgAskClientBody(question: string): { query: string } {
  return { query: question }
}

/**
 * What the proxy sends to the Researcher: KgQueryRequest. `user_id` is always the signed-in person's own id, taken from the session on the server; nothing the browser sends
 * can set it, so a question can only ever read the asker's own graph.
 */
export function studioKgAskBackendBody(userId: string, question: string): { user_id: string; query_text: string; max_nodes: number; hops: number; min_similarity: number } {
  return { user_id: userId, query_text: question, ...STUDIO_KG_QUERY_PARAMS }
}

// ------------------------------------------------------------------ the answer

export interface StudioKgAskEntity { id: string; name: string; typeLabel: string; best: boolean }
export interface StudioKgAskConnection { key: string; from: string; relation: string; to: string }
export interface StudioKgAskLink { kind: 'source' | 'deck'; href: string; label: string; external: boolean }
/** `meta` is the small line under the title: the kind of source and the page, either may be missing. */
export interface StudioKgAskPassage { key: string; number: number; snippet: string; title: string; meta: string; entity: string; links: StudioKgAskLink[] }
export interface StudioKgAskResult { entities: StudioKgAskEntity[]; connections: StudioKgAskConnection[]; passages: StudioKgAskPassage[]; sourceCount: number }

const SOURCE_LABELS: Record<string, string> = {
  chunk: 'Uploaded document', text_chunk: 'Uploaded document', table: 'Table', table_summary: 'Table summary', researcher_context: 'Deck research', web: 'Web research',
}

export function studioKgAskSourceLabel(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'Knowledge source'
  const key = value.trim()
  return SOURCE_LABELS[key] || key.replace(/_/g, ' ')
}

/** The opened deck is a real session: the same address the Second Brain deck list uses. */
export function studioKgAskDeckHref(sessionId: string): string {
  return `/builder?session_id=${encodeURIComponent(sessionId)}`
}

/** A link target that is a real web address, and nothing else (no javascript:, data:, file: or relative address). */
export function studioKgAskWebUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const parsed = new URL(value.trim()) // a relative address does not parse
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null
  } catch {
    return null
  }
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)
const rec = (value: unknown): Record<string, unknown> | null => (value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null)
const list = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./i, '') } catch { return '' }
}

/** The kind of an idea in the words the inspector and the map filters use ("product line"). */
function friendlyType(value: unknown): string {
  return str(value).replace(/_/g, ' ').toLowerCase() || 'idea'
}

/**
 * KgQueryResponse -> what the page shows, or null when the body is not an object at all. Anything unreadable is skipped, never guessed. `context_pack` is deliberately NOT used:
 * it is prompt text for a slide writer. Passages are the response's citations, in the backend's order (so "1" is the backend's [KG1]), the same passage once, at most STUDIO_KG_ASK_MAX_PASSAGES.
 */
export function studioKgAskNormalise(body: unknown): StudioKgAskResult | null {
  const root = rec(body)
  if (!root) return null

  const seeds: Array<{ node: Record<string, unknown>; similarity: number; index: number }> = []
  const others: Array<{ node: Record<string, unknown>; salience: number; index: number }> = []
  list(root.nodes).forEach((item, index) => {
    const node = rec(item)
    if (!node || !str(node.name)) return
    const similarity = num(node.similarity)
    if (similarity !== null) seeds.push({ node, similarity, index })
    else others.push({ node, salience: num(node.salience) ?? 0, index })
  })
  seeds.sort((a, b) => b.similarity - a.similarity || a.index - b.index)
  others.sort((a, b) => b.salience - a.salience || a.index - b.index)
  const entities: StudioKgAskEntity[] = []
  const seenEntity = new Set<string>()
  const ranked = [...seeds, ...others]
  for (let rank = 0; rank < ranked.length; rank++) {
    const node = ranked[rank].node
    const name = str(node.name)
    const key = name.toLowerCase()
    if (seenEntity.has(key)) continue
    seenEntity.add(key)
    entities.push({ id: str(node.node_id) || `name:${key}`, name, typeLabel: friendlyType(node.entity_type), best: rank < seeds.length })
    if (entities.length >= STUDIO_KG_ASK_MAX_ENTITIES) break
  }

  const connections: StudioKgAskConnection[] = []
  const seenEdge = new Set<string>()
  for (const item of list(root.edges)) {
    const edge = rec(item)
    if (!edge) continue
    const from = str(edge.src_name), to = str(edge.dst_name), relation = str(edge.relation).replace(/_/g, ' ')
    if (!from || !to || !relation || from === '?' || to === '?') continue
    const key = `${from.toLowerCase()}\u0000${relation.toLowerCase()}\u0000${to.toLowerCase()}`
    if (seenEdge.has(key)) continue
    seenEdge.add(key)
    connections.push({ key, from, relation, to })
    if (connections.length >= STUDIO_KG_ASK_MAX_CONNECTIONS) break
  }

  const passages: StudioKgAskPassage[] = []
  const seenPassage = new Set<string>()
  const sources = new Set<string>()
  for (const item of list(root.citations)) {
    const citation = rec(item)
    if (!citation) continue
    const snippet = str(citation.snippet)
    if (!snippet) continue
    const sessionId = str(citation.session_id)
    const key = `${sessionId}\u0000${snippet}`
    if (seenPassage.has(key)) continue
    seenPassage.add(key)
    const filename = str(citation.document_filename)
    const url = studioKgAskWebUrl(citation.url)
    const page = num(citation.page_number)
    const kind = studioKgAskSourceLabel(citation.source_type)
    const links: StudioKgAskLink[] = []
    if (url) links.push({ kind: 'source', href: url, label: STUDIO_KG_ASK_WORDS.openSource, external: true })
    if (sessionId) links.push({ kind: 'deck', href: studioKgAskDeckHref(sessionId), label: STUDIO_KG_ASK_WORDS.openDeck, external: false })
    sources.add(filename ? `file:${filename}` : url ? `url:${url}` : sessionId ? `session:${sessionId}` : `kind:${kind}`)
    const title = filename || (url ? hostOf(url) : '') || kind
    passages.push({
      key,
      number: passages.length + 1,
      snippet,
      title,
      // the kind, unless the title already says it, then the page
      meta: [title === kind ? '' : kind, page !== null && page > 0 ? `p.${Math.floor(page)}` : ''].filter(Boolean).join(' · '),
      entity: str(citation.entity_name),
      links,
    })
    if (passages.length >= STUDIO_KG_ASK_MAX_PASSAGES) break
  }

  return { entities, connections, passages, sourceCount: sources.size }
}

/** Nothing to show: no passage and no related idea. */
export function studioKgAskIsEmpty(result: StudioKgAskResult | null): boolean {
  return !result || (result.passages.length === 0 && result.entities.length === 0)
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** The one line above the passages: what was found, in numbers the response really holds. */
export function studioKgAskSummary(result: StudioKgAskResult): string {
  const { passages, entities, sourceCount } = result
  if (passages.length === 0) return `Found ${plural(entities.length, 'related idea', 'related ideas')}, but no source passage was recorded for ${entities.length === 1 ? 'it' : 'them'}.`
  return `Found ${plural(passages.length, 'passage', 'passages')} from ${plural(sourceCount, 'source', 'sources')}${entities.length ? `, across ${plural(entities.length, 'related idea', 'related ideas')}` : ''}.`
}

// ------------------------------------------------------------------ the errors

export type StudioKgAskFailure = { status: number } | { network: true } | { timeout: true } | { unreadable: true }

/** Plain words for every way a question can fail. The service's own message is never shown (it can carry internals). */
export function studioKgAskErrorText(failure: StudioKgAskFailure): string {
  if ('network' in failure) return STUDIO_KG_ASK_WORDS.errorNetwork
  if ('timeout' in failure) return STUDIO_KG_ASK_WORDS.errorTimeout
  if ('unreadable' in failure) return STUDIO_KG_ASK_WORDS.errorUnreadable
  const { status } = failure
  if (status === 400 || status === 413 || status === 422) return STUDIO_KG_ASK_WORDS.errorBad
  if (status === 401) return STUDIO_KG_ASK_WORDS.errorSignedOut
  if (status === 403) return STUDIO_KG_ASK_WORDS.errorPlan
  if (status === 404) return STUDIO_KG_ASK_WORDS.errorMissing
  if (status === 429) return STUDIO_KG_ASK_WORDS.errorBusy
  return STUDIO_KG_ASK_WORDS.errorDown
}
