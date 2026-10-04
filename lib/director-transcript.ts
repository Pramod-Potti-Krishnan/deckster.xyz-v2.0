import type { DirectorMessage } from '@/hooks/use-deckster-websocket-v2'
import type { UserChatMessage } from '@/lib/user-message-attachments'

export type DirectorTranscriptEntry =
  | (UserChatMessage & { messageType: 'user' })
  | (DirectorMessage & { messageType: 'bot' })

/**
 * Event identity, rather than prose, decides whether a Director turn is new.
 * A replayed user echo may have a different server ID from its local send;
 * reconcile those copies one-to-one only when their exact text and existing
 * event timestamp agree. Text alone cannot correlate historical user turns.
 */
export function deduplicateDirectorTranscript(
  entries: DirectorTranscriptEntry[],
  localUserMessages: UserChatMessage[],
): DirectorTranscriptEntry[] {
  const seenIds = new Set<string>()
  const localIds = new Set(localUserMessages.map(message => message.id))
  const localEchoes = new Map<string, UserChatMessage[]>()
  for (const message of localUserMessages) {
    const copies = localEchoes.get(message.text) ?? []
    if (!copies.some(copy => copy.id === message.id)) copies.push(message)
    localEchoes.set(message.text, copies)
  }
  const reconciledLocalIds = new Set<string>()
  // Reserve all exact-ID copies before considering cross-ID echoes. Incoming
  // order must not let a same-text copy consume a local turn already identified
  // by an exact-ID echo later in this snapshot.
  const encounteredLocalIds = new Set<string>()
  for (const entry of entries) {
    if (entry.messageType !== 'user' || !localIds.has(entry.id)) continue
    if (encounteredLocalIds.has(entry.id)) reconciledLocalIds.add(entry.id)
    encounteredLocalIds.add(entry.id)
  }

  return entries.filter(entry => {
    const id = entry.messageType === 'user' ? entry.id : entry.message_id
    if (seenIds.has(id)) {
      // A same-ID echo already accounts for this local turn. A later,
      // distinct same-text turn must not consume it again.
      if (entry.messageType === 'user' && localIds.has(id)) reconciledLocalIds.add(id)
      return false
    }
    seenIds.add(id)
    if (entry.messageType !== 'user' || localIds.has(id)) return true

    if (!Number.isFinite(entry.timestamp)) return true
    const localCopy = localEchoes.get(entry.text)?.find(candidate =>
      Number.isFinite(candidate.timestamp) &&
      candidate.timestamp === entry.timestamp &&
      !reconciledLocalIds.has(candidate.id),
    )
    if (!localCopy) return true
    reconciledLocalIds.add(localCopy.id)
    return false
  })
}
