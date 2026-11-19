// MY COMPANIONS (AVATAR-W5 Step A, for FRONTEND-1): the signed-in owner's own companion (a PRIVATE pack, id u- and 26 characters) in the voice call's character switch and on /studio/companions, list only (no upload, no delete).
// Flag NEXT_PUBLIC_STUDIO_MY_COMPANIONS: the exact string "true", only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"), build-time, default off. Off: nothing here runs, the call offers the cast as before and the page is as before.
// The owner is decided on the SERVER only (app/api/avatar/companions and app/api/avatar/pack/<id>/<path>, each with its own session check): this file only asks those two same-origin routes, with the page's own cookies, and
// never names a bucket, a key or a user id. A user pack's files are read from /api/avatar/pack/<id>/ (the route answers the owner with a short-lived link, everyone else with one 404); every other pack stays /companions/<name>/.
// Import-free on purpose (scripts/test-studio-my-companions.mjs runs the real file in a bare vm with fake fetches). Nothing here logs: there is no console call. Nothing here throws to its caller.

export const STUDIO_MY_COMPANIONS_FLAG = 'NEXT_PUBLIC_STUDIO_MY_COMPANIONS'
/** Read as two literals so the Next build inlines both into client bundles. */
export const STUDIO_MY_COMPANIONS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_MY_COMPANIONS === 'true'

/** The same test on any environment object: exactly "true" for both, nothing else ("TRUE", "1", " true", unset) is on. */
export function studioMyCompanionsOn(env: Record<string, string | undefined>): boolean {
  return env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && env[STUDIO_MY_COMPANIONS_FLAG] === 'true'
}

/** The owner's own companions (GET: 200 { companions: [{ id, displayName, packBaseUrl }] }, or the one 404). */
export const COMPANIONS_ROUTE = '/api/avatar/companions'
/** A user pack's files: `${PACK_ROUTE_BASE}/<id>/<relative path>` (the owner gets a 302 to a short-lived link for that one file). */
export const PACK_ROUTE_BASE = '/api/avatar/pack'
/** A user pack id: u- and 26 characters from [a-z0-9] (lib/studio-avatar-spawn.ts PACK_ID_PATTERN, the same). Nothing else is ever read from the pack route. */
export const USER_PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/
export const MAX_MY_COMPANIONS = 20
export const MAX_MY_COMPANION_NAME = 40

export function isUserPackId(value: unknown): value is string {
  return typeof value === 'string' && USER_PACK_ID_PATTERN.test(value)
}

/** Where a pack's files are: a user pack id is `/api/avatar/pack/<id>`, any other pack name is `/companions/<name>` (the committed cast, exactly as before). No trailing slash. */
export function packRootUrl(pack: string): string {
  return isUserPackId(pack) ? `${PACK_ROUTE_BASE}/${pack}` : `/companions/${pack}`
}

/** One of the owner's companions, as the list route gives it. */
export interface MyCompanion { id: string; displayName: string; packBaseUrl: string }

/** The name as the owner chose it, tidied (control characters out, spaces collapsed), or null when nothing usable is left or it is longer than 40 (lib/studio-avatar-spawn.ts cleanDisplayName, the same rule). */
export function cleanCompanionName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= MAX_MY_COMPANION_NAME ? name : null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** The list route's body read strictly, or null when it is not that shape at all (no object, no `companions` array). */
function companionsOf(json: unknown): MyCompanion[] | null {
  if (!isRecord(json) || !Array.isArray(json.companions)) return null
  const out: MyCompanion[] = []
  for (const item of json.companions) {
    if (out.length >= MAX_MY_COMPANIONS) break
    if (!isRecord(item)) continue
    const { id, displayName, packBaseUrl } = item
    if (!isUserPackId(id) || out.some(entry => entry.id === id)) continue
    const name = cleanCompanionName(displayName)
    if (name === null || packBaseUrl !== `${PACK_ROUTE_BASE}/${id}`) continue
    out.push({ id, displayName: name, packBaseUrl })
  }
  return out
}

/** The owner's companions from the list route's JSON: an array under `companions`; each entry has a user pack id, a display name (tidied, 1 to 40) and exactly `/api/avatar/pack/<id>` as its base; anything else (and a second entry with the same id) is dropped; at most 20. */
export function parseMyCompanions(json: unknown): MyCompanion[] {
  return companionsOf(json) ?? []
}

/** What these functions need of `fetch` (the browser's, bound, or a test's fake). */
export interface MyCompanionsResponse { status: number; json(): Promise<unknown> }
export type MyCompanionsFetch = (input: string, init?: { method?: 'GET'; credentials?: 'same-origin'; cache?: 'no-store' }) => Promise<MyCompanionsResponse>

/** The list, or null when it could not be had (no fetch, a network error, any status but 200, a body that is not JSON or not the list's shape). Never throws. The page tells an empty list from a failure with it. */
export async function loadMyCompanions(fetchFn: MyCompanionsFetch | null | undefined): Promise<MyCompanion[] | null> {
  try {
    if (typeof fetchFn !== 'function') return null
    const response = await fetchFn(COMPANIONS_ROUTE, { method: 'GET', credentials: 'same-origin', cache: 'no-store' })
    if (!response || response.status !== 200) return null
    return companionsOf(await response.json())
  } catch {
    return null
  }
}

/** The owner's companions, or [] on ANY failure (the call simply offers the cast). Never throws. */
export async function fetchMyCompanions(fetchFn: MyCompanionsFetch | null | undefined): Promise<MyCompanion[]> {
  return (await loadMyCompanions(fetchFn)) ?? []
}

/** Whether a companion's pack answers: GET `<packBaseUrl>/motion/manifest.json` on the pack route (and nowhere else) is true only for a 200 whose body is a JSON object; a network error, any other status, HTML or any other body is false. Never throws. */
export async function reachable(fetchFn: MyCompanionsFetch | null | undefined, entry: Pick<MyCompanion, 'packBaseUrl'> | null | undefined): Promise<boolean> {
  try {
    if (typeof fetchFn !== 'function' || !entry || typeof entry.packBaseUrl !== 'string') return false
    const id = entry.packBaseUrl.startsWith(`${PACK_ROUTE_BASE}/`) ? entry.packBaseUrl.slice(PACK_ROUTE_BASE.length + 1) : ''
    if (!isUserPackId(id)) return false
    const response = await fetchFn(`${PACK_ROUTE_BASE}/${id}/motion/manifest.json`, { method: 'GET', credentials: 'same-origin' })
    if (!response || response.status !== 200) return false
    return isRecord(await response.json())
  } catch {
    return false
  }
}

/** The owner's companions whose pack answers, in the list's order (the voice call offers only these: one that does not answer never reaches the switch, so the call stays on the cast). Never throws. */
export async function reachableCompanions(fetchFn: MyCompanionsFetch | null | undefined): Promise<MyCompanion[]> {
  try {
    const list = await fetchMyCompanions(fetchFn)
    const answers = await Promise.all(list.map(entry => reachable(fetchFn, entry)))
    return list.filter((_, at) => answers[at] === true)
  } catch {
    return []
  }
}

/** What each of the owner's companions goes by, by pack id (the call's top bar and transcript). */
export function myCompanionNames(mine: readonly MyCompanion[]): Readonly<Record<string, string>> {
  const names: Record<string, string> = {}
  for (const entry of mine) if (isUserPackId(entry.id) && typeof entry.displayName === 'string') names[entry.id] = entry.displayName
  return names
}

/** The display name a character goes by when it is one of the owner's (its own key in `names`, a non-empty string), else null: the caller then uses the cast's own words. */
export function myCompanionName(names: Readonly<Record<string, string>> | null | undefined, pack: string): string | null {
  if (!names || !isUserPackId(pack) || !Object.prototype.hasOwnProperty.call(names, pack)) return null
  const name = names[pack]
  return typeof name === 'string' && name !== '' ? name : null
}

/** A device remembers one of the owner's companions as its call character (the same key the call uses, handed in: COMPANION_STORAGE_KEY), only when it is on offer now; a write that fails is not an error. The cast's own write (writeCompanionChoice) refuses user packs. */
export function rememberMyCompanion(storage: { setItem(key: string, value: string): void } | null | undefined, key: string, pack: string, mine: readonly MyCompanion[]): boolean {
  try {
    if (!storage || !isUserPackId(pack) || !mine.some(entry => entry.id === pack)) return false
    storage.setItem(key, pack)
    return true
  } catch {
    return false
  }
}
