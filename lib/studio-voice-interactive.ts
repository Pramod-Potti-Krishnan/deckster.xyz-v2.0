/**
 * Studio v4 Director voice / interactive avatar mode — pure helpers.
 *
 * The flag is build-time: both public values are inlined into the client
 * bundle, so activation and rollback need a rebuild. Only the literal string
 * "true" for BOTH flags turns the feature on; anything else is OFF.
 *
 * Capability truth: there is no approved Director speech-recognition contract,
 * so voice input is always reported unavailable. Spoken replies use only an
 * on-device (`localService`) speech-synthesis voice, and only after the user
 * turns them on.
 */

export type DirectorCallMode = 'chat' | 'voice' | 'interactive'

export function studioVoiceInteractiveFlagOn(shell: string | undefined, voiceInteractive: string | undefined): boolean {
  return shell === 'true' && voiceInteractive === 'true'
}

/** Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them at build time. */
export const STUDIO_VOICE_INTERACTIVE_ENABLED = studioVoiceInteractiveFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL,
  process.env.NEXT_PUBLIC_STUDIO_V4_VOICE_INTERACTIVE,
)

export interface CapabilityStatus {
  available: boolean
  reason: string
}

/**
 * Voice input stays off: browser recognition may send audio to the browser
 * vendor and no Director speech-input contract is approved.
 */
export function speechInputStatus(win?: { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown }): CapabilityStatus {
  const browserHasRecognition = !!win && (!!win.SpeechRecognition || !!win.webkitSpeechRecognition)
  return {
    available: false,
    reason: browserHasRecognition
      ? 'Voice input is off: no approved Director speech service is connected, and this browser’s recognition may send audio to its vendor. Type instead.'
      : 'Voice input is unavailable: no Director speech service is connected and this browser has no speech recognition. Type instead.',
  }
}

export interface VoiceLike {
  name: string
  lang: string
  localService: boolean
  default?: boolean
}

/** An on-device voice only, preferring the page language, then the default. */
export function pickLocalVoice<V extends VoiceLike>(voices: readonly V[], preferredLang = 'en'): V | null {
  const local = voices.filter(v => v.localService === true)
  if (local.length === 0) return null
  const base = preferredLang.toLowerCase().split('-')[0]
  const sameLang = local.filter(v => v.lang.toLowerCase().split('-')[0] === base)
  const pool = sameLang.length ? sameLang : local
  return pool.find(v => v.default) ?? pool[0]
}

export function speechOutputStatus(hasSynthesis: boolean, voice: VoiceLike | null): CapabilityStatus {
  if (!hasSynthesis) return { available: false, reason: 'Spoken replies are unavailable: this browser has no speech output.' }
  if (!voice || voice.localService !== true) return { available: false, reason: 'Spoken replies are unavailable: no on-device voice is installed.' }
  return { available: true, reason: `Reads Director replies aloud with the on-device voice “${voice.name}”.` }
}

export interface DirectorCallMessage {
  message_id?: string
  session_id?: string
  role?: string
  type?: string
  payload?: unknown
}

/** Supplied by the current transcript/transport owner. Classification must use
 * the existing MessageList role / user identity policy, not a new prose filter.
 * Live IDs are positively observed post-restore ingress; array position or
 * message timestamps do not establish live arrival. Unknown denies admission. */
export interface DirectorReplyPolicy {
  readonly owner: object
  readonly displayedSessionId: string | null
  readonly assistantMessageIds: ReadonlySet<string>
  readonly liveMessageIds: ReadonlySet<string>
  readonly restoredMessageIds: ReadonlySet<string>
  readonly ephemeralMessageIds: ReadonlySet<string>
}

/** Readable text of a positively admitted current-owner assistant reply. */
export function directorReplyText(message: DirectorCallMessage | null | undefined, policy?: DirectorReplyPolicy | null): string | null {
  const id = message?.message_id
  if (!message || !policy || !policy.displayedSessionId || !id?.trim()
    || message.type !== 'chat_message' || (message.role !== undefined && message.role !== 'assistant')
    || message.session_id !== policy.displayedSessionId
    || !policy.assistantMessageIds.has(id) || !policy.liveMessageIds.has(id)
    || policy.restoredMessageIds.has(id) || policy.ephemeralMessageIds.has(id)) return null
  const payload = message.payload as { text?: unknown; ephemeral?: unknown; list_items?: unknown } | undefined
  if (!payload || payload.ephemeral === true || typeof payload.text !== 'string') return null
  const items = Array.isArray(payload.list_items) ? payload.list_items.filter((i): i is string => typeof i === 'string') : []
  const text = [payload.text, ...items].join('. ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_`#>~|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

/** The most recent Director reply (id + text), scanning backwards. */
export function latestDirectorReply(messages: readonly DirectorCallMessage[], policy?: DirectorReplyPolicy | null): { id: string; text: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = directorReplyText(messages[i], policy)
    if (text) return { id: messages[i].message_id!, text }
  }
  return null
}

/**
 * The newest Director question still awaiting an answer. The call view only
 * points at it: the real question card remains the one place to answer, so
 * action identity, input requirements and confirmations are unchanged.
 */
export interface DirectorQuestionPolicy {
  readonly displayedSessionId: string | null
  /** Exact historicalActionStatuses(messages, answeredActionsRef.current). */
  readonly historicalStatuses: ReadonlyMap<string, 'answered' | 'earlier'>
  /** Exact current MessageList displayed-session/retirement policy. */
  readonly activeActionIds: ReadonlySet<string>
}

export function latestPendingAsk(
  messages: readonly DirectorCallMessage[],
  policy?: DirectorQuestionPolicy | null,
): { id: string; prompt: string } | null {
  if (!policy?.displayedSessionId) return null
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m?.type !== 'action_request') continue
    const id = m.message_id
    if (!id?.trim() || (m.session_id && m.session_id !== policy.displayedSessionId)
      || policy.historicalStatuses.has(id) || !policy.activeActionIds.has(id)) continue
    const prompt = (m.payload as { prompt_text?: unknown } | undefined)?.prompt_text
    return { id, prompt: typeof prompt === 'string' && prompt.trim() ? prompt.trim() : 'The Director needs your input.' }
  }
  return null
}

/** Long replies are clipped for speech; the full text stays in chat. */
export function clipForSpeech(text: string, max = 600): string {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '))
  return (stop > max * 0.5 ? cut.slice(0, stop + 1) : cut) + ' The full reply is in the chat.'
}

export function formatCallDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
