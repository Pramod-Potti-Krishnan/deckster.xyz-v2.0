// W6 P4-20 voice call: the seam between the call and model-router (hearing and speaking). IMPORT-FREE, and it makes no request until a method is called.
// STT and TTS go through model-router, never direct (P4-18, PROGRAM-1 1 Nov): ELEMENT-3's core ports no speech route, ROUTER-1 owns the labels. This file is the contract the call is written against, so the two sides
// can be built apart:
//   POST /api/studio/voice/transcribe   multipart form: `audio` (the recording), `label` = studio.voice_stt   ->  200 { "text": "..." }
//   POST /api/studio/voice/speak        JSON { "text": "one sentence", "label": "studio.voice_tts" }          ->  200 an audio body (audio/*)
// Both are Studio's own same-origin routes (the browser never holds a key and never talks to a speech vendor); the routes call model-router with the label. Neither route exists yet: until they do, the call
// says so plainly ("Speech isn't connected yet") instead of failing in a way that looks like the user's fault. 404, 501 and 503 mean "not connected"; 402 and 429 mean a limit; anything else is a plain failure.

export const VOICE_ROUTER_LABELS = { stt: 'studio.voice_stt', tts: 'studio.voice_tts' } as const
export const VOICE_ROUTER_ENDPOINTS = { transcribe: '/api/studio/voice/transcribe', speak: '/api/studio/voice/speak' } as const

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
  /** Words in a recording. An empty text is an answer ("no words"), not an error. */
  transcribe(audio: Blob, opts?: { signal?: AbortSignal }): Promise<{ text: string }>
  /** One sentence as audio. */
  speak(text: string, opts?: { signal?: AbortSignal }): Promise<Blob>
}

type FetchLike = (input: string, init?: { method?: string; body?: unknown; headers?: Record<string, string>; signal?: AbortSignal; credentials?: string }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; blob(): Promise<Blob> }>

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
        form.append('audio', audio, 'turn.webm')
        form.append('label', VOICE_ROUTER_LABELS.stt)
        const response = await fetchImpl(VOICE_ROUTER_ENDPOINTS.transcribe, { method: 'POST', body: form, signal: opts?.signal, credentials: 'same-origin' })
        if (!response.ok) throw new VoiceRouterError(routerErrorKind(response.status), `Transcription answered ${response.status}`)
        const body = await response.json()
        const text = typeof body === 'object' && body !== null && typeof (body as { text?: unknown }).text === 'string' ? (body as { text: string }).text.trim() : ''
        return { text }
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
        return await response.blob()
      } catch (error) {
        throw asRouterError(error, opts?.signal)
      }
    },
  }
}
