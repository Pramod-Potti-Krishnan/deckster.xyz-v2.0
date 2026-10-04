import type { DirectorMessage, ActionRequest } from '@/hooks/use-deckster-websocket-v2'
import type { DirectorTranscriptEntry } from '@/lib/director-transcript'
import { directorHistoryTimestamp } from '@/lib/director-chat-history'

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
): T & { clientOutlineReplayOf?: string } {
  const clean = { ...message } as T & { clientOutlineReplayOf?: string }
  delete clean.clientOutlineReplayOf
  const identity = outlineIdentity(clean)
  const payload = (clean.payload || {}) as Record<string, any>
  const previewUrl = payload.preview_url || payload.metadata?.preview_url || payload.strawman?.preview_url || payload.url
  if (!identity || !owner.isTerminal || !owner.displayedSessionId
    || owner.socketSessionId !== owner.displayedSessionId || owner.deckOwnerSessionId !== owner.displayedSessionId
    || clean.session_id !== owner.displayedSessionId || identity.presentationId !== owner.finalPresentationId
    || !owner.finalPresentationUrl || previewUrl !== owner.finalPresentationUrl) return clean
  const previous = [...previousMessages].reverse().find(candidate => candidate.message_id !== clean.message_id
    && candidate.session_id === clean.session_id && outlineIdentity(candidate)?.content === identity.content)
  return previous ? { ...clean, clientOutlineReplayOf: previous.message_id } : clean
}

export type HistoricalActionStatus = 'answered' | 'earlier'

/** Only native workflow gates have a proven successor: plan -> outline and
 * outline -> final. Arbitrary current questions/retry/edit choices remain live. */
export function historicalActionStatuses(
  messages: readonly DirectorMessage[],
  answeredIds: ReadonlySet<string>,
): Map<string, HistoricalActionStatus> {
  const statuses = new Map<string, HistoricalActionStatus>()
  for (const message of messages) {
    if (message.type !== 'action_request') continue
    if (answeredIds.has(message.message_id)) { statuses.set(message.message_id, 'answered'); continue }
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
  return statuses
}
