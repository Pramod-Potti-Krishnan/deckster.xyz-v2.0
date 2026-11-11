'use client'

/**
 * KNOWLEDGE (P4-15 composer half, DARK): the state behind "Add from Google Drive" in the Builder composer.
 * Flow (UX mock D1a / D2 / D3 / D8): attach menu -> Google Picker (the existing #566 loader + /picker-token) -> POST /items (library ingest)
 * -> POST /session-links (this chat) -> chips. A chip's x unlinks only (DELETE /session-links). The linked ids go up to the page, which puts
 * them on the build message as linked_item_ids (hooks/use-deckster-websocket-v2.ts, #608, unchanged).
 * Off (either flag): every effect and action is a no-op and nothing is fetched, stored or reported up.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { openDrivePicker } from '@/lib/gdrive-picker-loader'
import { isGdriveSessionLinksEnabled, validChatSessionId } from '@/lib/connectors-gdrive-session-links'
import {
  GDRIVE_EXPIRED_TEXT, MAX_LINKED_ITEMS, chipsAfterLink, chipsFromItems, chipsLinkFailed, chipsRoom, chipsStorageKey, gdriveStartHref, linkedIdsOf,
  mergeChips, parseChips, removeChipById, requestFailure, serializeChips, takeGdriveReturn,
  type GdriveChip, type GdriveNotice, type GdriveReturnStatus, type RequestFailure,
} from '@/lib/connectors-gdrive-composer'

export interface GdriveComposerApi {
  chips: GdriveChip[]
  notices: GdriveNotice[]
  /** A pick is under way (session being made, Picker open, files being added). */
  busy: boolean
  /** D2a: Drive is not connected yet. */
  connectOpen: boolean
  /** Where Connect / Reconnect goes (back to this chat afterwards). */
  startHref: string
  /** Attach menu, "Add from Google Drive". `ensureSession` is the composer's own draft-session creator (the one the Paperclip uses). */
  addFromDrive: (ensureSession: () => Promise<void>) => void
  connect: () => void
  cancelConnect: () => void
  removeChip: (id: string) => void
  dismissNotice: (id: string) => void
}

export interface UseGdriveComposerOptions {
  sessionId: string | null
  /** The ids on the next build message: undefined = nothing linked in this chat yet, [] = the user cleared them. */
  onLinkedIdsChange: (ids: string[] | undefined) => void
  enabled?: boolean
}

const SESSION_WAIT_MS = 4000
const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

async function call(url: string, method: 'POST' | 'DELETE', body: Record<string, unknown>): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), cache: 'no-store' })
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    return { ok: res.ok, status: res.status, data }
  } catch {
    return { ok: false, status: 0, data: { error: 'Could not reach Google Drive. Check your connection and try again.' } }
  }
}

export function useGdriveComposer({ sessionId, onLinkedIdsChange, enabled = isGdriveSessionLinksEnabled() }: UseGdriveComposerOptions): GdriveComposerApi {
  const [chips, setChips] = useState<GdriveChip[]>([])
  const [notices, setNotices] = useState<GdriveNotice[]>([])
  const [busy, setBusy] = useState(false)
  const [connectOpen, setConnectOpen] = useState(false)
  const sessionRef = useRef(sessionId)
  sessionRef.current = sessionId
  const chipsRef = useRef<GdriveChip[]>([])
  const publishRef = useRef(onLinkedIdsChange)
  publishRef.current = onLinkedIdsChange
  const busyRef = useRef(false)
  const noticeSeq = useRef(0)
  const returnRef = useRef<{ status: GdriveReturnStatus | null; handled: boolean } | null>(null)

  const pushNotice = useCallback((notice: Omit<GdriveNotice, 'id'>) => {
    const id = `n${++noticeSeq.current}`
    setNotices(current => [...current.filter(n => n.text !== notice.text), { ...notice, id }])
  }, [])
  const dismissNotice = useCallback((id: string) => setNotices(current => current.filter(n => n.id !== id)), [])

  /** The one place the chips change: state, this chat's memory, and the ids the build message will carry. */
  const commit = useCallback((next: GdriveChip[], sid: string) => {
    if (sessionRef.current !== sid) return // the user moved to another chat meanwhile
    chipsRef.current = next
    setChips(next)
    try { window.sessionStorage.setItem(chipsStorageKey(sid), serializeChips(next)) } catch { /* private mode: the chips still work for this page */ }
    publishRef.current(linkedIdsOf(next))
  }, [])

  const fail = useCallback((failure: RequestFailure) => {
    if (failure.kind === 'not_connected') setConnectOpen(true) // D2a
    else if (failure.kind === 'expired') pushNotice({ tone: 'warn', text: failure.message, action: 'reconnect' }) // D8a
    else pushNotice({ tone: 'error', text: failure.message })
  }, [pushNotice])

  // A chat's chips come back with the chat (reload, switching chats). Nothing stored = nothing linked = no key on the message.
  useEffect(() => {
    if (!enabled) return
    let stored: GdriveChip[] | null = null
    if (sessionId) { try { stored = parseChips(window.sessionStorage.getItem(chipsStorageKey(sessionId))) } catch { stored = null } }
    chipsRef.current = stored ?? []
    setChips(chipsRef.current)
    setNotices([])
    publishRef.current(stored ? linkedIdsOf(stored) : undefined)
  }, [sessionId, enabled])

  /** Picker -> library -> this chat. Caller holds the busy flag. */
  const pickAndLink = useCallback(async (sid: string) => {
    const room = chipsRoom(chipsRef.current)
    if (room === 0) { pushNotice({ tone: 'warn', text: `A chat can link up to ${MAX_LINKED_ITEMS} Drive files.` }); return }
    let picked: string[]
    try { picked = await openDrivePicker() } catch (e) {
      const code = (e as { code?: unknown } | null)?.code
      if (code === 'CONNECTOR_NOT_CONNECTED') setConnectOpen(true)
      else if (code === 'CONNECTOR_GRANT_REVOKED') pushNotice({ tone: 'warn', text: GDRIVE_EXPIRED_TEXT, action: 'reconnect' })
      else pushNotice({ tone: 'error', text: e instanceof Error && e.message ? e.message : 'Could not open Google Drive. Please try again.' })
      return
    }
    const ids = [...new Set(picked)]
    if (!ids.length) return // cancelled in the Picker
    const take = ids.slice(0, room)
    if (take.length < ids.length) pushNotice({ tone: 'warn', text: `Added ${take.length} of ${ids.length}: a chat can link up to ${MAX_LINKED_ITEMS} Drive files.` })

    const added = await call('/api/connectors/gdrive/items', 'POST', { file_ids: take })
    if (sessionRef.current !== sid) return
    if (!added.ok) { fail(requestFailure(added.status, added.data)); return }
    const waiting = chipsFromItems(take, Array.isArray(added.data.items) ? added.data.items : [])
    commit(mergeChips(chipsRef.current, waiting), sid)
    const toLink = waiting.filter(c => c.state === 'linking').map(c => c.id)
    if (!toLink.length) return // every file was refused: the error chips say why (D8b / D8c)

    const linked = await call('/api/connectors/gdrive/session-links', 'POST', { session_id: sid, item_ids: toLink })
    if (sessionRef.current !== sid) return
    if (!linked.ok) {
      commit(chipsLinkFailed(chipsRef.current), sid)
      fail(requestFailure(linked.status, linked.data))
      return
    }
    commit(chipsAfterLink(chipsRef.current, linked.data), sid)
  }, [commit, fail, pushNotice])

  const runExclusive = useCallback(async (fn: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try { await fn() } finally { busyRef.current = false; setBusy(false) }
  }, [])

  const addFromDrive = useCallback((ensureSession: () => Promise<void>) => {
    if (!enabled) return
    void runExclusive(async () => {
      try { await ensureSession() } catch { pushNotice({ tone: 'error', text: 'Could not start this chat. Please try again.' }); return }
      const deadline = Date.now() + SESSION_WAIT_MS
      while (!validChatSessionId(sessionRef.current) && Date.now() < deadline) await sleep(60)
      const sid = sessionRef.current
      if (!validChatSessionId(sid)) { pushNotice({ tone: 'error', text: 'Could not start this chat. Please try again.' }); return }
      await pickAndLink(sid)
    })
  }, [enabled, runExclusive, pushNotice, pickAndLink])

  // D2c: back from Google (?gdrive=connected on this chat's URL): say so and open the Picker. The param is taken off the address bar at once, so a reload does not repeat it.
  useEffect(() => {
    if (!enabled) return
    if (!returnRef.current) {
      const { status, search } = takeGdriveReturn(window.location.search)
      returnRef.current = { status, handled: status === null }
      if (status !== null || search !== window.location.search) window.history.replaceState(null, '', `${window.location.pathname}${search}${window.location.hash}`)
    }
    const pending = returnRef.current
    if (pending.handled || !validChatSessionId(sessionId)) return
    pending.handled = true
    if (pending.status === 'connected') {
      pushNotice({ tone: 'info', text: 'Google Drive connected. Opening Picker…' })
      void runExclusive(() => pickAndLink(sessionId))
    } else if (pending.status === 'cancelled') pushNotice({ tone: 'info', text: 'Google Drive was not connected.' })
    else pushNotice({ tone: 'warn', text: "Couldn't connect Google Drive. Please try again.", action: 'reconnect' })
  }, [enabled, sessionId, pushNotice, runExclusive, pickAndLink])

  // The "connected" line is a toast, not a state: it goes by itself.
  useEffect(() => {
    if (!notices.some(n => n.tone === 'info')) return
    const timer = setTimeout(() => setNotices(current => current.filter(n => n.tone !== 'info')), 6000)
    return () => clearTimeout(timer)
  }, [notices])

  const removeChip = useCallback((id: string) => {
    const sid = sessionRef.current
    const chip = chipsRef.current.find(c => c.id === id)
    if (!enabled || !chip || !sid || chip.state === 'linking') return
    const before = chipsRef.current
    commit(removeChipById(before, id), sid)
    if (chip.state !== 'linked') return // an error chip was never linked: dismissing it is local
    void (async () => {
      const res = await call('/api/connectors/gdrive/session-links', 'DELETE', { session_id: sid, item_ids: [id] })
      if (res.ok || sessionRef.current !== sid) return
      const now = chipsRef.current.filter(c => c.id !== id) // the unlink failed: the file is still linked, so the chip comes back where it was
      now.splice(Math.min(before.findIndex(c => c.id === id), now.length), 0, chip)
      commit(now, sid)
      fail(requestFailure(res.status, res.data))
    })()
  }, [enabled, commit, fail])

  const startHref = gdriveStartHref(sessionId)
  const connect = useCallback(() => { setConnectOpen(false); window.location.assign(gdriveStartHref(sessionRef.current)) }, [])
  const cancelConnect = useCallback(() => setConnectOpen(false), [])

  return { chips, notices, busy, connectOpen, startHref, addFromDrive, connect, cancelConnect, removeChip, dismissNotice }
}
