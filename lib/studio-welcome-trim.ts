// FRONTEND-2 (B51, 30 Oct; PK's UAT feedback F-01): the new-session welcome has too much copy. Flag NEXT_PUBLIC_STUDIO_WELCOME_TRIM (exact "true", build-time, default off; Studio first-run welcome only, so it acts
// only with NEXT_PUBLIC_STUDIO_FIRST_RUN_V2 on). With it on, the first-run welcome keeps its time-of-day greeting, "What story are we telling today?", the three starters and the stage's Replay intro / Explore
// templates / Blank canvas row, and drops the "Bring an idea..." line, the "Need a starting point?" caption, the idle "Choose a starter..." hint and Director's opening greeting bubble.
// This file holds the decisions (plain TypeScript, no React, no I/O) so a proof can run them on Director's recorded frames; components/builder/chat/studio-welcome.tsx and components/builder/message-list.tsx each
// carry a few lines marked STUDIO-WELCOME-TRIM that call it. Director is unchanged, and the greeting stays in the transcript data: only what Studio draws skips it.
import { DIRECTOR_522_INITIAL_GREETING } from '@/lib/studio-greeting-lifecycle'

export const STUDIO_WELCOME_TRIM_FLAG = 'NEXT_PUBLIC_STUDIO_WELCOME_TRIM'
export const STUDIO_WELCOME_TRIM_MARKER = 'STUDIO-WELCOME-TRIM'

/** True only for the exact string "true". Read when called, so a proof can set the variable per case; the build inlines `process.env.NEXT_PUBLIC_STUDIO_WELCOME_TRIM` here as it does for every other flag. */
export function studioWelcomeTrimOn(): boolean {
  return process.env.NEXT_PUBLIC_STUDIO_WELCOME_TRIM === 'true'
}

/** What the trim takes out of the first-run welcome, and what it keeps (the proof asserts both lists against the real markup; the PR body quotes them). */
export const WELCOME_TRIM_REMOVED = [
  'the "Bring an idea, who it’s for, and what you want them to take away..." line under the heading ([data-studio-director-welcome-part="intro"])',
  'the "Need a starting point?" caption over the starters ([data-studio-director-welcome-part="caption"])',
  'the idle hint "Choose a starter to add an editable draft below..." under the starters ([data-studio-director-welcome-part="hint"] when Director is not busy)',
  'Director\'s opening greeting bubble, "Hello! I\'m your presentation assistant..." (exact DIRECTOR_522_INITIAL_GREETING text, assistant role, on an empty new session)',
] as const
export const WELCOME_TRIM_KEPT = [
  'the time-of-day greeting eyebrow ([data-studio-director-welcome-part="eyebrow"])',
  'the heading "What story are we telling today?"',
  'the three starters (Pitch an idea, Share a project update, Explain a topic)',
  'the busy notice "Director is working. Starters will be available when this step finishes." (status, not guidance)',
  'the stage row Replay intro / Explore templates / Blank canvas (studio-first-run-actions.tsx, untouched)',
] as const

/** The minimum a transcript entry needs to be asked about (a structural type: the hook's DirectorMessage fits it). */
export interface TrimMessage {
  message_id?: string
  type?: string
  role?: string
  payload?: unknown
}

/**
 * Director's opening greeting: an assistant chat_message whose text is exactly the signature of Director's _send_greeting (the constant message-list.tsx already uses to recognise it).
 * An entry with no assistant role is never taken for it (Director's frames carry the role); text that differs by one character is not it.
 */
export function isOpeningGreeting(message: TrimMessage): boolean {
  if (message.type !== 'chat_message' || message.role !== 'assistant' || typeof message.message_id !== 'string' || message.message_id === '') return false
  const payload = message.payload
  return Boolean(payload) && typeof payload === 'object' && (payload as { text?: unknown }).text === DIRECTOR_522_INITIAL_GREETING
}

export const NO_HIDDEN_GREETINGS: ReadonlySet<string> = new Set<string>()

/**
 * The ids of the opening greetings Studio does not draw. `previous` is what the list hid on its last render (kept in a ref by message-list.tsx); `emptyNewSession` is message-list's own answer that the conversation is
 * still the empty first run (no user turn, not restoring, no open deck: `isEmptyStudioConversation && !presentationContext`).
 *   - A greeting is added only while that answer is true: it is hidden because it arrived before any user turn. Once added it STAYS hidden for as long as that entry is in the transcript, so sending the first message
 *     does not bring it back above the message (the answer turns false at that moment; membership is not re-asked).
 *   - A greeting that was never seen while the conversation was empty is never added: a restored session whose history opens with the greeting, an open deck's welcome, and a genuine assistant message with the same
 *     text that arrives after a user turn all keep showing it, as today. Equal text is not identity: the ids that were there when the conversation was empty are the whole set.
 *   - An id whose entry has left the transcript (another session's list) is dropped.
 * Returns `previous` itself when nothing changed, so the caller can use identity for a memo dependency.
 */
export function latchOpeningGreetings(previous: ReadonlySet<string>, messages: readonly TrimMessage[], emptyNewSession: boolean): ReadonlySet<string> {
  const present = new Set<string>()
  for (const message of messages) if (typeof message.message_id === 'string') present.add(message.message_id)
  const next = new Set<string>()
  for (const id of previous) if (present.has(id)) next.add(id)
  if (emptyNewSession) for (const message of messages) if (isOpeningGreeting(message)) next.add(message.message_id as string)
  if (next.size === previous.size && [...next].every(id => previous.has(id))) return previous
  return next.size === 0 ? NO_HIDDEN_GREETINGS : next
}
