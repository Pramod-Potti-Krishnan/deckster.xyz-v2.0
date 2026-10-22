/**
 * VERSION-HISTORY-V2 (flag NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2, exact "true", default off). Pass 2 row PRO-09: the deck's Version history, opened from the profile menu.
 *
 * What was broken (checked against Layout uat d86814a, viewer/presentation-viewer.html, the message handler):
 *   1. Nothing opened the panel: showVersionHistory in components/presentation-viewer.tsx is never set true.
 *   2. The panel posted {command: 'getVersionHistory'}. The viewer reads {action, params, requestId} ("if (!action) return"), so the list request and the restore request were ignored.
 *   3. The panel read the reply's `command`. The viewer answers with `action` (and echoes `requestId`), so even a reply would not have been recognised.
 * With the flag on, components/version-history-panel-v2.tsx sends the envelope the viewer reads, matches the reply by action + requestId, and the profile menu opens it
 * (versionHistoryBridge: the viewer registers the opener while a deck is on screen, the menu item shows only then, so it is absent on the library pages).
 *
 * Restore never overwrites. restoreVersionSafely: (1) the current deck is saved first, including edits still pending in the canvas, and the restore is not sent unless that is shown to
 * have worked; (2) the restore command always asks Layout for its backup (createBackup: true, not a parameter), and Layout saves the stored deck as a NEW version before it
 * replaces anything (storage.restore_version: the backup is written first; if it cannot be written the restore does not run); (3) any failure stops with a message and the list stays as it is.
 * Layout only answers success:true for a restore once both steps are done. Its restore reply carries no backup version id, so the panel reads the list again afterwards and names the safety copy it finds.
 *
 * Flag off: nothing in this file runs and the old (unreachable) panel behaves exactly as before.
 *
 * Pure, no imports: the test loads this file on its own.
 */
export const STUDIO_VERSION_HISTORY_V2_ENABLED = process.env.NEXT_PUBLIC_STUDIO_VERSION_HISTORY_V2 === 'true'

/** The list is one small GET behind the viewer; a cold Layout can take a few seconds. */
export const VERSION_HISTORY_FETCH_TIMEOUT_MS = 15_000
/** A restore waits for the viewer's own save of what is pending, then the backup, then the restore, so it gets the longest budget of the viewer commands. */
export const VERSION_RESTORE_TIMEOUT_MS = 60_000
/** Every mutation creates a version, so a busy deck has many: the panel shows the newest few and offers the rest on request. */
export const VERSION_PAGE_SIZE = 40

// ---------------------------------------------------------------- the envelope the viewer reads

export interface ViewerRequest {
  action: string
  params: Record<string, unknown>
}

/** The list of the deck on screen (no presentationId: the viewer uses its own, so the list and the restore are always about the deck that is loaded and that its save guard watches). */
export function getVersionHistoryRequest(): ViewerRequest {
  return { action: 'getVersionHistory', params: {} }
}

/** Always with Layout's backup; there is deliberately no way to ask for a restore without it. reload: the viewer reloads itself onto the restored deck. */
export function restoreVersionRequest(versionId: string): ViewerRequest {
  if (typeof versionId !== 'string' || versionId.trim() === '') throw new Error('A version id is required')
  return { action: 'restoreVersion', params: { versionId, createBackup: true, reload: true } }
}

// ---------------------------------------------------------------- the list

export interface VersionRow {
  versionId: string
  createdAt: string
  createdBy: string
  changeSummary: string | null
}

export interface VersionHistory {
  versions: VersionRow[]
  currentVersionId: string
}

export type VersionHistoryParse = { ok: true; history: VersionHistory } | { ok: false; message: string }

export const VERSION_HISTORY_FAILED_MESSAGE = 'The version history could not be loaded.'

function timeOf(iso: string): number {
  const time = Date.parse(iso)
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/** The viewer's getVersionHistory reply ({success, versions: [{version_id, created_at, created_by, change_summary}], currentVersionId}) as rows, newest first. */
export function parseVersionHistoryReply(reply: unknown): VersionHistoryParse {
  const data = reply as { success?: unknown; error?: unknown; versions?: unknown; currentVersionId?: unknown } | null | undefined
  if (!data || data.success !== true) {
    const detail = data && typeof data.error === 'string' ? data.error.trim() : ''
    return { ok: false, message: detail || VERSION_HISTORY_FAILED_MESSAGE }
  }
  const rows: VersionRow[] = []
  if (Array.isArray(data.versions)) {
    for (const raw of data.versions) {
      const row = raw as { version_id?: unknown; created_at?: unknown; created_by?: unknown; change_summary?: unknown } | null
      if (!row || typeof row.version_id !== 'string' || row.version_id === '') continue
      rows.push({
        versionId: row.version_id,
        createdAt: typeof row.created_at === 'string' ? row.created_at : '',
        createdBy: typeof row.created_by === 'string' ? row.created_by : '',
        changeSummary: typeof row.change_summary === 'string' && row.change_summary.trim() ? row.change_summary.trim() : null,
      })
    }
  }
  const ordered = rows.map((row, index) => ({ row, index })).sort((a, b) => timeOf(b.row.createdAt) - timeOf(a.row.createdAt) || a.index - b.index).map(entry => entry.row)
  return { ok: true, history: { versions: ordered, currentVersionId: typeof data.currentVersionId === 'string' ? data.currentVersionId : '' } }
}

/** "Just now", "5m ago", "3h ago", "2d ago", then the date. `now` is a parameter so the words are testable. */
export function formatVersionTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  if (!iso || Number.isNaN(date.getTime())) return 'Unknown time'
  const diffMs = now.getTime() - date.getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMs / 3_600_000)
  const days = Math.floor(diffMs / 86_400_000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** Who made the version, in words. Layout writes 'user' for every edit made on the user's behalf, 'system' for its own safety copies. */
export function versionAuthorLabel(createdBy: string): string {
  switch (createdBy) {
    case 'user': return 'Your edit'
    case 'auto-save': return 'Auto-saved'
    case 'system': return 'Safety copy'
    case 'restore': return 'Restored backup'
    case '': return 'Deckster'
    default: {
      const words = createdBy.replace(/[_-]+/g, ' ').trim()
      return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Deckster'
    }
  }
}

/** The one line under the time. Layout's own pre-restore safety copy ("Pre-restore backup before reverting to v_...") says what it is without the internal id. */
export function versionSummary(row: VersionRow): string | null {
  if (row.changeSummary && /^pre-restore backup\b/i.test(row.changeSummary)) return 'Saved automatically before a restore'
  return row.changeSummary
}

export const RESTORED_NOTICE = 'Version restored.'
/** Between Layout's answer and the viewer's reload the old document is still on screen (14-20 s on the UAT Layout); an edit made in it must not be made. */
export const RESTORED_RELOADING_NOTICE = 'Version restored. Your deck is reloading onto it: wait for it before editing.'

/** The line shown once the list has been read again after a restore and Layout's safety copy is in it. */
export function restoredNoticeWithBackup(backup: VersionRow, now: Date = new Date()): string {
  return `Version restored. Your previous deck is saved as a version from ${formatVersionTime(backup.createdAt, now)}.`
}

/** Layout's words for the version it stores before a restore: f"Pre-restore backup before reverting to {version_id}" (storage_supabase.py restore_version). */
const PRE_RESTORE_SUMMARY_PREFIX = 'Pre-restore backup before reverting to '

/** The safety copy Layout wrote for a restore: a version that was not in the list before, made by 'system', whose summary names the restored version. */
export function findPreRestoreBackup(before: readonly VersionRow[], after: readonly VersionRow[], restoredVersionId: string): VersionRow | null {
  const known = new Set(before.map(row => row.versionId))
  for (const row of after) {
    if (known.has(row.versionId) || row.createdBy !== 'system') continue
    if (restoredVersionId && row.changeSummary && row.changeSummary.endsWith(`${PRE_RESTORE_SUMMARY_PREFIX}${restoredVersionId}`)) return row
  }
  return null
}

// ---------------------------------------------------------------- restore: the current deck is saved first, then restored, and any failure stops here

export type SaveCurrentResult = { ok: true } | { ok: false; message: string }
export type RestoreSendResult = { ok: true } | { ok: false; message: string; unconfirmed?: boolean }
export type RestoreOutcome =
  | { ok: true }
  | { ok: false; stage: 'save' | 'restore' | 'unconfirmed'; message: string }
export type RestorePhase = 'saving' | 'restoring'

export const RESTORE_SAVE_FAILED_MESSAGE = 'Your latest edits could not be saved first, so the version was not restored. Try again.' // the words of the slide-ops helper's RESTORE_NOT_SAVED_MESSAGE (the flush it shares); the test pins them equal
export const RESTORE_FAILED_MESSAGE = 'The version was not restored. Check your slides, then try again.'
export const RESTORE_NOT_FOUND_MESSAGE = 'The version was not restored. It may no longer exist, or your current deck could not be saved as a version first. Refresh the list and try again.'
export const RESTORE_UNCONFIRMED_MESSAGE = 'The restore could not be confirmed. Check your slides before trying again.'

/**
 * The words for a restore the viewer refused. Layout's restore answers 404 "Version ... not found" both for a version that is gone and for a safety copy that could not be written
 * (nothing is replaced in either case), and its save guard answers "Unsaved edits could not be saved, so the slide was not changed" when the pending edits would not save.
 */
export function restoreFailureMessage(detail: unknown): string {
  const text = typeof detail === 'string' ? detail : ''
  if (/unsaved edits|could not be saved/i.test(text)) return RESTORE_SAVE_FAILED_MESSAGE
  if (/not found/i.test(text)) return RESTORE_NOT_FOUND_MESSAGE
  return RESTORE_FAILED_MESSAGE
}

/**
 * The viewer's answer to restoreVersion as the result restoreVersionSafely reads. `ack` resolves on success:true and rejects with the viewer's error text, or "Command timeout" when no
 * answer came (the restore may still have happened: that is its own outcome, not a failure).
 */
export function restoreResultFromAck(ack: Promise<unknown>): Promise<RestoreSendResult> {
  return ack.then(
    (): RestoreSendResult => ({ ok: true }),
    (error: unknown): RestoreSendResult => {
      const detail = error instanceof Error ? error.message : ''
      if (/command timeout/i.test(detail)) return { ok: false, unconfirmed: true, message: RESTORE_UNCONFIRMED_MESSAGE }
      return { ok: false, message: restoreFailureMessage(detail) }
    },
  )
}

/**
 * The viewer reloaded itself while the restore was in flight, so its answer may be lost. A reload alone proves nothing (a frame can load for other reasons): the proof is the safety copy
 * Layout writes before it restores, so the list read from the reloaded viewer must hold a version that was not there before and names the restored one. Without it the outcome is unconfirmed.
 */
export function restoreResultFromList(before: readonly VersionRow[], reply: unknown, restoredVersionId: string): RestoreSendResult {
  const parsed = parseVersionHistoryReply(reply)
  if (parsed.ok && findPreRestoreBackup(before, parsed.history.versions, restoredVersionId)) return { ok: true }
  return { ok: false, unconfirmed: true, message: RESTORE_UNCONFIRMED_MESSAGE }
}

/**
 * Restore one version without ever overwriting the deck as it is now.
 *   1. saveCurrent: the current deck is saved, edits still pending in the canvas included. The restore is not sent unless it resolves { ok: true }; a rejection counts as a failure.
 *   2. sendRestore: only then, with restoreVersionRequest (which always asks for Layout's backup). A refusal or an answer that never came is a message, not a retry.
 * Nothing is retried and nothing is sent after a failure; the caller shows `message` and leaves the list as it is.
 */
export async function restoreVersionSafely(deps: {
  versionId: string
  /** Makes sure everything pending is stored (the viewer's forceSave, then its own "saved, nothing pending" message). */
  saveCurrent: () => Promise<SaveCurrentResult>
  /** Sends the viewer command and resolves with what came of it. */
  sendRestore: (request: ViewerRequest) => Promise<RestoreSendResult>
  onPhase?: (phase: RestorePhase) => void
}): Promise<RestoreOutcome> {
  const { versionId, saveCurrent, sendRestore, onPhase } = deps
  let request: ViewerRequest
  try {
    request = restoreVersionRequest(versionId)
  } catch {
    return { ok: false, stage: 'restore', message: RESTORE_FAILED_MESSAGE }
  }
  onPhase?.('saving')
  let saved: SaveCurrentResult
  try {
    saved = await saveCurrent()
  } catch {
    saved = { ok: false, message: RESTORE_SAVE_FAILED_MESSAGE }
  }
  if (!saved || saved.ok !== true) {
    return { ok: false, stage: 'save', message: (saved && saved.message) || RESTORE_SAVE_FAILED_MESSAGE }
  }
  onPhase?.('restoring')
  let sent: RestoreSendResult
  try {
    sent = await sendRestore(request)
  } catch {
    sent = { ok: false, unconfirmed: true, message: RESTORE_UNCONFIRMED_MESSAGE }
  }
  if (sent && sent.ok === true) return { ok: true }
  if (sent && sent.unconfirmed === true) return { ok: false, stage: 'unconfirmed', message: sent.message || RESTORE_UNCONFIRMED_MESSAGE }
  return { ok: false, stage: 'restore', message: (sent && sent.message) || RESTORE_FAILED_MESSAGE }
}

/** Why Restore is switched off right now (null = it is available). A deck that is still being built is written by the build, not only by the user. */
export function restoreBlockedReason(input: { building: boolean }): string | null {
  return input.building ? 'Restore is available when your deck has finished building.' : null
}

// ---------------------------------------------------------------- the profile menu's way in

export interface VersionHistoryBridge {
  /** The viewer says "I can open the panel of the deck on screen". The newest registration wins; the returned function takes it back. */
  register(open: () => void): () => void
  /** The profile menu asks for it. false = no deck is on screen. */
  open(): boolean
  isAvailable(): boolean
  subscribe(listener: () => void): () => void
}

export function createVersionHistoryBridge(): VersionHistoryBridge {
  let opener: (() => void) | null = null
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of Array.from(listeners)) {
      try { listener() } catch { /* a listener never breaks the viewer */ }
    }
  }
  return {
    register(open) {
      opener = open
      notify()
      return () => {
        if (opener !== open) return
        opener = null
        notify()
      }
    },
    open() {
      if (!opener) return false
      opener()
      return true
    },
    isAvailable: () => opener !== null,
    subscribe(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
  }
}

export const versionHistoryBridge: VersionHistoryBridge = createVersionHistoryBridge()
