// FRONTEND-2 P3-10 MODEL CHOICE, the SERVER half (flag NEXT_PUBLIC_STUDIO_MODEL_CHOICE, exact "true", default off). Design (A) of ROUTER-2's P3-10 doc
// (streams/router/pass3/P3-10-MODEL-CHOICE.md, sections 3.3, 3.4, 4): choices are SAVED in the Model Router, written by Studio's own server routes with Studio's own router key, never by the browser and never
// through Director. The three routes (app/api/model-choice/prefs, app/api/model-choice/prefs/deck/[deckKey], app/api/model-choice/used/[buildId]) are thin: each hands its request to a handler here, with the session reader,
// the session-ownership lookup and fetch injected, so the proof runs the real logic with fakes.
//
// Rules, as the doc and ROUTER-2's notes of 26 Oct set them:
//   - the user id is the signed-in session's (session.user.id, else its email), never anything the browser sends; the router trusts the id in its path, so the binding happens here;
//   - MODEL_ROUTER_URL (already set for narration) and MODEL_ROUTER_FRONTEND_KEY (a router key labelled "frontend", scopes prefs + read; server-only, PK mints it): either one empty or unusable and every
//     route answers 503 { code: 'router_not_configured', retryable: false } before anything is sent. The key goes only into the Authorization header of the router call: never into a response, never into a log;
//   - "Reusable defaults" = GET / PATCH {router}/v1/prefs/{user}; "This presentation" = this Studio session (ROUTER-2 confirmed the session id as the deck key): GET / PUT {router}/v1/prefs/{user}/sessions/{session},
//     which REPLACES the whole map. So a Studio PATCH is a read-modify-write on both scopes: GET (ETag), refuse a stale If-Match, then write with If-Match. A group set to null means "use my defaults";
//   - only the three text groups can be chosen in v1 (imagery and narration have no certified model); a choice is { preset: quick | economy | balanced | best | max } or { model } or null, nothing else; and on the deck
//     scope alone (ROUTER-2, model-router !42) { auto: true }: "Auto", Deckster's own choice for this presentation even when the person has a reusable default. It is validated exactly (only the key auto, only the
//     boolean true), written to the router's session scope as { "auto": true }, refused here with a 400 on the user scope before any router call, and read back as { auto: true } rows. "Use my default" is
//     still the group OMITTED from the deck map (null in the browser's body), and the user scope's "Auto" is still { group: null };
//   - the deck scope needs the router's R3: until it ships the router answers 404 there, which means "not available yet", not an error; the session must belong to the signed-in user;
//   - "Used for this deck" reads {router}/v1/usage/trace/{build_id}/timeline (the build id is the narrator's build_id, which Director uses as the router trace id) and returns ONLY the rows whose user_id
//     is the session user's.

import { MODEL_CHOICE_CHOOSABLE_GROUPS, MODEL_CHOICE_PRESET_IDS } from '@/lib/studio-model-choice'

export const MODEL_CHOICE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE'
/** The router path segment of the deck scope: the Studio session (ROUTER-2, 26 Oct). The one place to change if the deck key ever becomes the presentation id ('presentations'). */
export const MODEL_CHOICE_DECK_SCOPE: 'sessions' | 'presentations' = 'sessions'
export const ROUTER_TIMEOUT_MS = 10000
export const TIMELINE_LIMIT = 500

type Env = Record<string, string | undefined>
export type RouterConfig = { baseUrl: string; key: string }
export type Outcome = { status: number; body: Record<string, unknown>; etag?: string }
export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: AbortSignal; cache?: string }) => Promise<{ status: number; headers: { get(name: string): string | null }; json(): Promise<unknown> }>
export type SessionUser = { id?: string | null; email?: string | null } | null | undefined
export type OwnedSession = { userId: string; status?: string | null } | null

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const KEY_SHAPE = /^[\x21-\x7e]{8,512}$/
/** A plain id: a session id, a build id (bld_<hex12>) or a user id. */
export const PLAIN_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/
const MODEL_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,254}$/
const ETAG_SHAPE = /^(?:W\/)?"[\x21\x23-\x7e]{1,128}"$/
const CODE_SHAPE = /^[A-Za-z0-9_]{1,48}$/
/** The preset ids the router takes (quick, economy, balanced, best, max): the one list lib/studio-model-choice.ts keeps, which the picker and the slider offer too. */
const PRESETS: readonly string[] = MODEL_CHOICE_PRESET_IDS

export const routesOn = (env: Env) => env[MODEL_CHOICE_FLAG] === 'true'
/** NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE (exact "true", default off; the browser's hook reads the same flag at build time). On, a PATCH's stale-read check (the deck scope's and the reusable defaults') compares the entity tags as opaque values. */ // MODEL-CHOICE-DECK-SAVE
export const MODEL_CHOICE_DECK_SAVE_FLAG = 'NEXT_PUBLIC_STUDIO_MODEL_CHOICE_DECK_SAVE' // MODEL-CHOICE-DECK-SAVE
export const deckSaveOn = (env: Env) => env[MODEL_CHOICE_DECK_SAVE_FLAG] === 'true' // MODEL-CHOICE-DECK-SAVE
/** Two entity tags are the same read when their opaque values are: a weak mark (W/) and the quotes are not part of it. The router sends a strong tag, and Vercel compresses the response and sends it on as W/"..." (E2E-2 capture, 27 Oct 22:49Z), which the browser then returns in If-Match. */ // MODEL-CHOICE-DECK-SAVE
export const sameEntityTag = (sent: string | null, current: string | null) => { const opaque = (tag: string) => tag.trim().replace(/^W\//, '').replace(/^"(.*)"$/, '$1'); return sent !== null && current !== null && opaque(sent) === opaque(current) } // MODEL-CHOICE-DECK-SAVE
export const notFound = (): Outcome => ({ status: 404, body: { error: 'Not found' } })
const fail = (status: number, code: string, error: string, retryable: boolean): Outcome => ({ status, body: { error, code, retryable } })
export const NOT_CONFIGURED = (): Outcome => fail(503, 'router_not_configured', "Saving isn't switched on yet.", false)
const DECK_NOT_AVAILABLE = (): Outcome => fail(404, 'deck_scope_not_available', 'Choices for one presentation are not available yet.', false)

/** The router to call, or null: MODEL_ROUTER_URL not an http(s) address, or MODEL_ROUTER_FRONTEND_KEY empty or not plain visible text. */
export function routerConfig(env: Env): RouterConfig | null {
  const raw = (env.MODEL_ROUTER_URL ?? '').trim()
  const key = (env.MODEL_ROUTER_FRONTEND_KEY ?? '').trim()
  if (!raw || !KEY_SHAPE.test(key)) return null
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return { baseUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, '').replace(/\/v1$/, ''), key }
}

/** The signed-in user's id, from the session only: its id, else its email. */
export function sessionUserId(user: SessionUser): string | null {
  const id = (user?.id || user?.email || '').trim()
  return id ? id : null
}

/** The router path of a scope's saved choices. */
export const routerPrefsPath = (userId: string, deckKey?: string | null) =>
  deckKey ? `/v1/prefs/${encodeURIComponent(userId)}/${MODEL_CHOICE_DECK_SCOPE}/${encodeURIComponent(deckKey)}` : `/v1/prefs/${encodeURIComponent(userId)}`

export type Choice = { preset: string } | { model: string } | { auto: true }
export type Changes = Record<string, Choice | null>

/** The browser's PATCH body: exactly { preferences: { <text group>: { preset } | { model } | { auto: true } | null } }, one to three groups, nothing else (no user id, no other field). { auto: true } is the
 * deck scope's alone (handlePrefs refuses it on the user scope); its only key is auto and its only value the boolean true. */
export function parsePrefsPatch(body: unknown): { ok: true; changes: Changes } | { ok: false; error: string; code: 'invalid_request' } {
  const refuse = (error: string) => ({ ok: false as const, error, code: 'invalid_request' as const })
  if (!isRecord(body) || Object.keys(body).length !== 1 || !isRecord(body.preferences)) return refuse('The body must be { "preferences": { <group>: { "preset" } | { "model" } | null } }.')
  const groups = Object.keys(body.preferences)
  if (groups.length === 0 || groups.length > MODEL_CHOICE_CHOOSABLE_GROUPS.length) return refuse('Name one to three groups.')
  const changes: Changes = {}
  for (const group of groups) {
    if (!MODEL_CHOICE_CHOOSABLE_GROUPS.includes(group)) return refuse(`This group cannot be chosen: ${group.slice(0, 40)}.`)
    const choice = body.preferences[group]
    if (choice === null) { changes[group] = null; continue }
    if (!isRecord(choice) || Object.keys(choice).length !== 1) return refuse('A choice is { "preset" } or { "model" } or { "auto": true } or null.')
    if ('auto' in choice) {
      if (choice.auto !== true) return refuse('Auto is { "auto": true }.')
      changes[group] = { auto: true }
    } else if ('preset' in choice) {
      if (typeof choice.preset !== 'string' || !PRESETS.includes(choice.preset)) return refuse('A preset is quick, economy, balanced, best or max.')
      changes[group] = { preset: choice.preset }
    } else if ('model' in choice) {
      if (typeof choice.model !== 'string' || !MODEL_SHAPE.test(choice.model)) return refuse('A model is a catalogue model id.')
      changes[group] = { model: choice.model }
    } else return refuse('A choice is { "preset" } or { "model" } or { "auto": true } or null.')
  }
  return { ok: true, changes }
}

/** If-Match from the browser: absent (null), one strong or weak tag, or refused. */
export function parseIfMatch(raw: string | null): { ok: true; tag: string | null } | { ok: false } {
  if (raw === null) return { ok: true, tag: null }
  const tag = raw.trim()
  return ETAG_SHAPE.test(tag) ? { ok: true, tag } : { ok: false }
}

type Row = { preset: string | null; model: string | null; stale: boolean; auto?: true }
/** The router's saved rows, as much as Studio keeps: preset or model (or, on the deck scope, auto), and stale. The router's auto row carries auto: true and null preset and model (the key is on auto rows only);
 * an auto flag beside a preset or a model is not read as auto. */
function rowsOf(body: unknown): Record<string, Row> {
  const out: Record<string, Row> = {}
  const preferences = isRecord(body) && isRecord(body.preferences) ? body.preferences : {}
  for (const group of Object.keys(preferences)) {
    const row = preferences[group]
    if (!isRecord(row)) continue
    const preset = typeof row.preset === 'string' && PRESETS.includes(row.preset) ? row.preset : null
    const model = preset === null && typeof row.model === 'string' && MODEL_SHAPE.test(row.model) ? row.model : null
    if (preset !== null || model !== null) out[group] = { preset, model, stale: row.stale === true }
    else if (row.auto === true && (row.preset ?? null) === null && (row.model ?? null) === null) out[group] = { preset: null, model: null, stale: row.stale === true, auto: true }
  }
  return out
}
/** What the browser gets: the choosable groups only, and the catalogue version. Never the user id. An auto row reads back as { auto: true, preset: null, model: null, stale } on the deck scope; the user scope has
 * no auto, so a row of the kind there is left out. */
function view(scope: 'user' | 'deck', body: unknown): Record<string, unknown> {
  const rows = rowsOf(body)
  const preferences: Record<string, Row> = {}
  for (const group of MODEL_CHOICE_CHOOSABLE_GROUPS) if (rows[group] && (scope === 'deck' || !rows[group].auto)) preferences[group] = rows[group]
  const version = isRecord(body) && typeof body.catalogue_version === 'string' ? body.catalogue_version.slice(0, 200) : null
  return { scope, preferences, catalogue_version: version }
}

type Call = { status: number; body: unknown; etag: string | null } | { failed: 'timeout' | 'unreachable' }
async function callRouter(fetchImpl: FetchLike, config: RouterConfig, method: string, routerPath: string, payload?: unknown, ifMatch?: string | null): Promise<Call> {
  const headers: Record<string, string> = { Accept: 'application/json', Authorization: `Bearer ${config.key}` }
  if (payload !== undefined) headers['Content-Type'] = 'application/json'
  if (ifMatch) headers['If-Match'] = ifMatch
  try {
    const response = await fetchImpl(`${config.baseUrl}${routerPath}`, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload), cache: 'no-store', signal: AbortSignal.timeout(ROUTER_TIMEOUT_MS) })
    let body: unknown = null
    try { body = await response.json() } catch { body = null }
    const etag = response.headers.get('etag')
    return { status: response.status, body, etag: etag && ETAG_SHAPE.test(etag.trim()) ? etag.trim() : null }
  } catch (error) {
    return { failed: error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'unreachable' }
  }
}
const routerCode = (body: unknown) => { const code = isRecord(body) && isRecord(body.error) ? body.error.code : undefined; return typeof code === 'string' && CODE_SHAPE.test(code) ? code : null }
/** A router answer that is not a success, in Studio's words. A 404 on the deck scope is "not available yet" (R3 not shipped). */
function routerFailure(call: Call, deck: boolean, askedAuto = false): Outcome {
  if ('failed' in call) return fail(502, call.failed === 'timeout' ? 'router_timeout' : 'router_unreachable', 'The model router could not be reached right now.', true)
  if (call.status === 404 && deck) return DECK_NOT_AVAILABLE()
  if (call.status === 401 || call.status === 403) return fail(502, 'router_auth_failed', 'The model router refused Studio.', false)
  if (call.status === 409 || call.status === 412) return { status: 412, body: { error: 'Your choices changed elsewhere. Read them again and retry.', code: 'preferences_modified', retryable: true }, etag: call.etag ?? undefined }
  if (call.status === 422) {
    const code = routerCode(call.body) ?? 'invalid_preference'
    return fail(422, code, askedAuto || code === 'invalid_preference_auto' ? 'Auto cannot be saved for this presentation right now.' : 'That choice cannot be saved for this task right now.', false)
  }
  return fail(502, 'router_error', 'The model router could not save or read your choices right now.', true)
}

export type PrefsDeps = {
  env: Env
  getSessionUser: () => Promise<SessionUser>
  /** The Studio session's owner (prisma chatSession { userId, status }), or null when there is no such session. */
  findOwnedSession: (sessionId: string) => Promise<OwnedSession>
  fetch: FetchLike
}

/** GET and PATCH of one scope: deckKey null is "Reusable defaults", a session id is "This presentation". */
export async function handlePrefs(method: 'GET' | 'PATCH', deckKey: string | null, request: { body?: () => Promise<unknown>; ifMatch: string | null }, deps: PrefsDeps): Promise<Outcome> {
  if (!routesOn(deps.env)) return notFound()
  const user = await deps.getSessionUser()
  const userId = sessionUserId(user)
  if (!userId) return fail(401, 'unauthorized', 'Sign in again.', false)
  const config = routerConfig(deps.env)
  if (!config) return NOT_CONFIGURED()
  const deck = deckKey !== null
  if (deck) {
    if (!PLAIN_ID.test(deckKey) || deckKey === 'new') return fail(400, 'invalid_request', 'Not a presentation id.', false)
    if (!user?.id) return fail(401, 'unauthorized', 'Sign in again.', false)
    let owned: OwnedSession
    try { owned = await deps.findOwnedSession(deckKey) } catch { return fail(503, 'ownership_unavailable', 'Could not check this presentation right now.', true) }
    if (!owned || owned.status === 'deleted') return fail(404, 'session_not_found', 'This presentation is not saved yet, so your reusable defaults apply.', false)
    if (owned.userId !== user.id) return fail(403, 'forbidden', 'This presentation is not yours.', false)
  }
  const routerPath = routerPrefsPath(userId, deckKey)
  const scope = deck ? 'deck' : 'user'

  // A PATCH is checked whole before anything is sent: its If-Match and its body.
  let changes: Changes = {}
  let ifMatchTag: string | null = null
  if (method === 'PATCH') {
    const tag = parseIfMatch(request.ifMatch)
    if (!tag.ok) return fail(400, 'invalid_request', 'If-Match must be one entity tag from a read.', false)
    ifMatchTag = tag.tag
    let raw: unknown
    try { raw = request.body ? await request.body() : null } catch { raw = undefined }
    const parsed = parsePrefsPatch(raw)
    if (!parsed.ok) return fail(400, parsed.code, parsed.error, false)
    changes = parsed.changes
    // { auto: true } is the deck scope's: the router's user routes refuse it (extra_forbidden), so it is refused here, before anything is sent.
    if (!deck && Object.values(changes).some(choice => choice !== null && 'auto' in choice)) return fail(400, 'invalid_request', 'Auto is chosen for one presentation; for your reusable defaults, use no choice.', false)
  }
  const askedAuto = Object.values(changes).some(choice => choice !== null && 'auto' in choice)

  // Then read (both methods): the current map and its ETag.
  const current = await callRouter(deps.fetch, config, 'GET', routerPath)
  if ('failed' in current || current.status !== 200) return routerFailure(current, deck)
  if (method === 'GET') return { status: 200, body: view(scope, current.body), etag: current.etag ?? undefined }

  if (deckSaveOn(deps.env) && sameEntityTag(ifMatchTag, current.etag)) ifMatchTag = current.etag // MODEL-CHOICE-DECK-SAVE: the same read, however the tag travelled (W/ or not), on either scope: the check below then lets it through; a different tag is still refused, and the router still gets its own tag as If-Match
  // A stale read is refused here, before anything is written: the browser gets the current map and its tag.
  if (ifMatchTag !== null && ifMatchTag !== current.etag) return { status: 412, body: { ...view(scope, current.body), error: 'Your choices changed elsewhere. Read them again and retry.', code: 'preferences_modified', retryable: true }, etag: current.etag ?? undefined }

  let written: Call
  if (deck) {
    // PUT replaces the whole map: the current rows with the changes applied (null removes a group).
    const merged: Record<string, Choice> = {}
    for (const [group, row] of Object.entries(rowsOf(current.body))) merged[group] = row.auto ? { auto: true } : row.preset !== null ? { preset: row.preset } : { model: row.model as string }
    for (const [group, choice] of Object.entries(changes)) { if (choice === null) delete merged[group]; else merged[group] = choice }
    written = await callRouter(deps.fetch, config, 'PUT', routerPath, { preferences: merged }, current.etag)
  } else {
    written = await callRouter(deps.fetch, config, 'PATCH', routerPath, { preferences: changes }, current.etag)
  }
  if ('failed' in written || written.status !== 200) return routerFailure(written, deck, askedAuto)
  let etag = written.etag
  let body = written.body
  if (!etag) {
    const again = await callRouter(deps.fetch, config, 'GET', routerPath)
    if (!('failed' in again) && again.status === 200) { etag = again.etag; body = again.body }
  }
  return { status: 200, body: view(scope, body), etag: etag ?? undefined }
}

export type UsedDeps = { env: Env; getSessionUser: () => Promise<SessionUser>; fetch: FetchLike }
export type UsedRow = { service: string | null; task: string | null; group: string | null; model: string | null; fallback_depth: number; resolution: string | null; needs: string[]; ts: string | null }
const text = (value: unknown, max = 200) => (typeof value === 'string' && value !== '' ? value.slice(0, max) : null)

/** "Used for this deck": the build's router timeline, ONLY the rows of the signed-in user, each cut to what the page shows. */
export async function handleUsed(buildId: string, deps: UsedDeps): Promise<Outcome> {
  if (!routesOn(deps.env)) return notFound()
  const userId = sessionUserId(await deps.getSessionUser())
  if (!userId) return fail(401, 'unauthorized', 'Sign in again.', false)
  const config = routerConfig(deps.env)
  if (!config) return NOT_CONFIGURED()
  if (!PLAIN_ID.test(buildId)) return fail(400, 'invalid_request', 'Not a build id.', false)
  const call = await callRouter(deps.fetch, config, 'GET', `/v1/usage/trace/${encodeURIComponent(buildId)}/timeline?limit=${TIMELINE_LIMIT}`)
  if ('failed' in call || call.status !== 200) return routerFailure(call, false)
  const data = isRecord(call.body) && Array.isArray(call.body.data) ? call.body.data : []
  const rows: UsedRow[] = []
  for (const item of data) {
    if (!isRecord(item) || item.user_id !== userId) continue
    const depth = typeof item.fallback_depth === 'number' && Number.isInteger(item.fallback_depth) && item.fallback_depth >= 0 ? item.fallback_depth : 0
    rows.push({
      service: text(item.service, 80), task: text(item.task, 120), group: text(item.group, 60), model: text(item.model_served, 255), fallback_depth: depth,
      resolution: text(item.resolution, 48), needs: Array.isArray(item.needs) ? item.needs.filter((need): need is string => typeof need === 'string').slice(0, 6) : [], ts: text(item.ts, 40),
    })
  }
  return { status: 200, body: { build_id: buildId, rows, has_more: isRecord(call.body) && call.body.has_more === true } }
}
