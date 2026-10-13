// PASS2-DIRECTOR-CHAT PR D, item 7 (flag NEXT_PUBLIC_STUDIO_CHAT_RECOVERY): the words of the calm "something interrupted Director, your
// slides are safe" card at the end of the transcript.
//
// Pure and import-free. It is handed facts the Builder page already holds and the Director hook already reports (the transport notice for
// the displayed session, the hook's reconnect status, whether the last status_update was an error) and returns the words to show, or null.
// It cannot send, retry or reconnect anything: the card it feeds has no button. The way out stays where it already is, in the message box:
// a message typed there is the existing resend, and sending while disconnected is the existing explicit reconnect (page.tsx
// handleSendMessage calls connect() when the socket is not ready; the composer placeholder already says "send to reconnect").
//
// What is NOT claimed: the card never says Director retried or reconnected on its own, except for the one thing the hook really does
// (it resumes by itself when the browser comes back online).

export interface StudioChatRecoveryInput {
  /** `transportNotice.type` of the notice for the displayed session; null when there is none. */
  noticeType: 'auth_refreshed' | 'auth_refresh_failed' | 'auth_expired' | 'error' | null
  /** `transportNotice.requiresResend`: Director discarded the user's last input. */
  noticeRequiresResend: boolean
  /** The hook's `reconnectStatus`. */
  reconnectStatus: 'idle' | 'scheduled' | 'paused_offline' | 'exhausted' | 'manual' | string
  /** `currentStatus.status === 'error'`. */
  statusError: boolean
}

export type StudioChatRecoveryKind = 'resend' | 'offline' | 'lost' | 'error'

export interface StudioChatRecoveryCard {
  kind: StudioChatRecoveryKind
  title: string
  body: string
}

const CARDS: Record<StudioChatRecoveryKind, Omit<StudioChatRecoveryCard, 'kind'>> = {
  // Director discarded the user's last input (the sign-in/connection expired while it was in flight).
  resend: {
    title: "Your last message didn't go through",
    body: 'Your slides are safe. Send it again from the message box when Director is connected.',
  },
  // The browser is offline: the hook pauses its retries and resumes on its own when the browser is back.
  offline: {
    title: "You're offline",
    body: 'Your slides are safe. Director reconnects on its own when your internet is back.',
  },
  // The hook used up its retries (or could not refresh the connection).
  lost: {
    title: "Director couldn't reconnect",
    body: 'Your slides are safe. Send a message from the message box to reconnect.',
  },
  // Director reported an error for the turn.
  error: {
    title: 'Something interrupted Director',
    body: 'Your slides are safe. Try again from the message box, or ask for something different.',
  },
}

/**
 * Which card (if any) the transcript shows. One card at most. Order: a discarded message, then no network, then a connection that
 * could not be restored, then a Director error. A refreshed connection and a retry that is still scheduled show nothing (no alarm
 * for a blip the hook is already handling).
 */
export function studioChatRecoveryKind(input: StudioChatRecoveryInput): StudioChatRecoveryKind | null {
  if (input.noticeType === 'auth_expired' || input.noticeRequiresResend) return 'resend'
  if (input.reconnectStatus === 'paused_offline') return 'offline'
  if (input.reconnectStatus === 'exhausted' || input.noticeType === 'auth_refresh_failed') return 'lost'
  if (input.noticeType === 'error' || input.statusError) return 'error'
  return null
}

export function studioChatRecoveryCard(input: StudioChatRecoveryInput | null | undefined): StudioChatRecoveryCard | null {
  if (!input) return null
  const kind = studioChatRecoveryKind(input)
  return kind ? { kind, ...CARDS[kind] } : null
}
