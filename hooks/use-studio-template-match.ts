"use client"

// FRONTEND-2 (PK's W2 P4-7/8 rulings, 2 Nov; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, default off): the latest `template_match` frame, the auto-apply preference and the two sends, in one small store that the Director
// socket hook feeds and the badge, the rail chips, the Template picker's group, the phone sheet and the composer's check read. A store (not props) so the page, the viewer and the toolbar gain no prop: the same pattern
// as lib/studio-stage-open-gate.ts. Every decision is lib/studio-template-match.ts (pure); this file holds the state and does the I/O (the socket's send, localStorage).
//
// Studio renders from the LATEST frame and keeps no state of its own besides the preference. The preference is the user's, per user on this device (localStorage studio.templateAutoApply.v1, default ON), and is sent to
// Director on every connect (before the first user_message: the socket hook calls templateMatchSocketOpened from ws.onopen) and on each toggle. A frame of another session never shows. Flag off: every export here returns at once.
import { useCallback, useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import {
  STUDIO_TEMPLATE_MATCH_ENABLED,
  autoApplyAfterFrame,
  parseTemplateMatchFrame,
  pickerAvailable,
  pickerRows,
  readAutoApplyPreference,
  templateAutoApplyMessage,
  templateBadge,
  templateChips,
  templateSwitchMessage,
  undoFor,
  writeAutoApplyPreference,
  type TemplateBadge,
  type TemplateChip,
  type TemplateMatchFrame,
  type TemplatePickerRow,
  type TemplatePreferenceStorage,
} from "@/lib/studio-template-match"

/** What the socket hook hands over when a socket opens: how to send a frame on it, and the capabilities every message of this client advertises (template_match1 is added by the message builders). */
export interface TemplateMatchSocket {
  send: (message: unknown) => boolean
  caps: () => unknown
}

export interface StudioTemplateMatchSnapshot {
  frame: TemplateMatchFrame | null
  /** The session the frame belongs to. */
  sessionId: string | null
  badge: TemplateBadge | null
  chips: ReadonlyMap<number, TemplateChip>
  rows: readonly TemplatePickerRow[]
  /** The user's preference (the check). */
  autoApply: boolean
  /** Counts up each time Change asks the Template picker to open. */
  pickerRequest: number
  sheetOpen: boolean
}

const NONE: ReadonlyMap<number, TemplateChip> = new Map()

function browserStorage(): TemplatePreferenceStorage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null } catch { return null }
}

let user: string | null = null
let socket: TemplateMatchSocket | null = null
let snapshot: StudioTemplateMatchSnapshot = { frame: null, sessionId: null, badge: null, chips: NONE, rows: [], autoApply: true, pickerRequest: 0, sheetOpen: false }
const listeners = new Set<() => void>()
const publish = (next: StudioTemplateMatchSnapshot) => { snapshot = next; for (const listener of Array.from(listeners)) listener() }

function withFrame(frame: TemplateMatchFrame | null, sessionId: string | null): StudioTemplateMatchSnapshot {
  return { ...snapshot, frame, sessionId, badge: templateBadge(frame), chips: frame ? templateChips(frame) : NONE, rows: pickerRows(frame) }
}

/**
 * ws.onopen: a socket is open. The frame of another session is dropped, the user's preference is read, and it is sent as template_auto_apply (before any user_message can be sent on this socket).
 * Returns whether the send went out.
 */
export function templateMatchSocketOpened(input: { sessionId: string | null; userId: string | null; socket: TemplateMatchSocket }): boolean {
  if (!STUDIO_TEMPLATE_MATCH_ENABLED) return false
  user = input.userId
  socket = input.socket
  const sameSession = snapshot.sessionId === input.sessionId
  const autoApply = readAutoApplyPreference(browserStorage(), user)
  publish({ ...(sameSession ? snapshot : withFrame(null, input.sessionId)), autoApply, sessionId: input.sessionId })
  return input.socket.send(templateAutoApplyMessage(autoApply, input.socket.caps()))
}

/** The socket closed (or was replaced): nothing is sent on it again. A newer socket's hand-over is not undone. */
export function templateMatchSocketClosed(closing: TemplateMatchSocket): void {
  if (socket === closing) socket = null
}

/** A `template_match` message from Director. A frame that is not one this build reads (unknown version, malformed), or one of another session, leaves the last frame as it was. Returns whether it was taken. */
export function templateMatchFrameReceived(message: unknown, sessionId: string | null): boolean {
  if (!STUDIO_TEMPLATE_MATCH_ENABLED) return false
  if (snapshot.sessionId !== null && sessionId !== snapshot.sessionId) return false // another session's frame: nothing of it is taken, shown or written
  const frame = parseTemplateMatchFrame(message)
  if (!frame) return false
  // The frame's auto_apply is Director's session value: when it differs from the standing preference (a chat "no template" turned it off) the preference follows it, on this device and for the check; nothing is sent back and nothing is announced.
  const standing = autoApplyAfterFrame(frame, snapshot.autoApply)
  if (standing !== null) writeAutoApplyPreference(browserStorage(), user, standing)
  publish({ ...withFrame(frame, sessionId), ...(standing !== null ? { autoApply: standing } : {}) })
  return true
}

/** The user's check. Saved on this device and sent at once; the next connect sends it again. Returns whether it went out on an open socket. */
export function setTemplateAutoApply(enabled: boolean): boolean {
  if (!STUDIO_TEMPLATE_MATCH_ENABLED) return false
  const on = enabled === true
  writeAutoApplyPreference(browserStorage(), user, on)
  publish({ ...snapshot, autoApply: on })
  return socket ? socket.send(templateAutoApplyMessage(on, socket.caps())) : false
}

/** A picker or sheet action, or Undo: a template id applies it to the slides not built yet, null means no template for them (the preference is untouched). Director answers with a fresh frame. */
export function switchTemplate(templateId: string | null): boolean {
  if (!STUDIO_TEMPLATE_MATCH_ENABLED || !socket) return false
  return socket.send(templateSwitchMessage(templateId, socket.caps()))
}

/** Change on the badge: the Template picker opens. */
export function requestTemplatePicker(): void {
  if (!STUDIO_TEMPLATE_MATCH_ENABLED) return
  publish({ ...snapshot, pickerRequest: snapshot.pickerRequest + 1 })
}

export function setTemplateSheetOpen(open: boolean): void {
  if (!STUDIO_TEMPLATE_MATCH_ENABLED || snapshot.sheetOpen === open) return
  publish({ ...snapshot, sheetOpen: open })
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const read = () => snapshot

/** For the proof: the store's state, and a way back to rest. */
export const studioTemplateMatchStore = {
  getSnapshot: (): StudioTemplateMatchSnapshot => snapshot,
  reset(): void { user = null; socket = null; snapshot = { frame: null, sessionId: null, badge: null, chips: NONE, rows: [], autoApply: true, pickerRequest: 0, sheetOpen: false }; listeners.clear() },
}

/** The store, for a component. Flag off, it is the empty snapshot and nothing is subscribed to. */
export function useStudioTemplateMatch() {
  const state = useSyncExternalStore(subscribe, read, read)
  const undo = useMemo(() => undoFor(state.frame), [state.frame])
  return {
    ...state,
    undo,
    setAutoApply: useCallback((enabled: boolean) => setTemplateAutoApply(enabled), []),
    switchTemplate: useCallback((templateId: string | null) => switchTemplate(templateId), []),
  }
}

/** Whether the Template picker's "Use with this deck" group is drawn (a match with candidates, auto-apply on): then today's list is headed "Start a new presentation". */
export function useStudioTemplateGroupShown(): boolean {
  const state = useSyncExternalStore(subscribe, read, read)
  return STUDIO_TEMPLATE_MATCH_ENABLED && pickerAvailable(state.frame)
}

/** The Template picker: calls `onRequest` each time Change asks for it (not for a request made before it mounted). */
export function useStudioTemplatePickerRequest(onRequest: () => void): void {
  const request = useSyncExternalStore(subscribe, () => snapshot.pickerRequest, () => snapshot.pickerRequest)
  const seen = useRef(request)
  const latest = useRef(onRequest)
  latest.current = onRequest
  useEffect(() => {
    if (request === seen.current) return
    seen.current = request
    if (STUDIO_TEMPLATE_MATCH_ENABLED) latest.current()
  }, [request])
}
