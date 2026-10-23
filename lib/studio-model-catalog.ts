// FRONTEND-2 Pass 3 (flag NEXT_PUBLIC_STUDIO_MODEL_CATALOG, exact "true", default off, read at build time). Import-free: everything the "Models" section of the Intelligence page
// and its server route need to decide, with no request made here.
//
// The catalog is Director's read-only passthrough of the Model Router's catalogue (GET {DIRECTOR}/api/v1/models/catalogue, Director's flag
// DIRECTOR_MODEL_CATALOGUE_PASSTHROUGH_ENABLED). What Director returns is a SUBSET: per model name, provider, speed_class, capabilities and premium; per group label, visibility, unit,
// presets, recommended, selectable_models and the available page; catalogue_version and schema_version. It carries NO prices, so none is shown. Streams: streams/director2/model-catalogue/
// (recorded fixtures) and streams/frontend/pass3/MODEL-CATALOG-STUDIO-NOTES.md (the display rules this follows).
//
// Two halves. The ROUTE half (app/api/models/catalogue/route.ts): which query reaches Director (only include_available, limit, offset, validated as Director validates them) and how
// each Director answer becomes a Studio answer. The PAGE half (components/studio-personal/intelligence-models.tsx): how a Studio answer becomes a state, a cache entry, a page of
// rows. Browsers only ever call the Studio route.

// NEXT_PUBLIC_STUDIO_LAUNCH_WORDING (default off): launched wording instead of promises and developer-speak; off, this file is exactly as before.
const LAUNCH_WORDING = process.env.NEXT_PUBLIC_STUDIO_LAUNCH_WORDING === 'true'

export const MODEL_CATALOG_ENDPOINT = '/api/models/catalogue'
/** The only schema this page understands (ROUTER-2's display rule): anything else reads as "catalog unavailable". */
export const MODEL_CATALOG_SCHEMA_VERSION = 1
/** The page size of "Show all models" (the size the recorded fixtures use). */
export const MODEL_CATALOG_PAGE_LIMIT = 10
/** The router's own maximum; Director reduces a larger limit to it, and so does the route. */
export const MODEL_CATALOG_LIMIT_MAX = 200
/** Used when the answer names no ttl_seconds (Director's own cache holds an answer for 300 s). */
export const MODEL_CATALOG_DEFAULT_TTL_SECONDS = 300
export const MODEL_CATALOG_MAX_TTL_SECONDS = 3600
export const MODEL_CATALOG_NOT_AVAILABLE_TEXT = LAUNCH_WORDING ? "The model catalog isn't available right now" : "The model catalog isn't available yet"

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const nullMap = <T,>(): Record<string, T> => Object.create(null) as Record<string, T>

// ---------------------------------------------------------------------------------------------------------------- the route half

export type CatalogueQueryResult = { ok: true; search: string } | { ok: false; error: string; code: 'invalid_query' }

const WHOLE_NUMBER = /^[0-9]{1,18}$/
const refuse = (error: string): CatalogueQueryResult => ({ ok: false, error, code: 'invalid_query' })

/** The query string the route forwards to Director, or the refusal. Only include_available (true or false), limit (a whole number from 1; above 200 it is reduced to 200, as Director does) and
 * offset (a whole number from 0) are ever forwarded, each at most once, rebuilt in a fixed order; any other parameter, a repeat or a malformed value is refused and nothing is forwarded. */
export function parseCatalogueQuery(entries: ReadonlyArray<readonly [string, string]>): CatalogueQueryResult {
  const seen = nullMap<string>()
  for (const [key, value] of entries) {
    if (key !== 'include_available' && key !== 'limit' && key !== 'offset') return refuse('Unsupported query parameter. Allowed: include_available, limit, offset.')
    if (key in seen) return refuse('Each query parameter may appear only once.')
    seen[key] = value
  }
  const parts: string[] = []
  if ('include_available' in seen) {
    if (seen.include_available !== 'true' && seen.include_available !== 'false') return refuse('include_available must be true or false.')
    parts.push(`include_available=${seen.include_available}`)
  }
  if ('limit' in seen) {
    if (!WHOLE_NUMBER.test(seen.limit)) return refuse(`limit must be a whole number from 1 (above ${MODEL_CATALOG_LIMIT_MAX} it is reduced to ${MODEL_CATALOG_LIMIT_MAX}).`)
    const digits = seen.limit.replace(/^0+(?=[0-9])/, '')
    if (digits === '0') return refuse(`limit must be a whole number from 1 (above ${MODEL_CATALOG_LIMIT_MAX} it is reduced to ${MODEL_CATALOG_LIMIT_MAX}).`)
    parts.push(`limit=${digits.length > 3 ? MODEL_CATALOG_LIMIT_MAX : Math.min(Number(digits), MODEL_CATALOG_LIMIT_MAX)}`)
  }
  if ('offset' in seen) {
    if (!WHOLE_NUMBER.test(seen.offset)) return refuse('offset must be a whole number from 0.')
    parts.push(`offset=${seen.offset.replace(/^0+(?=[0-9])/, '')}`)
  }
  return { ok: true, search: parts.length ? `?${parts.join('&')}` : '' }
}

export type CatalogueRouteOutcome = { status: number; body: Record<string, unknown> }

const NOT_YET_TEXT = LAUNCH_WORDING ? "The model catalog isn't available right now." : "The model catalog isn't available yet."
const UNREACHABLE_TEXT = 'The model catalog could not be reached right now.'
const FAILED_TEXT = 'The model catalog could not be loaded right now.'
// Director's codes for "nothing is set up behind this yet" (the router is not configured on this environment; Director's own flag is off), plus Studio's own for a missing Director URL.
const NOT_YET_CODES: readonly string[] = ['router_not_configured', 'catalogue_not_enabled', 'SERVICE_URL_NOT_CONFIGURED', 'SERVICE_URL_INVALID']
const CODE_SHAPE = /^[A-Za-z0-9_]{1,48}$/
const codeOf = (body: unknown, fallback: string) => (isRecord(body) && typeof body.code === 'string' && CODE_SHAPE.test(body.code) ? body.code : fallback)
const unavailable = (code: string): CatalogueRouteOutcome => ({ status: 503, body: { error: NOT_YET_CODES.includes(code) ? NOT_YET_TEXT : UNREACHABLE_TEXT, code, service_unavailable: true } })
const failed = (code: string): CatalogueRouteOutcome => ({ status: 502, body: { error: FAILED_TEXT, code } })

/** What the route answers for a Director answer. A 200 catalogue is passed through as it is; Director's 503 (router not configured / unreachable / timeout / unavailable) stays a 503 with
 * `service_unavailable: true` and its stable `code`; its 404 (its own flag is off) reads as "not available yet"; its 502, a refused entitlement or anything unexpected becomes a 502. The
 * words are Studio's, never the router's. */
export function mapDirectorCatalogueResponse(status: number, body: unknown): CatalogueRouteOutcome {
  if (status === 200) return isRecord(body) && isRecord(body.groups) && isRecord(body.models) ? { status: 200, body } : failed('catalogue_bad_body')
  if (status === 404) return unavailable('catalogue_not_enabled')
  if (status === 503) return unavailable(codeOf(body, 'service_unavailable'))
  return failed(codeOf(body, 'director_error'))
}

/** The answer when Director could not be called at all: a missing / invalid DIRECTOR_API_URL (`code` from ServiceUrlConfigError), a timeout or a network failure. */
export function catalogueCallFailure(kind: 'not-configured' | 'timeout' | 'unreachable', code?: string): CatalogueRouteOutcome {
  if (kind === 'not-configured') return unavailable(code === 'SERVICE_URL_INVALID' ? 'SERVICE_URL_INVALID' : 'SERVICE_URL_NOT_CONFIGURED')
  return failed(kind === 'timeout' ? 'director_timeout' : 'director_unreachable')
}

// ---------------------------------------------------------------------------------------------------------------- the page half: the catalogue

export type CatalogueModel = {
  name: string | null
  provider: string | null
  speedClass: string | null
  jsonSchema: boolean
  tools: boolean
  vision: boolean
  audioInput: boolean
  imageOutput: boolean
  speechOutput: boolean
  contextWindow: number | null
  maxOutput: number | null
  /** The group keys this model is premium for. */
  premiumGroups: string[]
}
export type CatalogueGroup = {
  key: string
  label: string
  /** Only "user" groups are shown; "system" groups are Deckster's own internal use. */
  visible: boolean
  /** The pick list: certified models only. */
  selectable: string[]
  /** slug -> the task weights (simple / moderate / heavy) it is on the suggested shortlist for. */
  suggested: Record<string, string[]>
  available: { model: string; recommended: boolean }[]
  availableCount: number | null
  nextOffset: number | null
}
export type Catalogue = { version: string | null; ttlSeconds: number; groups: CatalogueGroup[]; models: Record<string, CatalogueModel> }

const stringList = (value: unknown): string[] => (Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item !== '') : [])
const wholeOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null)
const positiveOrNull = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null)
const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null)
const WEIGHTS = ['simple', 'moderate', 'heavy']

function parseModel(value: Record<string, unknown>): CatalogueModel {
  const caps: Record<string, unknown> = isRecord(value.capabilities) ? value.capabilities : {}
  const premium: Record<string, unknown> = isRecord(value.premium) ? value.premium : {}
  return {
    name: textOrNull(value.name),
    provider: textOrNull(value.provider),
    speedClass: textOrNull(value.speed_class),
    jsonSchema: caps.json_schema === true,
    tools: caps.tools === true,
    vision: caps.vision === true,
    audioInput: caps.audio_input === true,
    imageOutput: caps.image_output === true,
    speechOutput: caps.speech_output === true,
    contextWindow: positiveOrNull(caps.context_window),
    maxOutput: positiveOrNull(caps.max_output),
    premiumGroups: Object.keys(premium).filter(key => premium[key] === true),
  }
}

function parseGroup(key: string, value: Record<string, unknown>): CatalogueGroup {
  const suggested = nullMap<string[]>()
  if (isRecord(value.recommended)) {
    for (const weight of Object.keys(value.recommended)) {
      const list = value.recommended[weight]
      if (!Array.isArray(list)) continue
      for (const item of list) {
        if (!isRecord(item) || typeof item.model !== 'string' || item.model === '') continue
        const weights = (suggested[item.model] ??= [])
        if (!weights.includes(weight)) weights.push(weight)
      }
    }
  }
  const available: { model: string; recommended: boolean }[] = []
  if (Array.isArray(value.available)) {
    for (const item of value.available) if (isRecord(item) && typeof item.model === 'string' && item.model !== '') available.push({ model: item.model, recommended: item.recommended === true })
  }
  return {
    key,
    label: textOrNull(value.label) ?? key,
    visible: value.visibility === 'user',
    selectable: stringList(value.selectable_models),
    suggested,
    available,
    availableCount: wholeOrNull(value.available_count),
    nextOffset: wholeOrNull(value.available_next_offset),
  }
}

/** A Studio answer body as a catalogue, or null when it is not one this page understands: not an object, schema_version other than 1, or no groups / models. Unknown fields are ignored. */
export function parseCatalogue(body: unknown): Catalogue | null {
  if (!isRecord(body) || body.schema_version !== MODEL_CATALOG_SCHEMA_VERSION || !isRecord(body.groups) || !isRecord(body.models)) return null
  const models = nullMap<CatalogueModel>()
  for (const slug of Object.keys(body.models)) {
    const model = body.models[slug]
    if (isRecord(model)) models[slug] = parseModel(model)
  }
  const groups: CatalogueGroup[] = []
  for (const key of Object.keys(body.groups)) {
    const group = body.groups[key]
    if (isRecord(group)) groups.push(parseGroup(key, group))
  }
  const ttl = positiveOrNull(body.ttl_seconds)
  return { version: textOrNull(body.catalogue_version), ttlSeconds: Math.min(ttl ?? MODEL_CATALOG_DEFAULT_TTL_SECONDS, MODEL_CATALOG_MAX_TTL_SECONDS), groups, models }
}

/** Page two of "Show all models" onto page one: the models of both, each group's available entries one after the other (a slug twice is listed once) and the paging of the latest page. Null when the
 * two pages are of different catalogue versions (the catalogue changed between the requests): the caller starts again from the first page. */
export function mergeCataloguePage(base: Catalogue, page: Catalogue): Catalogue | null {
  if (base.version !== page.version) return null
  const models = Object.assign(nullMap<CatalogueModel>(), base.models, page.models)
  const groups = base.groups.map(group => {
    const next = page.groups.find(candidate => candidate.key === group.key)
    if (!next) return group
    const listed = new Set(group.available.map(entry => entry.model))
    return {
      ...group,
      selectable: next.selectable.length ? next.selectable : group.selectable,
      available: [...group.available, ...next.available.filter(entry => !listed.has(entry.model))],
      availableCount: next.availableCount ?? group.availableCount,
      nextOffset: next.nextOffset,
    }
  })
  return { ...base, models, groups }
}

// ---------------------------------------------------------------------------------------------------------------- the page half: states

export type CatalogueResult =
  | { kind: 'ready'; catalogue: Catalogue }
  /** Director (or the router behind it) is not set up yet: UAT's answer until the router URL and key are set. */
  | { kind: 'not-available' }
  /** An answer this page cannot read (another schema_version, not a catalogue). */
  | { kind: 'unavailable' }
  | { kind: 'error'; reason: 'unreachable' | 'signed-out' }

/** The state a Studio route answer (status and parsed JSON body, or null for no body) puts the section in. */
export function classifyCatalogueResponse(status: number, body: unknown): CatalogueResult {
  if (status === 200) {
    const catalogue = parseCatalogue(body)
    return catalogue ? { kind: 'ready', catalogue } : { kind: 'unavailable' }
  }
  if (status === 503 && isRecord(body) && body.service_unavailable === true && typeof body.code === 'string' && NOT_YET_CODES.includes(body.code)) return { kind: 'not-available' }
  if (status === 401) return { kind: 'error', reason: 'signed-out' }
  return { kind: 'error', reason: 'unreachable' }
}

export const catalogueUrl = (showAll: boolean, offset = 0) =>
  showAll ? `${MODEL_CATALOG_ENDPOINT}?include_available=true&limit=${MODEL_CATALOG_PAGE_LIMIT}${offset > 0 ? `&offset=${offset}` : ''}` : MODEL_CATALOG_ENDPOINT

export type FetchJson = (url: string) => Promise<{ status: number; body: unknown }>

/** Where "Show more models" continues: the first next offset a shown group names, or null when every shown group is on its last page. */
export function nextCatalogueOffset(catalogue: Catalogue): number | null {
  const offsets = catalogue.groups.filter(group => group.visible && group.nextOffset !== null).map(group => group.nextOffset as number)
  return offsets.length ? Math.min(...offsets) : null
}

/** Reads the catalogue through `fetchJson` and keeps each good answer for its ttl_seconds (300 s when it names none). An answer that is not good is never kept. A request already in flight is
 * shared, so two callers ask once. */
export function createCatalogueLoader(deps: { fetchJson: FetchJson; now: () => number }) {
  const kept = new Map<string, { at: number; ttlMs: number; result: CatalogueResult }>()
  const flying = new Map<string, Promise<CatalogueResult>>()
  async function read(url: string): Promise<CatalogueResult> {
    const hit = kept.get(url)
    if (hit && deps.now() - hit.at < hit.ttlMs) return hit.result
    const pending = flying.get(url)
    if (pending) return pending
    const request = (async (): Promise<CatalogueResult> => {
      let result: CatalogueResult
      try {
        const answer = await deps.fetchJson(url)
        result = classifyCatalogueResponse(answer.status, answer.body)
      } catch {
        result = { kind: 'error', reason: 'unreachable' }
      }
      if (result.kind === 'ready') kept.set(url, { at: deps.now(), ttlMs: result.catalogue.ttlSeconds * 1000, result })
      else kept.delete(url)
      return result
    })().finally(() => { flying.delete(url) })
    flying.set(url, request)
    return request
  }
  return {
    /** The first page: the certified models (showAll false) or every available model, page one (showAll true). */
    load: (showAll: boolean) => read(catalogueUrl(showAll)),
    /** The page after the one `current` holds, merged in. Another catalogue version in between starts again from page one. */
    async loadMore(current: Catalogue): Promise<CatalogueResult> {
      const offset = nextCatalogueOffset(current)
      if (offset === null) return { kind: 'ready', catalogue: current }
      const page = await read(catalogueUrl(true, offset))
      if (page.kind !== 'ready') return page
      const merged = mergeCataloguePage(current, page.catalogue)
      if (merged) return { kind: 'ready', catalogue: merged }
      kept.delete(catalogueUrl(true))
      return read(catalogueUrl(true))
    },
    clear() { kept.clear() },
  }
}

// ---------------------------------------------------------------------------------------------------------------- the page half: what a row says

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google', 'x-ai': 'xAI', deepseek: 'DeepSeek', moonshotai: 'Moonshot AI', qwen: 'Qwen', nvidia: 'NVIDIA', 'z-ai': 'Z.ai',
  xiaomi: 'Xiaomi', microsoft: 'Microsoft', hexgrad: 'Hexgrad', 'fish-audio': 'Fish Audio', 'meta-llama': 'Meta', mistralai: 'Mistral AI', cohere: 'Cohere',
}
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The vendor, from the model's own `provider` or else the slug's prefix (never `upstream`, which Director does not send); null when the slug has no prefix. */
export function providerOf(slug: string, model?: CatalogueModel): string | null {
  const vendor = model?.provider ?? (slug.includes('/') ? slug.slice(0, slug.indexOf('/')) : null)
  return vendor && vendor.trim() ? vendor : null
}
export function providerLabel(vendor: string): string {
  if (Object.prototype.hasOwnProperty.call(PROVIDER_LABELS, vendor)) return PROVIDER_LABELS[vendor]
  return vendor.split(/[-_]/).filter(Boolean).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
}
/** The model's name without its vendor's prefix ("Anthropic: Claude Opus 5.5" is "Claude Opus 5.5" beside the vendor "Anthropic"); the slug itself when the catalogue page holds no entry for it. */
export function modelTitle(slug: string, model?: CatalogueModel): string {
  const name = model?.name
  if (!name) return slug
  const vendor = providerOf(slug, model)
  const prefixed = /^([^:/]{1,40}):\s+(\S.*)$/.exec(name)
  if (prefixed && vendor && [squash(vendor), squash(providerLabel(vendor))].includes(squash(prefixed[1]))) return prefixed[2]
  return name
}
const trimDecimal = (value: number) => String(Math.round(value * 10) / 10)
export function formatTokenCount(count: number): string {
  if (count >= 1_000_000) return `${trimDecimal(count / 1_000_000)}M`
  if (count >= 1000) return `${Math.round(count / 1000)}K`
  return String(count)
}
export function capabilityChips(model?: CatalogueModel): string[] {
  if (!model) return []
  return [
    model.vision && 'Vision',
    model.tools && 'Tools',
    model.jsonSchema && 'Structured output',
    model.audioInput && 'Audio in',
    model.imageOutput && 'Image out',
    model.speechOutput && 'Speech out',
  ].filter((chip): chip is string => typeof chip === 'string')
}
/** The speed class, only when it says something: "unverified" (or none) is not shown. */
export function speedOf(model?: CatalogueModel): string | null {
  const speed = model?.speedClass?.trim().toLowerCase()
  return speed && speed !== 'unverified' ? speed : null
}

export type ModelRow = {
  slug: string
  title: string
  provider: string | null
  chips: string[]
  contextWindow: string | null
  maxOutput: string | null
  speed: string | null
  premium: boolean
  /** On the proposed shortlist. Marked only under "Show all models": the default list IS the shortlist (the router's selectable_models is its shortlist and presets), so every row there would carry it. */
  suggested: boolean
  /** The task weights the shortlist suggests it for (simple / moderate / heavy), for the tooltip. */
  suggestedFor: string[]
  /** Certified, so it can be picked. A model in the "all" view that is not certified is listed, but not open for selection. */
  selectable: boolean
}
export type GroupView = { key: string; label: string; rows: ModelRow[]; certified: number; total: number | null; hasMore: boolean }
export type ModelsView = { groups: GroupView[]; empty: boolean; certifiedTotal: number; nextOffset: number | null }

function rowFor(slug: string, group: CatalogueGroup, models: Record<string, CatalogueModel>, selectable: boolean, listedAsRecommended: boolean, markSuggested: boolean): ModelRow {
  const model = models[slug]
  const weights = group.suggested[slug] ?? []
  const provider = providerOf(slug, model)
  return {
    slug,
    title: modelTitle(slug, model),
    provider: provider ? providerLabel(provider) : null,
    chips: capabilityChips(model),
    contextWindow: model?.contextWindow ? formatTokenCount(model.contextWindow) : null,
    maxOutput: model?.maxOutput ? formatTokenCount(model.maxOutput) : null,
    speed: speedOf(model),
    premium: Boolean(model?.premiumGroups.includes(group.key)),
    suggested: markSuggested && (weights.length > 0 || listedAsRecommended),
    suggestedFor: markSuggested ? WEIGHTS.filter(weight => weights.includes(weight)).concat(weights.filter(weight => !WEIGHTS.includes(weight))) : [],
    selectable,
  }
}

/** The rows of every user-visible group. showAll false: each group's certified models (selectable_models). showAll true: each group's available entries so far (the page or pages loaded), each marked
 * open for selection or not. A slug the catalogue page holds no entry for is listed under its slug. */
export function buildModelsView(catalogue: Catalogue, showAll: boolean): ModelsView {
  const groups: GroupView[] = []
  const certified = new Set<string>()
  for (const group of catalogue.groups) {
    if (!group.visible) continue
    for (const slug of group.selectable) certified.add(slug)
    const open = new Set(group.selectable)
    const rows = showAll
      ? group.available.map(entry => rowFor(entry.model, group, catalogue.models, open.has(entry.model), entry.recommended, true))
      : group.selectable.map(slug => rowFor(slug, group, catalogue.models, true, false, false))
    groups.push({ key: group.key, label: group.label, rows, certified: group.selectable.length, total: group.availableCount, hasMore: group.nextOffset !== null })
  }
  return { groups, empty: groups.every(group => group.rows.length === 0), certifiedTotal: certified.size, nextOffset: nextCatalogueOffset(catalogue) }
}

/** The one line the section's header carries. The count is the pick list (the certified models the router suggests and presets); "Show all models" lists every certified model, so there the line stops counting. */
export function catalogueSummary(result: CatalogueResult | null, showAll = false): string {
  if (result === null) return 'Loading…'
  if (result.kind === 'not-available') return LAUNCH_WORDING ? 'Not available' : 'Not available yet'
  if (result.kind === 'unavailable') return 'Unavailable'
  if (result.kind === 'error') return 'Could not be loaded'
  if (showAll) return 'Showing all models'
  const { certifiedTotal } = buildModelsView(result.catalogue, false)
  return certifiedTotal === 0 ? (LAUNCH_WORDING ? 'No models open for selection' : 'No models open for selection yet') : `${certifiedTotal} ${certifiedTotal === 1 ? 'model' : 'models'} open for selection`
}
