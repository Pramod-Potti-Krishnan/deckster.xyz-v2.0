// W6 P4-20 voice call: the seam between the call and model-router (hearing and speaking). IMPORT-FREE, and it makes no request until a method is called.
// STT and TTS go through model-router, never direct (P4-18, PROGRAM-1 1 Nov). ROUTER-1's final transport contract (router MR !49, via ELEMENT-3's docs/p4-19/VOICE-CORE.md): the calls belong in Studio's SERVER adapter, which uses the studio
// proxy-scoped router key and identity headers; the browser holds no key. Hearing is the router's chat/completions with an audio-capable model and `input_audio` as base64 WAV (task studio.voice_stt; the transcript is the first choice's content;
// the router has no transcription endpoint). Speaking is the router's audio/speech (task studio.voice_tts; a sentence in, audio out with Content-Type and x-generation-id). So the contract this file is written against is Studio's own two routes:
//   POST /api/studio/voice/transcribe   multipart form: `audio` = WAV, 16 kHz, mono, 16-bit (the capture layer converts what the microphone gave: lib/studio-voice-call-browser.ts), `label` = studio.voice_stt   ->  200 { "text": "..." }
//   POST /api/studio/voice/speak        JSON { "text": "one sentence", "label": "studio.voice_tts" }                                                                                              ->  200 an audio body (audio/*)
// Each answer may carry the optional normalized header X-Deckster-Cost-Usd (the adapter resolves billing metadata server-side); when it is absent or bad the cost is unknown (null), never zero. Neither route exists yet (ELEMENT-3 / ROUTER-1): until
// they do, the call says so plainly ("Speech isn't connected yet") instead of failing in a way that looks like the user's fault. 404, 501 and 503 mean "not connected"; 402 and 429 mean a limit; anything else is a plain failure.

export const VOICE_ROUTER_LABELS = { stt: 'studio.voice_stt', tts: 'studio.voice_tts' } as const
export const VOICE_ROUTER_ENDPOINTS = { transcribe: '/api/studio/voice/transcribe', speak: '/api/studio/voice/speak' } as const
export const VOICE_COST_HEADER = 'X-Deckster-Cost-Usd'

/** The cost an answer says it had (a finite number, zero or more), or null: an unknown cost is never zero. */
export function costFromHeader(value: string | null | undefined): number | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const usd = Number(value)
  return Number.isFinite(usd) && usd >= 0 ? usd : null
}

export type VoiceRouterErrorKind = 'not_connected' | 'limit' | 'failed' | 'aborted'

export class VoiceRouterError extends Error {
  readonly kind: VoiceRouterErrorKind
  constructor(kind: VoiceRouterErrorKind, message: string) {
    super(message)
    this.name = 'VoiceRouterError'
    this.kind = kind
  }
}

export interface VoiceRouterPort {
  /** Words in a recording (a WAV). An empty text is an answer ("no words"), not an error. `costUsd` is null when the answer did not say. */
  transcribe(audio: Blob, opts?: { signal?: AbortSignal }): Promise<{ text: string; costUsd: number | null }>
  /** One sentence as audio. */
  speak(text: string, opts?: { signal?: AbortSignal }): Promise<{ audio: Blob; costUsd: number | null }>
}

type FetchLike = (input: string, init?: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal; credentials?: string }) => Promise<{ ok: boolean; status: number; headers?: { get(name: string): string | null }; json(): Promise<unknown>; blob(): Promise<Blob> }>

/** The kind of error an HTTP status is. */
export function routerErrorKind(status: number): VoiceRouterErrorKind {
  if (status === 404 || status === 501 || status === 503) return 'not_connected'
  if (status === 402 || status === 429) return 'limit'
  return 'failed'
}

function asRouterError(error: unknown, signal?: AbortSignal): VoiceRouterError {
  if (error instanceof VoiceRouterError) return error
  const name = typeof error === 'object' && error !== null ? (error as { name?: unknown }).name : undefined
  if (name === 'AbortError' || signal?.aborted) return new VoiceRouterError('aborted', 'The request was cancelled')
  return new VoiceRouterError('not_connected', 'The speech route could not be reached')
}

/** The same-origin port. `fetchImpl` is the browser's fetch (a test passes a fake: nothing in this file reaches the network on its own). */
export function createVoiceRouterPort(fetchImpl: FetchLike, FormDataCtor: new () => { append(name: string, value: unknown, filename?: string): void }): VoiceRouterPort {
  return {
    async transcribe(audio, opts) {
      try {
        const form = new FormDataCtor()
        form.append('audio', audio, 'turn.wav')
        form.append('label', VOICE_ROUTER_LABELS.stt)
        const response = await fetchImpl(VOICE_ROUTER_ENDPOINTS.transcribe, { method: 'POST', body: form, signal: opts?.signal, credentials: 'same-origin' })
        if (!response.ok) throw new VoiceRouterError(routerErrorKind(response.status), `Transcription answered ${response.status}`)
        const body = await response.json()
        const text = typeof body === 'object' && body !== null && typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text.trim() : ''
        return { text, costUsd: costFromHeader(response.headers?.get(VOICE_COST_HEADER)) }
      } catch (error) {
        throw asRouterError(error, opts?.signal)
      }
    },
    async speak(text, opts) {
      try {
        const response = await fetchImpl(VOICE_ROUTER_ENDPOINTS.speak, {
          method: 'POST', body: JSON.stringify({ text, label: VOICE_ROUTER_LABELS.tts }), headers: { 'Content-Type': 'application/json' }, signal: opts?.signal, credentials: 'same-origin',
        })
        if (!response.ok) throw new VoiceRouterError(routerErrorKind(response.status), `Speech answered ${response.status}`)
        return { audio: await response.blob(), costUsd: costFromHeader(response.headers?.get(VOICE_COST_HEADER)) }
      } catch (error) {
        throw asRouterError(error, opts?.signal)
      }
    },
  }
}
