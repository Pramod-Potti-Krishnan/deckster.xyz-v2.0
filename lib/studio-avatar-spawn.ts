// STUDIO AVATAR SPAWN MOCK (FRONTEND-2; B66, AVATAR-SPAWN; PROGRAM-1 8 Nov batch 2 item 2; spec streams/companions-expansion/SPAWN-SPEC.md, sections 2 to 4).
// Flag NEXT_PUBLIC_STUDIO_AVATAR_SPAWN: the exact string "true", only with the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL, exact "true"), build-time, default off. Off: /studio/companions is a 404 and no new component draws anything.
// This is a MOCK. The spawn service does not exist yet, so every call goes through a SpawnClient and the only client here, MockSpawnClient, runs in the browser: no network, no image call, no paid call. The photo is
// never stored: the page holds it in memory for the preview (PhotoHold) and drops it when the person picks a look; the mock client reads only its size and type, never its bytes.
// The user's registry (what "My companions" lists) is the app's own record: { id, displayName, packBaseUrl, owner, createdAt } in localStorage under a key that carries the user id, every read and write inside try/catch.
// The pack id is opaque (u- and 26 random characters), never derived from the name. Nothing in this file logs: there is no console call, so no name, URL or file data can reach a log.
// Import-free on purpose, so scripts/test-studio-avatar-spawn.mjs can run the real file in a bare vm.

export const STUDIO_AVATAR_SPAWN_FLAG = 'NEXT_PUBLIC_STUDIO_AVATAR_SPAWN'
/** Read as two literals so the Next build inlines both into client bundles. */
export const STUDIO_AVATAR_SPAWN_ENABLED = process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_AVATAR_SPAWN === 'true'

/** The same test on any environment object: exactly "true" for both, nothing else ("TRUE", "1", " true", unset) is on. */
export function studioAvatarSpawnOn(env: Record<string, string | undefined>): boolean {
  return env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && env[STUDIO_AVATAR_SPAWN_FLAG] === 'true'
}

// ---- types (spec section 2: the user-scoped registry entry; section 3: the job) ----------------------------------------------------------------------

export interface CompanionOwner { app: string; tenantId: string; userId: string }
/** What Studio's picker needs to find a spawned pack: the pack's opaque id, the name the person chose (the app's own record), the base URL its manifest-relative paths resolve against, and the owner. */
export interface CompanionRegistryEntry { id: string; displayName: string; packBaseUrl: string; owner: CompanionOwner }
/** What the mock keeps, and ALL it keeps. */
export interface StoredCompanionEntry extends CompanionRegistryEntry { createdAt: string }

export type SpawnStage = 'consent' | 'upload' | 'intake' | 'masters' | 'pick' | 'building' | 'ready'
export const SPAWN_STAGES: readonly SpawnStage[] = ['consent', 'upload', 'intake', 'masters', 'pick', 'building', 'ready']
export type RefusalCode = 'under_18_unconfirmed' | 'public_figure' | 'not_a_photo' | 'quality'
export const REFUSAL_CODES: readonly RefusalCode[] = ['under_18_unconfirmed', 'public_figure', 'not_a_photo', 'quality']

export interface SpawnCandidate { id: string; previewUrl: string; label: string }
export interface SpawnJob {
  id: string
  /** The stage the job is at, or "refused" (then `refusal` says why and nothing more happens). */
  stage: SpawnStage | 'refused'
  progress: number
  candidates: SpawnCandidate[]
  refusal: RefusalCode | null
  packId: string | null
  packBaseUrl: string | null
}
export interface ConsentRecord { version: string; acceptedAt: string; items: string[] }
export interface EraseReceipt { id: string; erased: boolean }

/** The one view of a file the mock needs: its size and type. It never reads the bytes. */
export interface PhotoLike { readonly size: number; readonly type: string }

// ---- plain words -------------------------------------------------------------------------------------------------------------------------------

export const STAGE_WORDS: Record<SpawnStage, string> = {
  consent: 'Agree to the terms',
  upload: 'Add a photo',
  intake: 'Checking your photo',
  masters: 'Drawing your look',
  pick: 'Choose your look',
  building: 'Building your companion',
  ready: 'Ready',
}
export const STAGE_PROGRESS: Record<SpawnStage, number> = { consent: 0, upload: 10, intake: 25, masters: 45, pick: 55, building: 80, ready: 100 }

/** One plain message per refusal code. No appeal in v1 (spec section 4), so none of them offers one. */
export const REFUSAL_MESSAGES: Record<RefusalCode, string> = {
  under_18_unconfirmed: 'We cannot confirm that the person in this photo is 18 or older, so we cannot make a companion from it.',
  public_figure: 'We cannot make a companion that looks like a well-known public figure or an existing character.',
  not_a_photo: 'This does not look like a photo of a person. Please use a clear photo of your own face.',
  quality: 'We could not make a good likeness from this photo. A bright, in-focus, front-on photo with only you in it works best.',
}

// ---- consent (spec section 4: consent first; PLACEHOLDER text, a lawyer must read it) -----------------------------------------------------------------

export const CONSENT_PLACEHOLDER_NOTE = 'PLACEHOLDER: needs legal review (BIPA, GDPR)'
export const CONSENT_VERSION = 'placeholder-1'
export const CONSENT_ITEMS: ReadonlyArray<{ id: string; text: string }> = [
  { id: 'photo_use', text: 'I understand what happens to my photo: it is used once to draw my cartoon, it is deleted when I pick my look, and it is never used for training.' },
  { id: 'cartoon_result', text: 'I understand that the result is a cartoon of me, not a photo.' },
  { id: 'adult', text: 'I am 18 or older.' },
  { id: 'own_face', text: 'This is my own face, or I have the permission of the adult in the photo.' },
]

/** True only when every one of the four items is ticked. */
export function allConsentTicked(ticked: readonly string[]): boolean {
  return CONSENT_ITEMS.every(item => ticked.includes(item.id))
}

/** The record to store on the job (version and time, plus the item ids), or null while any item is unticked: there is no way to a job without it. */
export function buildConsentRecord(ticked: readonly string[], now: number | Date): ConsentRecord | null {
  if (!allConsentTicked(ticked)) return null
  const at = new Date(now)
  if (Number.isNaN(at.getTime())) return null
  return { version: CONSENT_VERSION, acceptedAt: at.toISOString(), items: CONSENT_ITEMS.map(item => item.id) }
}

/** A consent record the service would accept: a version, a real time, and all four items. */
export function consentComplete(record: unknown): record is ConsentRecord {
  if (!record || typeof record !== 'object') return false
  const r = record as Partial<ConsentRecord>
  return typeof r.version === 'string' && r.version !== '' && typeof r.acceptedAt === 'string' && !Number.isNaN(Date.parse(r.acceptedAt)) && Array.isArray(r.items) && allConsentTicked(r.items)
}

// ---- ids (spec section 2: opaque, never the name) ----------------------------------------------------------------------------------------------

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
export const PACK_ID_PATTERN = /^u-[a-z0-9]{26}$/

function randomIndex(random?: () => number): number {
  if (random) {
    const n = Math.floor(random() * ID_ALPHABET.length)
    return Number.isFinite(n) ? Math.min(ID_ALPHABET.length - 1, Math.max(0, n)) : 0
  }
  const c = (globalThis as { crypto?: { getRandomValues?: (bytes: Uint8Array) => Uint8Array } }).crypto
  if (c && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(1)
    c.getRandomValues(bytes)
    while (bytes[0] >= 252) c.getRandomValues(bytes) // 252 = 7 x 36: no modulo bias
    return bytes[0] % ID_ALPHABET.length
  }
  return Math.floor(Math.random() * ID_ALPHABET.length)
}
export function randomChars(count: number, random?: () => number): string {
  let out = ''
  for (let i = 0; i < count; i++) out += ID_ALPHABET[randomIndex(random)]
  return out
}
/** u- and 26 random characters from [a-z0-9]. It takes no name: nothing it returns can come from one. */
export function newPackId(random?: () => number): string {
  return `u-${randomChars(26, random)}`
}
export function newJobId(random?: () => number): string {
  return `sj-${randomChars(12, random)}`
}

// ---- names, base URLs, and resolving a pack's paths --------------------------------------------------------------------------------------------

export const MAX_DISPLAY_NAME = 40
/** The name as the person typed it, tidied (control characters out, spaces collapsed), or null when nothing usable is left or it is too long. */
export function cleanDisplayName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return name.length >= 1 && name.length <= MAX_DISPLAY_NAME ? name : null
}

const PATH_BASE = /^\/(?!\/)[A-Za-z0-9._~/-]*$/
const HTTPS_BASE = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:\/[A-Za-z0-9._~/-]*)?$/
/** A pack's base URL as the app will use it (no trailing slash): a same-origin path or an https address, with no query, no fragment, no backslash and no ".." segment. Anything else is null. */
export function safePackBaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 300) return null
  if (!PATH_BASE.test(value) && !HTTPS_BASE.test(value)) return null
  if (value.split('/').includes('..')) return null
  const trimmed = value.replace(/\/+$/, '')
  return trimmed === '' ? null : trimmed
}

/**
 * A manifest-relative path (motion/manifest.json, portrait-512.webp, a frame file) joined to the entry's base. ".." may step back inside the path but never above the base: a path that would climb out of it, an
 * absolute address, a scheme, a "//" start, a query, a fragment, a backslash, a "%" or a control character gives null, never a URL that points elsewhere.
 */
export function resolvePackUrl(entry: { packBaseUrl: string } | null | undefined, manifestRelativePath: string): string | null {
  const base = safePackBaseUrl(entry?.packBaseUrl)
  if (!base || typeof manifestRelativePath !== 'string' || manifestRelativePath === '') return null
  if (/[\u0000-\u001f\u007f\\?#%]/.test(manifestRelativePath) || /^[A-Za-z][A-Za-z0-9+.-]*:/.test(manifestRelativePath) || manifestRelativePath.startsWith('//')) return null
  const kept: string[] = []
  for (const part of manifestRelativePath.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') { if (kept.length === 0) return null; kept.pop(); continue }
    kept.push(part)
  }
  return kept.length === 0 ? null : `${base}/${kept.join('/')}`
}

// ---- the fallback chain (INTEGRATION.md: the pack, then its portrait, then Felix) ---------------------------------------------------------------

export const PACK_MANIFEST_PATH = 'motion/manifest.json'
export const PACK_PORTRAIT_PATH = 'portrait-512.webp'
/** Felix is committed under public/companions/ and is the app's own default (DEFAULT_COMPANION), so the last step never depends on a spawned pack. */
export const FELIX_PACK_BASE_URL = '/companions/felix'
export type FallbackKind = 'pack' | 'portrait' | 'felix'
/** `url` is what that step loads as the character; `still` is the picture that step stands for (the pack's portrait for the first two, Felix's for the last). */
export interface FallbackStep { kind: FallbackKind; url: string; still: string }

/** The order a spawned companion degrades in: the pack first, then its portrait, then Felix. A step whose address is unsafe is left out; Felix is always last. */
export function companionFallbackChain(entry: { packBaseUrl: string } | null | undefined): FallbackStep[] {
  const manifest = resolvePackUrl(entry, PACK_MANIFEST_PATH), portrait = resolvePackUrl(entry, PACK_PORTRAIT_PATH)
  const felix = { packBaseUrl: FELIX_PACK_BASE_URL }
  const chain: FallbackStep[] = []
  if (manifest && portrait) chain.push({ kind: 'pack', url: manifest, still: portrait })
  if (portrait) chain.push({ kind: 'portrait', url: portrait, still: portrait })
  chain.push({ kind: 'felix', url: resolvePackUrl(felix, PACK_MANIFEST_PATH) as string, still: resolvePackUrl(felix, PACK_PORTRAIT_PATH) as string })
  return chain
}
/** The first step the caller can load; when none can be, Felix (the last step). */
export function firstLoadable(chain: readonly FallbackStep[], loadable: (step: FallbackStep) => boolean): FallbackStep {
  for (const step of chain) if (loadable(step)) return step
  return chain[chain.length - 1]
}
/** The distinct pictures of a chain, in order (for a thumbnail that steps to the next one when one fails to load). */
export function stillCandidates(chain: readonly FallbackStep[]): string[] {
  return chain.map(step => step.still).filter((url, at, all) => all.indexOf(url) === at)
}

// ---- the registry in localStorage (the app's own record) ----------------------------------------------------------------------------------------

export interface MockStorage { getItem(key: string): string | null; setItem(key: string, value: string): void }
export const REGISTRY_KEY_PREFIX = 'deckster.studio.avatarSpawn.entries.'
export const registryKey = (userId: string): string => `${REGISTRY_KEY_PREFIX}${userId}`

/** One stored entry, rebuilt from exactly its six fields (anything else a stored value carries is dropped), or null when it is not an entry of this user. */
export function parseStoredEntry(value: unknown, userId: string): StoredCompanionEntry | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const owner = v.owner as Record<string, unknown> | null | undefined
  const base = safePackBaseUrl(v.packBaseUrl), name = cleanDisplayName(v.displayName)
  if (typeof v.id !== 'string' || !PACK_ID_PATTERN.test(v.id) || !base || name === null || name !== v.displayName) return null
  if (!owner || typeof owner !== 'object' || typeof owner.app !== 'string' || typeof owner.tenantId !== 'string' || owner.userId !== userId) return null
  if (typeof v.createdAt !== 'string' || Number.isNaN(Date.parse(v.createdAt))) return null
  return { id: v.id, displayName: name, packBaseUrl: base, owner: { app: owner.app, tenantId: owner.tenantId, userId }, createdAt: v.createdAt }
}

/** This user's entries (empty when there is no storage, nothing stored, or the stored text is not what it should be). The read is inside try/catch: blocked site data is just an empty list. */
export function readRegistry(storage: MockStorage | null | undefined, userId: string): StoredCompanionEntry[] | null {
  try {
    if (!storage || userId === '') return null
    const text = storage.getItem(registryKey(userId))
    if (text === null) return []
    const parsed: unknown = JSON.parse(text)
    return Array.isArray(parsed) ? parsed.map(item => parseStoredEntry(item, userId)).filter((entry): entry is StoredCompanionEntry => entry !== null) : []
  } catch { return null }
}
/** Writes this user's entries. False when there is no storage or the write throws (then the caller keeps the list in memory). */
export function writeRegistry(storage: MockStorage | null | undefined, userId: string, entries: readonly StoredCompanionEntry[]): boolean {
  try {
    if (!storage || userId === '') return false
    storage.setItem(registryKey(userId), JSON.stringify(entries.map(e => ({ id: e.id, displayName: e.displayName, packBaseUrl: e.packBaseUrl, owner: { app: e.owner.app, tenantId: e.owner.tenantId, userId: e.owner.userId }, createdAt: e.createdAt }))))
    return true
  } catch { return false }
}

/** The "My companions" group for a picker: this user's own entries, read from their own registry. Empty with the flag off, with no user, with no storage or with nothing saved. */
export function myCompanionsGroup(storage: MockStorage | null | undefined, userId: string | null | undefined): StoredCompanionEntry[] {
  if (!STUDIO_AVATAR_SPAWN_ENABLED || typeof userId !== 'string' || userId === '') return []
  return readRegistry(storage, userId) ?? []
}

// ---- the photo, in memory only ------------------------------------------------------------------------------------------------------------------

export interface UrlApi { createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void }
/** Holds the chosen photo and its preview address for as long as the page needs them. Nothing here writes, logs or sends: discard() lets go of the file and revokes the preview. */
export class PhotoHold {
  private file: (PhotoLike & Blob) | null = null
  private url: string | null = null
  constructor(private readonly urls: UrlApi | null) {}
  hold(file: PhotoLike & Blob): string | null {
    this.discard()
    this.file = file
    try { this.url = this.urls ? this.urls.createObjectURL(file) : null } catch { this.url = null }
    return this.url
  }
  preview(): string | null { return this.url }
  has(): boolean { return this.file !== null }
  current(): (PhotoLike & Blob) | null { return this.file }
  discard(): void {
    const url = this.url
    this.file = null
    this.url = null
    if (url && this.urls) { try { this.urls.revokeObjectURL(url) } catch { /* nothing to release */ } }
  }
}

// ---- the client (shaped on spec section 3) ------------------------------------------------------------------------------------------------------

export interface SpawnClient {
  /** POST /v1/spawns: the consent goes with the job. */
  createJob(consent: ConsentRecord): Promise<SpawnJob>
  /** The photo of POST /v1/spawns. */
  submitPhoto(jobId: string, file: PhotoLike): Promise<SpawnJob>
  /** GET /v1/spawns/{id}. */
  getJob(jobId: string): Promise<SpawnJob | null>
  /** POST /v1/spawns/{id}/pick: "that's me". The photo is already gone by then. */
  pickMaster(jobId: string, candidateId: string): Promise<SpawnJob>
  /** The owner's packs (spec section 4: visible only in that user's picker). */
  listPacks(): Promise<StoredCompanionEntry[]>
  /** DELETE /v1/spawns/{id}: erases the pack and its previews; the receipt says whether there was one. */
  deletePack(packId: string): Promise<EraseReceipt>
  /** The app's own record of the name: the spawn service never sees it (spec section 2, Identity). */
  saveDisplayName(jobId: string, displayName: string): Promise<StoredCompanionEntry>
}

/** Four placeholder masters, drawn from portraits already committed under public/companions/ (only three different ones exist, so the fourth is Maya's smaller file). */
export const MASTER_CANDIDATES: readonly SpawnCandidate[] = [
  { id: 'c1', label: 'Option 1', previewUrl: '/companions/maya/portrait-512.webp' },
  { id: 'c2', label: 'Option 2', previewUrl: '/companions/felix/portrait-512.webp' },
  { id: 'c3', label: 'Option 3', previewUrl: '/companions/bob/portrait-512.webp' },
  { id: 'c4', label: 'Option 4', previewUrl: '/companions/maya/portrait-256.webp' },
]

export interface MockTimers { setTimeout(fn: () => void, ms: number): unknown; clearTimeout(handle: unknown): void }
export interface MockSpawnOptions {
  userId: string
  tenantId?: string
  /** Where the registry lives. Omitted: localStorage (read inside try/catch). null: memory only. */
  storage?: MockStorage | null
  random?: () => number
  now?: () => number
  /** Tests drive the stages by handing in their own timers, or by calling advance(). */
  timers?: MockTimers
  stageMs?: number
  /** The committed pack every "ready" pack points at: Felix unless told otherwise. */
  standInPackBaseUrl?: string
  /** Demo and test hook: this refusal at the end of the photo check, whatever the photo is. */
  refuse?: RefusalCode | null
}

const MIN_PHOTO_BYTES = 1024
const MAX_PHOTO_BYTES = 15 * 1024 * 1024
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
const TIMED_STAGES: readonly SpawnStage[] = ['intake', 'masters', 'building']

interface InternalJob extends SpawnJob { consent: ConsentRecord; refuseWith: RefusalCode | null; timer: unknown }

function browserStorage(): MockStorage | null {
  try {
    const storage = (globalThis as { localStorage?: MockStorage }).localStorage
    return storage ?? null
  } catch { return null }
}

/** The mock client: stages advance on timers, candidates are placeholders, and the registry is the user's own localStorage record. No network, no image call, no photo bytes read or kept. */
export class MockSpawnClient implements SpawnClient {
  private readonly jobs = new Map<string, InternalJob>()
  private readonly userId: string
  private readonly tenantId: string
  private readonly storage: MockStorage | null
  private memory: StoredCompanionEntry[] = []
  private readonly random: (() => number) | undefined
  private readonly now: () => number
  private readonly timers: MockTimers
  private readonly stageMs: number
  private readonly standIn: string
  private readonly refuse: RefusalCode | null

  constructor(options: MockSpawnOptions) {
    if (typeof options.userId !== 'string' || options.userId === '') throw new Error('user_required')
    this.userId = options.userId
    this.tenantId = options.tenantId ?? 'mock-tenant'
    this.storage = options.storage === undefined ? browserStorage() : options.storage
    this.random = options.random
    this.now = options.now ?? (() => Date.now())
    this.timers = options.timers ?? { setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms), clearTimeout: handle => globalThis.clearTimeout(handle as number) }
    this.stageMs = options.stageMs ?? 1200
    this.standIn = safePackBaseUrl(options.standInPackBaseUrl ?? FELIX_PACK_BASE_URL) ?? FELIX_PACK_BASE_URL
    this.refuse = options.refuse ?? null
  }

  private entries(): StoredCompanionEntry[] {
    const stored = readRegistry(this.storage, this.userId)
    return stored === null ? this.memory : stored
  }
  private save(entries: StoredCompanionEntry[]): void {
    this.memory = entries
    writeRegistry(this.storage, this.userId, entries)
  }
  private snapshot(job: InternalJob): SpawnJob {
    return { id: job.id, stage: job.stage, progress: job.progress, candidates: job.candidates.map(c => ({ ...c })), refusal: job.refusal, packId: job.packId, packBaseUrl: job.packBaseUrl }
  }
  private job(jobId: string): InternalJob {
    const job = this.jobs.get(jobId)
    if (!job) throw new Error('unknown_job')
    return job
  }
  private schedule(job: InternalJob): void {
    this.cancel(job)
    if (job.stage !== 'refused' && TIMED_STAGES.includes(job.stage)) job.timer = this.timers.setTimeout(() => { job.timer = null; this.tick(job) }, this.stageMs)
  }
  private cancel(job: InternalJob): void {
    if (job.timer !== null) { this.timers.clearTimeout(job.timer); job.timer = null }
  }
  private tick(job: InternalJob): void {
    if (job.stage === 'intake') {
      if (job.refuseWith) { job.stage = 'refused'; job.refusal = job.refuseWith; job.progress = 0; return }
      job.stage = 'masters'
    } else if (job.stage === 'masters') {
      job.stage = 'pick'
      job.candidates = MASTER_CANDIDATES.map(c => ({ ...c }))
    } else if (job.stage === 'building') {
      job.stage = 'ready'
      job.packId = newPackId(this.random)
      job.packBaseUrl = this.standIn
    } else return
    job.progress = STAGE_PROGRESS[job.stage as SpawnStage]
    this.schedule(job)
  }

  /** Manual stepping for tests: the job's next timed stage now, instead of when its timer fires. Returns the job, or null for an unknown id. */
  advance(jobId: string): SpawnJob | null {
    const job = this.jobs.get(jobId)
    if (!job) return null
    this.cancel(job)
    this.tick(job)
    return this.snapshot(job)
  }

  async createJob(consent: ConsentRecord): Promise<SpawnJob> {
    if (!consentComplete(consent)) throw new Error('consent_incomplete')
    const job: InternalJob = { id: newJobId(this.random), stage: 'upload', progress: STAGE_PROGRESS.upload, candidates: [], refusal: null, packId: null, packBaseUrl: null, consent: { version: consent.version, acceptedAt: consent.acceptedAt, items: [...consent.items] }, refuseWith: null, timer: null }
    this.jobs.set(job.id, job)
    return this.snapshot(job)
  }

  async submitPhoto(jobId: string, file: PhotoLike): Promise<SpawnJob> {
    const job = this.job(jobId)
    if (job.stage !== 'upload') throw new Error('wrong_stage')
    // Only the size and the type are looked at. The bytes are never read, kept or sent.
    const size = Number(file?.size), type = typeof file?.type === 'string' ? file.type.toLowerCase() : ''
    job.refuseWith = this.refuse ?? (!PHOTO_TYPES.includes(type) ? 'not_a_photo' : !(size >= MIN_PHOTO_BYTES && size <= MAX_PHOTO_BYTES) ? 'quality' : null)
    job.stage = 'intake'
    job.progress = STAGE_PROGRESS.intake
    this.schedule(job)
    return this.snapshot(job)
  }

  async getJob(jobId: string): Promise<SpawnJob | null> {
    const job = this.jobs.get(jobId)
    return job ? this.snapshot(job) : null
  }

  async pickMaster(jobId: string, candidateId: string): Promise<SpawnJob> {
    const job = this.job(jobId)
    if (job.stage !== 'pick') throw new Error('wrong_stage')
    if (!job.candidates.some(c => c.id === candidateId)) throw new Error('unknown_candidate')
    job.stage = 'building'
    job.progress = STAGE_PROGRESS.building
    job.candidates = []
    this.schedule(job)
    return this.snapshot(job)
  }

  async listPacks(): Promise<StoredCompanionEntry[]> {
    return this.entries().map(e => ({ ...e, owner: { ...e.owner } }))
  }

  async deletePack(packId: string): Promise<EraseReceipt> {
    const entries = this.entries(), kept = entries.filter(e => e.id !== packId)
    if (kept.length !== entries.length) this.save(kept)
    return { id: packId, erased: kept.length !== entries.length }
  }

  async saveDisplayName(jobId: string, displayName: string): Promise<StoredCompanionEntry> {
    const job = this.job(jobId)
    if (job.stage !== 'ready' || !job.packId || !job.packBaseUrl) throw new Error('wrong_stage')
    const name = cleanDisplayName(displayName)
    if (name === null) throw new Error('invalid_name')
    const entries = this.entries(), at = entries.findIndex(e => e.id === job.packId)
    const entry: StoredCompanionEntry = { id: job.packId, displayName: name, packBaseUrl: job.packBaseUrl, owner: { app: 'deckster', tenantId: this.tenantId, userId: this.userId }, createdAt: at >= 0 ? entries[at].createdAt : new Date(this.now()).toISOString() }
    this.save(at >= 0 ? entries.map((e, i) => (i === at ? entry : e)) : [...entries, entry])
    return { ...entry, owner: { ...entry.owner } }
  }
}

// ---- the steps' logic, kept out of the components so the proof can drive it ----------------------------------------------------------------------

/** The screen a job is on: the stages the person waits through share one screen. */
export type SpawnView = 'upload' | 'progress' | 'pick' | 'ready' | 'refused'
export function viewOfJob(job: SpawnJob): SpawnView {
  switch (job.stage) {
    case 'refused': return 'refused'
    case 'ready': return 'ready'
    case 'pick': return 'pick'
    case 'intake': case 'masters': case 'building': return 'progress'
    default: return 'upload'
  }
}
/** "that's me": the photo is let go FIRST (spec section 4: delete the source photo when the user picks), then the pick is made. */
export function pickAndDiscard(client: SpawnClient, hold: PhotoHold, jobId: string, candidateId: string): Promise<SpawnJob> {
  hold.discard()
  return client.pickMaster(jobId, candidateId)
}
/** What the page says after a save and after a delete (the delete notice says the pack and its previews are gone, as the confirm said they would be). */
export const savedNotice = (displayName: string): string => `Saved ${displayName}.`
export const deletedNotice = (displayName: string | null): string => `${displayName ? `Deleted ${displayName}.` : 'Deleted.'} The companion's pack and its previews are deleted.`
/** The demo hook: /studio/companions?refuse=quality (or another code) makes the mock refuse the photo that way. Anything else is no refusal. */
export function refuseScenarioFrom(search: string | null | undefined): RefusalCode | null {
  const value = typeof search === 'string' ? /(?:^|[?&])refuse=([a-z_0-9]+)(?:&|$)/.exec(search)?.[1] : undefined
  return REFUSAL_CODES.find(code => code === value) ?? null
}
