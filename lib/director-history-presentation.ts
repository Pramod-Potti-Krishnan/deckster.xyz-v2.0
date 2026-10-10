import type { DirectorMessage, ActionRequest } from '@/hooks/use-deckster-websocket-v2'
import type { DirectorTranscriptEntry } from '@/lib/director-transcript'
import { directorHistoryTimestamp } from '@/lib/director-chat-history'
import { STUDIO_ASK_CARD_IDENTITY_ENABLED, isApprovalGate, isAskAnswered } from '@/lib/director-ask-identity'

const transportFields = new Set(['preview_url', 'presentation_url', 'url', 'preview_presentation_id', 'presentation_id'])

// Compare all outline data, including unknown additive contract fields. Only
// viewer transport aliases are excluded; revisions are never prose-deduped.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
    .filter(([, item]) => item !== undefined).map(([key, item]) => [key, canonical(item)]))
}

function outlineIdentity(message: DirectorMessage): { presentationId: string; content: string } | null {
  if (message.type !== 'slide_update') return null
  const payload = message.payload as Record<string, any>
  if (!payload || typeof payload !== 'object') return null
  if (payload.is_blank || payload.operation !== 'full_update' || !Array.isArray(payload.slides) || !payload.slides.length) return null
  const presentationId = payload.metadata?.preview_presentation_id || payload.preview_presentation_id
    || payload.strawman?.preview_presentation_id || payload.presentation_id
  if (typeof presentationId !== 'string' || !presentationId.trim()) return null
  const content = Object.fromEntries(Object.entries(payload).filter(([key]) => !transportFields.has(key))
    .map(([key, value]) => [key, (key === 'metadata' || key === 'strawman') && value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([field]) => !transportFields.has(field))) : value]))
  return { presentationId, content: JSON.stringify(canonical(content)) }
}

// The native completed reconnect reconstructs narrative from saved notes, or
// this exact fallback. This relates two preserved versions; it never equates
// their different narratives or discards an additive/structural change.
function isTerminalNarrativeRevision(previous: DirectorMessage, current: DirectorMessage): boolean {
  if (!outlineIdentity(previous) || !outlineIdentity(current)) return false
  const before = previous.payload as Record<string, any>, after = current.payload as Record<string, any>
  if (before.slides.length !== after.slides.length) return false
  let changed = false
  for (let index = 0; index < before.slides.length; index++) {
    const oldSlide = before.slides[index], newSlide = after.slides[index]
    if (oldSlide.narrative === newSlide.narrative) continue
    if (typeof oldSlide.narrative !== 'string' || !oldSlide.narrative.trim()
      || newSlide.narrative !== `Key content about ${newSlide.title}`) return false
    changed = true
  }
  const withoutNarratives = (message: DirectorMessage) => outlineIdentity({ ...message,
    payload: { ...(message.payload as any), slides: (message.payload as any).slides.map((slide: any) => ({ ...slide, narrative: undefined })) },
  })?.content
  return changed && withoutNarratives(previous) === withoutNarratives(current)
}

export type OutlineHistoryStatus = 'earlier' | 'current'
type PresentedEntry = DirectorTranscriptEntry & { clientOutlineHistoryStatus?: OutlineHistoryStatus }

/** Validate projected revision provenance against the actual sorted user-turn
 * segment. Keep both payloads and mark only presentation; uncertain copies
 * stay independently expanded. Never accept a supplied presentation status. */
export function presentTerminalOutlineRevisions(entries: DirectorTranscriptEntry[]): PresentedEntry[] {
  const originals = new Map<string, { message: DirectorMessage; index: number; userTurn: number }>()
  const statuses = new Map<number, OutlineHistoryStatus>()
  let userTurn = 0
  entries.forEach((entry, index) => {
    if (entry.messageType === 'user') { userTurn++; return }
    const prior = originals.get((entry as DirectorMessage & { clientTerminalOutlineRevisionOf?: string }).clientTerminalOutlineRevisionOf || '')
    const time = directorHistoryTimestamp(entry.timestamp)
    if (prior && prior.userTurn === userTurn && prior.message.session_id === entry.session_id
      && Number.isFinite(time) && Number.isFinite(directorHistoryTimestamp(prior.message.timestamp))
      && time > directorHistoryTimestamp(prior.message.timestamp)
      && isTerminalNarrativeRevision(prior.message, entry)) {
      statuses.set(prior.index, 'earlier'); statuses.set(index, 'current')
    }
    if (outlineIdentity(entry)) originals.set(entry.message_id, { message: entry, index, userTurn })
  })
  return entries.map((entry, index) => {
    const clean = { ...entry } as PresentedEntry
    delete clean.clientOutlineHistoryStatus
    if (statuses.has(index)) clean.clientOutlineHistoryStatus = statuses.get(index)
    return clean
  })
}

/** A full-update frame is idempotent state only within the same artifact and
 * user-turn segment. Preserve uncertain copies, changed fields and new turns. */
export function coalesceOutlineStateReplays(entries: DirectorTranscriptEntry[]): DirectorTranscriptEntry[] {
  const seen = new Set<string>()
  const originals = new Map<string, { sessionId: string; userTurn: number; content: string }>()
  let userTurn = 0
  return entries.filter(entry => {
    if (entry.messageType === 'user') { userTurn++; return true }
    const identity = outlineIdentity(entry)
    if (!identity || !entry.session_id || !Number.isFinite(directorHistoryTimestamp(entry.timestamp))) return true
    const prior = originals.get((entry as DirectorMessage & { clientOutlineReplayOf?: string }).clientOutlineReplayOf || '')
    originals.set(entry.message_id, { sessionId: entry.session_id, userTurn, content: identity.content })
    if (prior?.sessionId === entry.session_id && prior.userTurn === userTurn && prior.content === identity.content) return false
    const key = JSON.stringify([entry.session_id, userTurn, identity.presentationId, identity.content])
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export interface OutlineReplayOwnership {
  isTerminal: boolean
  socketSessionId: string | null
  displayedSessionId: string | null
  deckOwnerSessionId: string | null
  finalPresentationId: string | null
  finalPresentationUrl: string | null
}

/** Called only by the WS owner with current trusted state. Project a client
 * annotation onto the accepted transcript copy; raw callbacks stay unmarked.
 * Never honor an annotation supplied by wire/DB input. */
export function projectVerifiedOutlineReplay<T extends DirectorMessage>(
  message: T,
  previousMessages: readonly DirectorMessage[],
  owner: OutlineReplayOwnership,
): T & { clientOutlineReplayOf?: string; clientTerminalOutlineRevisionOf?: string } {
  const clean = { ...message } as T & { clientOutlineReplayOf?: string; clientTerminalOutlineRevisionOf?: string }
  delete clean.clientOutlineReplayOf
  delete clean.clientTerminalOutlineRevisionOf
  const identity = outlineIdentity(clean)
  const payload = (clean.payload || {}) as Record<string, any>
  const previewUrl = payload.preview_url || payload.metadata?.preview_url || payload.strawman?.preview_url || payload.url
  if (!identity || !owner.isTerminal || !owner.displayedSessionId
    || owner.socketSessionId !== owner.displayedSessionId || owner.deckOwnerSessionId !== owner.displayedSessionId
    || clean.session_id !== owner.displayedSessionId || identity.presentationId !== owner.finalPresentationId
    || !owner.finalPresentationUrl || previewUrl !== owner.finalPresentationUrl) return clean
  let currentTurnStart = 0
  previousMessages.forEach((candidate, index) => {
    if (candidate.type === 'chat_message' && (candidate as DirectorMessage & { role?: string }).role === 'user'
      && candidate.session_id === clean.session_id) currentTurnStart = index + 1
  })
  const currentTurn = previousMessages.slice(currentTurnStart)
  const previous = [...currentTurn].reverse().find(candidate => candidate.message_id !== clean.message_id
    && candidate.session_id === clean.session_id && outlineIdentity(candidate)?.content === identity.content)
  if (previous) return { ...clean, clientOutlineReplayOf: previous.message_id }
  const time = directorHistoryTimestamp(clean.timestamp)
  const revision = [...currentTurn].reverse().find(candidate => candidate.message_id !== clean.message_id
    && candidate.session_id === clean.session_id && Number.isFinite(time)
    && Number.isFinite(directorHistoryTimestamp(candidate.timestamp)) && time > directorHistoryTimestamp(candidate.timestamp)
    && isTerminalNarrativeRevision(candidate, clean))
  return revision ? { ...clean, clientTerminalOutlineRevisionOf: revision.message_id } : clean
}

export type HistoricalActionStatus = 'answered' | 'earlier'

/** Reload fix R1/R2 (RUN-1 J1). Exact "true" enables it; default off, and then every status below is exactly today's. */
export const STUDIO_HISTORY_ACTION_STATUS_ENABLED = process.env.NEXT_PUBLIC_STUDIO_HISTORY_ACTION_STATUS_ENABLED === 'true'

/** A user turn of the transcript (a `UserChatMessage` fits). `timestamp` is epoch ms. */
export interface HistoricalUserTurn {
  readonly text?: string
  readonly timestamp?: number
}

// The transcript orders a Director frame by its client arrival time when it has one (a replayed gate is re-stamped
// on arrival, so it sorts after the turns that preceded the replay), else by its own timestamp.
function transcriptTime(message: DirectorMessage): number {
  const arrival = (message as DirectorMessage & { clientTimestamp?: unknown }).clientTimestamp
  return typeof arrival === 'number' && Number.isFinite(arrival) ? arrival : directorHistoryTimestamp(message.timestamp)
}

function userReplies(messages: readonly DirectorMessage[], userTurns: readonly HistoricalUserTurn[]): { at: number; text: string }[] {
  const replies: { at: number; text: string }[] = []
  for (const turn of userTurns) {
    if (typeof turn.timestamp === 'number' && Number.isFinite(turn.timestamp)) replies.push({ at: turn.timestamp, text: turn.text ?? '' })
  }
  // A user turn the Director replayed into the frame list is a persisted turn as well. It keeps its ORIGINAL time (the
  // transcript sorts user entries by the frame timestamp); its arrival stamp (clientTimestamp) only says when the replay landed.
  for (const message of messages) {
    if (message.type !== 'chat_message' || (message as DirectorMessage & { role?: string }).role !== 'user') continue
    const at = directorHistoryTimestamp(message.timestamp)
    if (Number.isFinite(at)) replies.push({ at, text: String((message.payload as { text?: unknown } | undefined)?.text ?? '') })
  }
  return replies
}

/** Only native workflow gates have a proven successor: plan -> outline and
 * outline -> final. Arbitrary current questions/retry/edit choices remain live.
 *
 * With STUDIO_HISTORY_ACTION_STATUS_ENABLED and the transcript's user turns, a card is also 'answered' once a user turn
 * follows it (after a reload nothing else records the answer). That is the only evidence: a deck, a position in the list
 * or a later Director frame never retires a card, so a pending question, plan gate or "Generate final deck" stays live.
 * A native gate is answered by its own button echo (the turn text is one of its labels); free text sent while it is
 * pending is not an answer. Pure: it never writes `answeredIds`.
 *
 * With STUDIO_ASK_CARD_IDENTITY_ENABLED an answer belongs to the ask instance, not to a reused id, and only the newest approval
 * gate of a session can stay live. (The build lock lives in lockApprovalGateStatuses, applied by the callers.) */
export function historicalActionStatuses(
  messages: readonly DirectorMessage[],
  answeredIds: ReadonlySet<string>,
  userTurns?: readonly HistoricalUserTurn[],
): Map<string, HistoricalActionStatus> {
  const statuses = baseHistoricalActionStatuses(messages, answeredIds, userTurns)
  if (STUDIO_ASK_CARD_IDENTITY_ENABLED) retireSupersededApprovalGates(messages, statuses)
  return statuses
}

// Supersession (NEW-E1). Director re-sends the outline gate under a new id on every reconnect while the outline is unapproved,
// so a restored session holds several. Every approval gate older than the newest of its session is an earlier step. A card
// without a usable time never compares as older, so it cannot be retired by accident.
function retireSupersededApprovalGates(
  messages: readonly DirectorMessage[],
  statuses: Map<string, HistoricalActionStatus>,
): void {
  const bySession = new Map<string, { id: string; time: number }[]>()
  for (const message of messages) {
    if (message.type !== 'action_request' || !isApprovalGate((message as ActionRequest).payload?.actions)) continue
    const gates = bySession.get(message.session_id ?? '') ?? []
    gates.push({ id: message.message_id, time: transcriptTime(message) })
    bySession.set(message.session_id ?? '', gates)
  }
  for (const gates of bySession.values()) {
    let newest: { id: string; time: number } | undefined
    for (const gate of gates) if (Number.isFinite(gate.time) && (!newest || gate.time >= newest.time)) newest = gate
    for (const gate of gates) {
      if (statuses.has(gate.id)) continue
      // An id is judged by its newest entry: two entries of ONE id are one ask, never each other's successor.
      if (newest && gate.id !== newest.id && Number.isFinite(gate.time)) statuses.set(gate.id, 'earlier')
    }
  }
}

function baseHistoricalActionStatuses(
  messages: readonly DirectorMessage[],
  answeredIds: ReadonlySet<string>,
  userTurns?: readonly HistoricalUserTurn[],
): Map<string, HistoricalActionStatus> {
  const statuses = new Map<string, HistoricalActionStatus>()
  for (const message of messages) {
    if (message.type !== 'action_request') continue
    if (isAskAnswered(answeredIds, message)) { statuses.set(message.message_id, 'answered'); continue }
    const actions = (message as ActionRequest).payload.actions
    const planGate = actions.some(action => action.value === 'accept_plan')
    const outlineGate = actions.some(action => action.value === 'accept_strawman')
    if ((!planGate && !outlineGate) || !message.session_id) continue
    const time = directorHistoryTimestamp(message.timestamp)
    if (!Number.isFinite(time)) continue
    for (const next of messages) {
      if (next.session_id !== message.session_id || directorHistoryTimestamp(next.timestamp) <= time
        || !Number.isFinite(directorHistoryTimestamp(next.timestamp))) continue
      if (next.type === 'chat_message' && (next as any).role === 'user'
        && typeof (next.payload as any).action_value === 'string'
        && actions.some(action => action.value === (next.payload as any).action_value)) {
        statuses.set(message.message_id, 'answered'); break
      }
      const hasOutline = next.type === 'slide_update' && !(next.payload as any).is_blank
        && (next.payload as any).operation === 'full_update' && (next.payload as any).slides?.length > 0
      const hasFinal = next.type === 'presentation_url' && !!(next.payload as any).presentation_id
        && !!(next.payload as any).url
      if ((planGate && (hasOutline || hasFinal)) || (outlineGate && hasFinal)) {
        statuses.set(message.message_id, 'earlier'); break
      }
    }
  }
  if (!STUDIO_HISTORY_ACTION_STATUS_ENABLED || !userTurns) return statuses
  const replies = userReplies(messages, userTurns)
  for (const message of messages) {
    if (message.type !== 'action_request' || statuses.has(message.message_id)) continue
    const at = transcriptTime(message)
    const actions = (message as ActionRequest).payload?.actions ?? []
    const nativeGate = actions.some(action => action.value === 'accept_plan' || action.value === 'accept_strawman')
    const labels = new Set(actions.map(action => action.label.trim()))
    // A card or a turn without a usable time (NaN) never compares as earlier, so it cannot be answered by accident.
    if (replies.some(reply => reply.at > at && (!nativeGate || labels.has(reply.text.trim())))) statuses.set(message.message_id, 'answered')
  }
  return statuses
}
