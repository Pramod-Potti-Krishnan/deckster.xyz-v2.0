import { useCallback, useEffect, useRef, useState } from 'react'
import type { SendUserMessageOptions } from '@/hooks/use-deckster-websocket-v2'
import type { UserChatMessage } from '@/lib/user-message-attachments'

/**
 * NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND (exact "true", default off, build-time): Director's new_session directive (MDC P4, K3) with
 * auto_send. The page opens the fresh session (handleNewChat), shows the brief as the user's bubble and hands it here. It goes out on the
 * NEW session's socket, once, right after that socket opens, through the Director hook's sendMessageWhenConnected: an ordinary
 * user_message with the usual client_caps (and the deck identity the page passes), whose origin is the new session.
 * Off, the page calls sendMessageWhenConnected at once instead, while the OLD session is still the hook's origin; once the page adopts the
 * new session that send gives up, so the bubble said "sent" and nothing reached Director.
 *
 * DIRECTOR-2's rules (23 Oct): Director expects nothing first (it queues the brief behind its blank deck and greeting). The brief is sent
 * EXACTLY ONCE: the pending handoff is cleared before the send, so a reconnect, a socket that drops and opens again, or a retry never
 * sends a second copy (a second paid turn). Nothing is ever retried automatically: when the new socket does not open within the send
 * window (NEW_DECK_HANDOFF_SEND_TIMEOUT_MS, the hook's SEND_RECONNECT_TIMEOUT_MS) or the send does not go out, the bubble is taken away,
 * the brief goes back in the input box and the typed turn's own "Couldn't reach the Director" notice shows, so the user sends it.
 * Leaving the new session before its socket opens drops the brief (that session's bubble goes with it).
 */
export const STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED = process.env.NEXT_PUBLIC_STUDIO_NEW_DECK_HANDOFF_SEND === 'true'

/** The Director hook's SEND_RECONNECT_TIMEOUT_MS: how long any send waits for its socket before it gives up. */
export const NEW_DECK_HANDOFF_SEND_TIMEOUT_MS = 12000

/** What the page hands over: the NEW session's id (session.currentSessionIdRef right after handleNewChat), the brief, its bubble's id and the send options. */
export interface NewDeckHandoff {
  sessionId: string | null
  text: string
  bubbleId: string
  options: SendUserMessageOptions
}

export interface StudioNewDeckHandoffSendOptions {
  currentSessionId: string | null
  wsSessionId: string | null
  socketSessionId: string | null
  connected: boolean
  connectionGeneration: number
  sendMessageWhenConnected: (text: string, storeName?: string, fileCount?: number, options?: SendUserMessageOptions) => Promise<boolean>
  setInputMessage: (text: string) => void
  setUserMessages: (update: (prev: UserChatMessage[]) => UserChatMessage[]) => void
  toast: (notice: { title: string; description: string; variant: 'destructive' }) => unknown
}

interface PendingHandoff extends NewDeckHandoff {
  sessionId: string
  adopted: boolean
  timer: ReturnType<typeof setTimeout> | null
}

/** Returns the page's hand-over (stable). With the flag off it does nothing and its effects return at once. */
export function useStudioNewDeckHandoffSend(options: StudioNewDeckHandoffSendOptions): (handoff: NewDeckHandoff) => void {
  const live = useRef(options)
  live.current = options
  const pendingRef = useRef<PendingHandoff | null>(null)
  const [armed, setArmed] = useState(0)

  // Not sent: no bubble may say it was. On the new session itself the brief goes back in the box, with the typed turn's notice.
  const notSent = useCallback((handoff: NewDeckHandoff, restore: boolean) => {
    const { setUserMessages, setInputMessage, toast } = live.current
    setUserMessages(prev => prev.filter(message => message.id !== handoff.bubbleId))
    if (!restore) return
    setInputMessage(handoff.text)
    toast({
      title: "Couldn't reach the Director",
      description: 'Your message was not sent — the connection dropped and could not be reopened. It is still in the box; try again.',
      variant: 'destructive',
    })
  }, [])

  const arm = useCallback((handoff: NewDeckHandoff) => {
    if (!STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED) return
    const previous = pendingRef.current
    if (previous?.timer) clearTimeout(previous.timer)
    pendingRef.current = null
    // Only a session the page has not adopted yet (the one handleNewChat just made): never the session the page is still on.
    if (!handoff.sessionId || handoff.sessionId === live.current.currentSessionId) {
      notSent(handoff, true)
      return
    }
    const pending: PendingHandoff = { ...handoff, sessionId: handoff.sessionId, adopted: false, timer: null }
    pending.timer = setTimeout(() => {
      if (pendingRef.current !== pending) return
      pendingRef.current = null
      notSent(pending, live.current.currentSessionId === pending.sessionId)
    }, NEW_DECK_HANDOFF_SEND_TIMEOUT_MS)
    pendingRef.current = pending
    setArmed(count => count + 1)
  }, [notSent])

  const { currentSessionId, wsSessionId, socketSessionId, connected, connectionGeneration } = options
  useEffect(() => {
    const pending = pendingRef.current
    if (!STUDIO_NEW_DECK_HANDOFF_SEND_ENABLED || !pending) return
    if (currentSessionId !== pending.sessionId) {
      if (pending.adopted) {
        if (pending.timer) clearTimeout(pending.timer)
        pendingRef.current = null
      }
      return
    }
    pending.adopted = true
    // The page, the Director hook and an OPEN socket are all on the new session: send now, so the send's origin is that session.
    if (!connected || wsSessionId !== pending.sessionId || socketSessionId !== pending.sessionId) return
    pendingRef.current = null // exactly once: cleared before the send, so no later reconnect, re-open or retry can send it again
    if (pending.timer) clearTimeout(pending.timer)
    const fail = () => notSent(pending, live.current.currentSessionId === pending.sessionId)
    void live.current.sendMessageWhenConnected(pending.text, undefined, undefined, pending.options)
      .then(sent => { if (sent !== true) fail() }, fail)
  }, [armed, currentSessionId, wsSessionId, socketSessionId, connected, connectionGeneration, notSent])

  useEffect(() => () => {
    const pending = pendingRef.current
    if (pending?.timer) clearTimeout(pending.timer)
    pendingRef.current = null
  }, [])

  return arm
}
