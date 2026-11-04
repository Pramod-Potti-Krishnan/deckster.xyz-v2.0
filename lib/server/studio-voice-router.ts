// W6 P4-21 voice call: the SERVER side of the call's speech (FRONTEND-1). The two same-origin routes (app/api/studio/voice/transcribe, app/api/studio/voice/speak) are thin; everything they decide is here, pure and
// IMPORT-FREE, with fetch, the clock, the signed-in user and the environment injected, so the proof (scripts/test-studio-voice-speech-routes.mjs) runs it with a fake fetch and no network.
// ROUTER-1's final contract (via ELEMENT-3's docs/p4-19/VOICE-CORE.md): hearing is the router's POST /v1/chat/completions with an `input_audio` part (base64 WAV; NOT /audio/transcriptions), the transcript is the first
// choice's content; speaking is the router's POST /v1/audio/speech, which answers audio with Content-Type and x-generation-id. The router key (MODEL_ROUTER_STUDIO_KEY, the "studio" proxy-scoped key) and its address
// (MODEL_ROUTER_URL, no /v1) are server variables, read per request and never sent to the browser, logged or put in an error. COST IS INTERNAL (ROUTER-1, 2026-11-04): every call sends X-MR-Signal: headers, and the
// router's X-MR-Cost-USD / X-MR-Model-Served / X-MR-Fallback-Depth / X-MR-Attempts (and a completion's usage.cost) are logged server-side only. No cost header, figure or margin is ever passed to the browser.
// Behind NEXT_PUBLIC_STUDIO_VOICE_CALL (exactly "true"): with it off both routes answer 404 before anything else is read.

export const VOICE_SPEECH_FLAG = 'NEXT_PUBLIC_STUDIO_VOICE_CALL'
/** The client's cost header name: these routes never set it (cost stays internal), so the call's meter adds null. */
export const VOICE_COST_HEADER = 'X-Deckster-Cost-Usd'
/** The router's internal signal headers (answered when the request carries X-MR-Signal: headers). */
export const ROUTER_SIGNAL_HEADERS = ['x-mr-cost-usd', 'x-mr-model-served', 'x-mr-fallback-depth', 'x-mr-attempts'] as const
export const VOICE_TASKS = { stt: 'studio.voice_stt', tts: 'studio.voice_tts' } as const

// ROUTER-1 (2026-11-04): studio.voice_stt and studio.voice_tts are registered labels (X-MR-Task); the label does not pick the model, the body's model slug is what is served. No X-MR-Group is sent.
export const VOICE_STT_MODEL = 'google/gemini-3.5-flash-lite'
/** The voices a call may ask for: narration's measured mp3 voices (lib/narration/voices.ts), written out so this file stays import-free. The first is the default (quickest to start speaking). */
export const VOICE_TTS_VOICES: Record<string, { model: string; providerVoice: string }> = {
  ava: { model: 'microsoft/mai-voice-2-flash', providerVoice: 'en-US-AvaNeural' },
  andrew: { model: 'microsoft/mai-voice-2-flash', providerVoice: 'en-US-AndrewNeural' },
  alloy: { model: 'fish-audio/s2.1-pro', providerVoice: 'alloy' },
}
export const VOICE_TTS_DEFAULT = 'ava'

/** About 30 s of 16 kHz mono 16-bit (960,000 bytes of samples) plus the header and a little slack. */
export const VOICE_STT_MAX_BYTES = 1_000_000
/** The multipart envelope around it. */
export const VOICE_STT_MAX_BODY = VOICE_STT_MAX_BYTES + 16_384
/** One spoken sentence: Director's longest spoken line is about 240 characters; the cap leaves room and no more. */
export const VOICE_TTS_MAX_CHARS = 600
export const VOICE_STT_TIMEOUT_MS = 30_000
export const VOICE_TTS_TIMEOUT_MS = 30_000

export const STT_INSTRUCTION = 'Transcribe this recording exactly as spoken. Reply with only the words, no quotes, no notes. If there are no words, reply with nothing.'

export interface RouterAddress { baseUrl: string; key: string }
type Env = Record<string, string | undefined>
type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<Response>

export interface SpeechDeps {
  env: Env
  fetch: FetchLike
  /** The signed-in Studio user's opaque id, or null when nobody is signed in. */
  userId: () => Promise<string | null>
  timeoutMs?: number
  traceId?: () => string
  /** Where the internal figures go (server log). Default console.info. */
  log?: (line: string) => void
}

export function voiceSpeechOn(env: Env): boolean {
  return env[VOICE_SPEECH_FLAG] === 'true'
}

const KEY_SHAPE = /^[\x21-\x7e]+$/
const ID_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/

/** The router's address and key, or null when either is missing or unusable (names only are ever said). */
export function routerAddress(env: Env): RouterAddress | null {
  const raw = (env.MODEL_ROUTER_URL ?? '').trim()
  const key = (env.MODEL_ROUTER_STUDIO_KEY ?? '').trim()
  if (!raw || !KEY_SHAPE.test(key)) return null
  let url: URL
  try { url = new URL(raw) } catch { return null }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  return { baseUrl: `${url.origin}${url.pathname}`.replace(/\/+$/, '').replace(/\/v1$/, ''), key }
}

export function routerHeaders(address: RouterAddress, task: string, userId: string | null, traceId: string | null): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${address.key}`, 'X-MR-Service': 'studio', 'X-MR-Task': task, 'X-MR-Signal': 'headers' }
  if (userId && ID_SHAPE.test(userId)) headers['X-MR-User-ID'] = userId
  if (traceId && ID_SHAPE.test(traceId)) headers['X-MR-Trace-ID'] = traceId
  return headers
}

export interface WavInfo { channels: number; sampleRate: number; bitsPerSample: number; format: number }

/** The fmt chunk of a RIFF/WAVE file, or null when it is not one. */
export function readWavHeader(bytes: Uint8Array): WavInfo | null {
  if (bytes.length < 44) return null
  const tag = (at: number) => String.fromCharCode(bytes[at], bytes[at + 1], bytes[at + 2], bytes[at + 3])
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let at = 12
  while (at + 8 <= bytes.length) {
    const size = view.getUint32(at + 4, true)
    if (tag(at) === 'fmt ' && at + 24 <= bytes.length) {
      return { format: view.getUint16(at + 8, true), channels: view.getUint16(at + 10, true), sampleRate: view.getUint32(at + 12, true), bitsPerSample: view.getUint16(at + 22, true) }
    }
    at += 8 + size + (size % 2)
  }
  return null
}

/** True for exactly what the capture layer sends: PCM, mono, 16 kHz, 16-bit. */
export function isCallWav(info: WavInfo | null): boolean {
  return !!info && info.format === 1 && info.channels === 1 && info.sampleRate === 16_000 && info.bitsPerSample === 16
}

export function buildTranscribeBody(wav: Uint8Array): string {
  return JSON.stringify({
    model: VOICE_STT_MODEL,
    temperature: 0,
    messages: [{ role: 'user', content: [
      { type: 'text', text: STT_INSTRUCTION },
      { type: 'input_audio', input_audio: { data: Buffer.from(wav.buffer, wav.byteOffset, wav.byteLength).toString('base64'), format: 'wav' } },
    ] }],
  })
}

export function buildSpeakBody(text: string, voiceId: string): string {
  const voice = VOICE_TTS_VOICES[voiceId]
  return JSON.stringify({ model: voice.model, input: text, voice: voice.providerVoice, response_format: 'mp3' })
}

/** The transcript in a chat/completions answer (the first choice's content, a string or text parts), or null when the answer has none. */
export function parseTranscript(body: unknown): string | null {
  const choice = (body as { choices?: unknown[] } | null)?.choices?.[0] as { message?: { content?: unknown } } | undefined
  const content = choice?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) return content.map(part => (part && typeof (part as { text?: unknown }).text === 'string' ? (part as { text: string }).text : '')).join('').trim()
  return null
}

/** The router's internal figures for one call (signal headers, plus a completion's usage.cost), as one server log line; null when the router said nothing. Never sent to the browser. */
export function internalSignalLine(task: string, headers: Headers, body?: unknown): string | null {
  const parts: string[] = []
  for (const name of ROUTER_SIGNAL_HEADERS) { const v = headers.get(name); if (v && /^[\x20-\x7e]{1,128}$/.test(v)) parts.push(`${name.slice(5)}=${v}`) }
  const usage = (body as { usage?: { cost?: unknown } } | null)?.usage?.cost
  if (typeof usage === 'number' && Number.isFinite(usage)) parts.push(`usage-cost=${usage}`)
  return parts.length ? `[VoiceCall] ${task} ${parts.join(' ')}` : null
}

function logSignal(deps: SpeechDeps, task: string, headers: Headers, body?: unknown) {
  const line = internalSignalLine(task, headers, body)
  if (line) (deps.log ?? (l => console.info(l)))(line)
}

/** What the client's error shapes need: the status the router (or its absence) maps to. 404/501/503 read "not connected" on the client, 402/429 "a limit". */
export function mapRouterStatus(status: number): number {
  if (status === 402 || status === 429) return 429
  return 502
}

const json = (status: number, error: string, extra?: Record<string, string>) => new Response(JSON.stringify({ error }), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } })
const isAbort = (error: unknown) => typeof error === 'object' && error !== null && ((error as { name?: string }).name === 'AbortError' || (error as { name?: string }).name === 'TimeoutError')

async function callRouter(deps: SpeechDeps, address: RouterAddress, path: string, task: string, body: string, userId: string): Promise<{ response: Response } | { error: Response }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? (task === VOICE_TASKS.stt ? VOICE_STT_TIMEOUT_MS : VOICE_TTS_TIMEOUT_MS))
  try {
    const response = await deps.fetch(`${address.baseUrl}${path}`, { method: 'POST', headers: routerHeaders(address, task, userId, deps.traceId?.() ?? null), body, signal: controller.signal })
    if (!response.ok) return { error: json(mapRouterStatus(response.status), 'The speech service refused that') }
    return { response }
  } catch (error) {
    if (isAbort(error) || controller.signal.aborted) return { error: json(504, 'The speech service took too long') }
    return { error: json(502, 'The speech service could not be reached') }
  } finally {
    clearTimeout(timer)
  }
}

/** The gate both routes share: the flag (404), the signed-in user (401), the router's address (503, which the client reads as "Speech isn't connected yet"). */
async function gate(deps: SpeechDeps): Promise<{ error: Response } | { userId: string; address: RouterAddress }> {
  if (!voiceSpeechOn(deps.env)) return { error: json(404, 'Not found') }
  const userId = await deps.userId()
  if (!userId) return { error: json(401, 'Unauthorized') }
  const address = routerAddress(deps.env)
  if (!address) return { error: json(503, 'Speech is not connected') }
  return { userId, address }
}

/** POST /api/studio/voice/transcribe: multipart `audio` (WAV, 16 kHz, mono, 16-bit) -> 200 { text } (no cost header: cost is internal). */
export async function handleTranscribe(request: Request, deps: SpeechDeps): Promise<Response> {
  const gated = await gate(deps)
  if ('error' in gated) return gated.error
  const type = (request.headers.get('content-type') ?? '').toLowerCase()
  if (!type.startsWith('multipart/form-data')) return json(415, 'Send the recording as multipart/form-data')
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > VOICE_STT_MAX_BODY) return json(413, 'That recording is too long')
  let file: unknown
  try { file = (await request.formData()).get('audio') } catch { return json(415, 'Send the recording as multipart/form-data') }
  if (!file || typeof file === 'string' || typeof (file as Blob).arrayBuffer !== 'function') return json(415, 'The recording is missing')
  if ((file as Blob).size > VOICE_STT_MAX_BYTES) return json(413, 'That recording is too long')
  const blobType = ((file as Blob).type || '').toLowerCase()
  if (blobType && blobType !== 'audio/wav' && blobType !== 'audio/x-wav' && blobType !== 'audio/wave' && blobType !== 'application/octet-stream') return json(415, 'The recording must be a WAV')
  const wav = new Uint8Array(await (file as Blob).arrayBuffer())
  if (wav.byteLength > VOICE_STT_MAX_BYTES) return json(413, 'That recording is too long')
  if (!isCallWav(readWavHeader(wav))) return json(415, 'The recording must be a 16 kHz mono 16-bit WAV')
  const routed = await callRouter(deps, gated.address, '/v1/chat/completions', VOICE_TASKS.stt, buildTranscribeBody(wav), gated.userId)
  if ('error' in routed) return routed.error
  let body: unknown
  try { body = await routed.response.json() } catch { return json(502, 'The speech service answered something unreadable') }
  const text = parseTranscript(body)
  if (text === null) return json(502, 'The speech service answered something unreadable')
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  logSignal(deps, VOICE_TASKS.stt, routed.response.headers, body)
  return new Response(JSON.stringify({ text }), { status: 200, headers })
}

/** POST /api/studio/voice/speak: JSON { text, voice? } -> 200 audio (Content-Type from the router, x-generation-id passed through, no cost header: cost is internal). */
export async function handleSpeak(request: Request, deps: SpeechDeps): Promise<Response> {
  const gated = await gate(deps)
  if ('error' in gated) return gated.error
  if (!(request.headers.get('content-type') ?? '').toLowerCase().startsWith('application/json')) return json(415, 'Send JSON')
  let body: { text?: unknown; voice?: unknown }
  try { body = await request.json() } catch { return json(400, 'Invalid request body') }
  const text = typeof body?.text === 'string' ? body.text.trim() : ''
  if (!text) return json(400, 'text is required')
  if (text.length > VOICE_TTS_MAX_CHARS) return json(413, 'That line is too long')
  const voice = body.voice === undefined || body.voice === null ? VOICE_TTS_DEFAULT : body.voice
  if (typeof voice !== 'string' || !Object.prototype.hasOwnProperty.call(VOICE_TTS_VOICES, voice)) return json(400, 'Unknown voice')
  const routed = await callRouter(deps, gated.address, '/v1/audio/speech', VOICE_TASKS.tts, buildSpeakBody(text, voice), gated.userId)
  if ('error' in routed) return routed.error
  const contentType = routed.response.headers.get('content-type') ?? ''
  if (!contentType.toLowerCase().startsWith('audio/')) return json(502, 'The speech service answered something that is not audio')
  const headers: Record<string, string> = { 'Content-Type': contentType, 'Cache-Control': 'no-store' }
  const generation = routed.response.headers.get('x-generation-id')
  if (generation) headers['x-generation-id'] = generation
  logSignal(deps, VOICE_TASKS.tts, routed.response.headers)
  return new Response(routed.response.body, { status: 200, headers })
}
