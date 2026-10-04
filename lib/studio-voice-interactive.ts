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
  const local = voices.filter(v => v.localService)
  if (local.length === 0) return null
  const base = preferredLang.toLowerCase().split('-')[0]
  const sameLang = local.filter(v => v.lang.toLowerCase().split('-')[0] === base)
  const pool = sameLang.length ? sameLang : local
  return pool.find(v => v.default) ?? pool[0]
}

export function speechOutputStatus(hasSynthesis: boolean, voice: VoiceLike | null): CapabilityStatus {
  if (!hasSynthesis) return { available: false, reason: 'Spoken replies are unavailable: this browser has no speech output.' }
  if (!voice) return { available: false, reason: 'Spoken replies are unavailable: no on-device voice is installed.' }
  return { available: true, reason: `Reads Director replies aloud with the on-device voice “${voice.name}”.` }
}

interface MessageLike {
  message_id?: string
  type?: string
  payload?: unknown
}

/** Readable text of a non-ephemeral Director chat reply, or null. */
export function directorReplyText(message: MessageLike | null | undefined): string | null {
  if (!message || message.type !== 'chat_message') return null
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
export function latestDirectorReply(messages: readonly MessageLike[]): { id: string; text: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = directorReplyText(messages[i])
    if (text) return { id: messages[i].message_id ?? `index-${i}`, text }
  }
  return null
}

/**
 * The newest Director question still awaiting an answer. The call view only
 * points at it: the real question card remains the one place to answer, so
 * action identity, input requirements and confirmations are unchanged.
 */
export function latestPendingAsk(
  messages: readonly MessageLike[],
  answered: { has(id: string): boolean } | null | undefined,
): { id: string; prompt: string } | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m?.type !== 'action_request') continue
    const id = m.message_id
    if (!id || answered?.has(id)) return null
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
