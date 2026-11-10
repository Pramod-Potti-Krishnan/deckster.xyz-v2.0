// PASS2-PK-FOUR item 4 (frontend-2): which uploads have a template workspace, in this tab. Flag NEXT_PUBLIC_STUDIO_TEMPLATE_WORKSPACE.
//
// The upload dialog stages a small handoff (`deckster_template_workspace_handoff_<session id>`, beside the existing ingest intent) when
// it opens the builder; the workspace adopts it into this per-account list. sessionStorage only, like the ingest keys: the job itself
// runs on the server, so closing the tab loses nothing but this list.
// TODO(Director, contract §7.1 `jobs`): once Director lists non-terminal template jobs, read that list instead of this one, so the
// library card and the picker also work across tabs and devices.

export const TEMPLATE_WORKSPACE_HANDOFF_PREFIX = 'deckster_template_workspace_handoff_'
const LIST_PREFIX = 'deckster_template_workspace_'
const MAX_RECORDS = 12

export interface TemplateWorkspaceRecord {
  v: 1
  /** The builder session the upload dialog minted; the ingest job belongs to it. */
  session_id: string
  file_name: string
  file_size: number
  /** When the dialog handed off (ms since epoch). */
  created_at: number
  /** The user left the workspace for the plain builder (Edit, once the template is ready). */
  closed?: boolean
  /** The "Template ready" moment was dismissed. */
  ready_seen?: boolean
  /** The "Template ready" toast was shown or dismissed. */
  toast_seen?: boolean
  /** Long decks: the user chose to be notified rather than watch. */
  watch?: 'notify' | 'stay'
}

const listKey = (userKey: string) => `${LIST_PREFIX}${encodeURIComponent(userKey)}`

function storage(): Storage | null {
  try { return typeof window === 'undefined' ? null : window.sessionStorage } catch { return null }
}

function isRecord(value: unknown): value is TemplateWorkspaceRecord {
  if (!value || typeof value !== 'object') return false
  const r = value as Record<string, unknown>
  return r.v === 1 && typeof r.session_id === 'string' && r.session_id.length > 0 && r.session_id.length <= 200
    && typeof r.file_name === 'string' && r.file_name.length > 0 && typeof r.file_size === 'number' && Number.isFinite(r.file_size)
    && typeof r.created_at === 'number' && Number.isFinite(r.created_at)
}

let version = 0
const listeners = new Set<() => void>()
const notify = () => { version += 1; listeners.forEach(listener => listener()) }

export function subscribeTemplateWorkspaceRecords(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function templateWorkspaceRecordsVersion(): number {
  return version
}

export function readTemplateWorkspaceRecords(userKey: string): TemplateWorkspaceRecord[] {
  const store = storage()
  if (!store || !userKey) return []
  try {
    const parsed = JSON.parse(store.getItem(listKey(userKey)) || '[]')
    return Array.isArray(parsed) ? parsed.filter(isRecord) : []
  } catch { return [] }
}

function write(userKey: string, records: TemplateWorkspaceRecord[]) {
  const store = storage()
  if (!store || !userKey) return
  try { store.setItem(listKey(userKey), JSON.stringify(records.slice(0, MAX_RECORDS))) } catch { /* storage full or blocked: the workspace still works for this page */ }
  notify()
}

/** Adopts the upload dialog's handoff for `sessionId` (once), and returns that session's record, if any. */
export function adoptTemplateWorkspaceHandoff(userKey: string, sessionId: string | null | undefined): TemplateWorkspaceRecord | null {
  const store = storage()
  if (!store || !userKey || !sessionId) return null
  const records = readTemplateWorkspaceRecords(userKey)
  const existing = records.find(record => record.session_id === sessionId)
  let raw: string | null = null
  try { raw = store.getItem(`${TEMPLATE_WORKSPACE_HANDOFF_PREFIX}${sessionId}`) } catch { raw = null }
  if (!raw) return existing ?? null
  try { store.removeItem(`${TEMPLATE_WORKSPACE_HANDOFF_PREFIX}${sessionId}`) } catch { /* ignore */ }
  if (existing) return existing
  let handoff: unknown = null
  try { handoff = JSON.parse(raw) } catch { handoff = null }
  const candidate = handoff && typeof handoff === 'object' ? { ...(handoff as object), session_id: sessionId } : null
  if (!isRecord(candidate)) return null
  const record: TemplateWorkspaceRecord = { v: 1, session_id: sessionId, file_name: candidate.file_name.slice(0, 260), file_size: candidate.file_size, created_at: candidate.created_at }
  write(userKey, [record, ...records.filter(item => item.session_id !== sessionId)])
  return record
}

export function updateTemplateWorkspaceRecord(userKey: string, sessionId: string, patch: Partial<Pick<TemplateWorkspaceRecord, 'closed' | 'ready_seen' | 'toast_seen' | 'watch'>>): void {
  const records = readTemplateWorkspaceRecords(userKey)
  const at = records.findIndex(record => record.session_id === sessionId)
  if (at < 0) return
  const next = { ...records[at], ...patch }
  if (JSON.stringify(next) === JSON.stringify(records[at])) return
  records[at] = next
  write(userKey, records)
}

/** "Tidewell-QBR-master-2026.pptx" -> "Tidewell QBR master 2026": the name shown until the server names the template. */
export function templateNameFromFile(fileName: string): string {
  const base = fileName.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
  return base || 'Uploaded template'
}

// ── the active workspace, mirrored for the top bar (which renders in another subtree) ────────────────────────────────────

export interface TemplateWorkspaceHeaderModel {
  userKey: string
  sessionId: string
  /** The builder's own "+ New deck" handler is kept; these are the workspace's. */
  onLeave: () => void
}

let activeHeader: TemplateWorkspaceHeaderModel | null = null
const headerListeners = new Set<() => void>()

export function publishTemplateWorkspaceHeader(next: TemplateWorkspaceHeaderModel | null): void {
  if (next === activeHeader || (next && activeHeader && next.sessionId === activeHeader.sessionId && next.userKey === activeHeader.userKey && next.onLeave === activeHeader.onLeave)) return
  activeHeader = next
  headerListeners.forEach(listener => listener())
}

export function subscribeTemplateWorkspaceHeader(listener: () => void): () => void {
  headerListeners.add(listener)
  return () => { headerListeners.delete(listener) }
}

export function getTemplateWorkspaceHeader(): TemplateWorkspaceHeaderModel | null {
  return activeHeader
}
