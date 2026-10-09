import type { DirectorMessage } from '@/hooks/use-deckster-websocket-v2'
import { historicalActionStatuses, type HistoricalActionStatus, type HistoricalUserTurn } from '@/lib/director-history-presentation'

export interface DirectorMessageBookkeeping {
  userMessageIds: ReadonlySet<string>
  userMessageContentMap: ReadonlyMap<string, string>
}

export interface DirectorMessageClassification {
  isUserMessage: boolean
  classificationMethod: 'ROLE_FIELD' | 'USER_MESSAGE_IDS_REF' | 'CONTENT_MATCH' | 'DEFAULT'
  /** The renderer keeps the existing explicit-role/content-match ID tracking. */
  trackUserId: boolean
  matchingUserId?: string
  normalizedContent?: string
}

/** Shared presentation classification, extracted from MessageList. A bot
 * classification alone does not establish live assistant/voice provenance. */
export function classifyDirectorMessage(
  message: DirectorMessage,
  bookkeeping: DirectorMessageBookkeeping,
): DirectorMessageClassification {
  const candidate = message as DirectorMessage & { role?: unknown; payload?: { text?: unknown } }
  if (candidate.role === 'user') {
    return { isUserMessage: true, classificationMethod: 'ROLE_FIELD', trackUserId: true }
  }

  // Preserve the legacy rule for every non-user string role, including unknown
  // values. Voice admission must independently require an explicit assistant.
  const hasDirectorRole = typeof candidate.role === 'string' && candidate.role !== 'user'
  if (!hasDirectorRole && message.type === 'chat_message' && bookkeeping.userMessageIds.has(message.message_id)) {
    return { isUserMessage: true, classificationMethod: 'USER_MESSAGE_IDS_REF', trackUserId: false }
  }
  if (!hasDirectorRole && message.type === 'chat_message' && candidate.payload?.text) {
    const normalizedContent = (typeof candidate.payload.text === 'string' ? candidate.payload.text : '').trim().toLowerCase()
    const matchingUserId = bookkeeping.userMessageContentMap.get(normalizedContent)
    if (matchingUserId) {
      return { isUserMessage: true, classificationMethod: 'CONTENT_MATCH', trackUserId: true, matchingUserId, normalizedContent }
    }
  }
  return { isUserMessage: false, classificationMethod: 'DEFAULT', trackUserId: false }
}

/** Exact current renderer action policy. Historical native gate retirement is
 * kept in its existing authority; missing session IDs retain legacy behavior. */
export function getDirectorActionPolicy(
  messages: readonly DirectorMessage[],
  answeredIds: ReadonlySet<string>,
  sessionId?: string | null,
  userTurns?: readonly HistoricalUserTurn[],
): { historicalActions: Map<string, HistoricalActionStatus>; activeActionIds: Set<string> } {
  const historicalActions = historicalActionStatuses(messages, answeredIds, userTurns)
  const activeActionIds = new Set(messages.filter(message => message.type === 'action_request'
    && (!sessionId || !message.session_id || message.session_id === sessionId)
    && !historicalActions.has(message.message_id)).map(message => message.message_id))
  return { historicalActions, activeActionIds }
}
