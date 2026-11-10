/**
 * The narration voice library.
 *
 * A publisher picks a VOICE. The model behind it is an implementation detail
 * they never see — which is the point: "Alloy" is a thing a person can choose,
 * `fish-audio/s2.1-pro` is not.
 *
 * Every number here was MEASURED, not taken from a published rate. The vendors
 * quote per character, per UTF-8 byte and per output token, which do not
 * compare on paper — and the one figure we did derive from a published rate
 * (Gemini at 25 tokens/second) turned out to be wrong by 2× when actually
 * rendered. So the source of truth is a real render of one fixed 15-second
 * script through every model, priced from OpenRouter's own billing record and
 * timed with ffprobe. Re-run `scripts/narration-voice-bakeoff.mjs` to refresh.
 *
 * Measured 2026-08-10 against openrouter.ai/api/v1/audio/speech.
 */

/**
 * How long a viewer will sit in silence before a spoken answer begins, above
 * which a voice is not offered for live Q&A.
 *
 * Two seconds sounds generous until you count what precedes it. A spoken answer
 * cannot start until the WHOLE answer exists — the citation and numeric-
 * containment gates are text operations and need the complete text before any
 * of it may be spoken. Retrieval, grounding and restyle already cost ~4-5s on
 * live UAT traffic. TTS latency stacks on top of that; it does not overlap it.
 *
 * So a 9-second voice means ~14 seconds of silence after someone asks a
 * question, which reads as a broken page rather than a thoughtful pause.
 */
export const LIVE_ANSWER_MAX_FIRST_AUDIO_SECONDS = 2.0

export interface NarrationVoice {
  /** Our stable id. Never the vendor's — vendors get swapped, decks do not. */
  id: string
  name: string
  /** What a publisher needs to know to choose, in their terms. */
  description: string
  model: string
  providerVoice: string
  /**
   * Gemini refuses `mp3` and returns headerless 24 kHz 16-bit mono PCM. Nothing
   * on its model page or in the TTS guide says so; it surfaces as a 400. The
   * render worker transcodes before storing, so this stays a vendor quirk
   * rather than leaking into the segment format.
   */
  responseFormat: 'mp3' | 'pcm'
  /** Measured USD per minute of finished audio. */
  costPerMinuteUsd: number
  /** Measured seconds to first audio byte. */
  firstAudioSeconds: number
}

export const NARRATION_VOICES: NarrationVoice[] = [
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'Warm and even. The best all-rounder for narration.',
    model: 'fish-audio/s2.1-pro',
    providerVoice: 'alloy',
    responseFormat: 'mp3',
    costPerMinuteUsd: 0.0156,
    firstAudioSeconds: 0.87,
  },
  {
    id: 'ava',
    name: 'Ava',
    description: 'Clear and businesslike. The quickest to start speaking.',
    model: 'microsoft/mai-voice-2-flash',
    providerVoice: 'en-US-AvaNeural',
    responseFormat: 'mp3',
    costPerMinuteUsd: 0.0137,
    firstAudioSeconds: 0.68,
  },
  {
    id: 'andrew',
    name: 'Andrew',
    description: 'Clear and businesslike, lower register.',
    model: 'microsoft/mai-voice-2-flash',
    providerVoice: 'en-US-AndrewNeural',
    responseFormat: 'mp3',
    costPerMinuteUsd: 0.0142,
    firstAudioSeconds: 0.83,
  },
  {
    id: 'heart',
    name: 'Heart',
    description: 'Natural and unhurried, and by far the cheapest to render.',
    model: 'hexgrad/kokoro-82m',
    providerVoice: 'af_heart',
    responseFormat: 'mp3',
    costPerMinuteUsd: 0.0005,
    firstAudioSeconds: 4.66,
  },
  {
    id: 'zephyr',
    name: 'Zephyr',
    description: 'The most expressive of the set. Slow and costly to render.',
    model: 'google/gemini-3.1-flash-tts-preview',
    providerVoice: 'Zephyr',
    responseFormat: 'pcm',
    costPerMinuteUsd: 0.0585,
    firstAudioSeconds: 17.74,
  },
  {
    id: 'puck',
    name: 'Puck',
    description: 'Bright and characterful. Slow and costly to render.',
    model: 'google/gemini-3.1-flash-tts-preview',
    providerVoice: 'Puck',
    responseFormat: 'pcm',
    costPerMinuteUsd: 0.0599,
    firstAudioSeconds: 9.02,
  },
  {
    id: 'charon',
    name: 'Charon',
    description: 'Measured and authoritative. Slow and costly to render.',
    model: 'google/gemini-3.1-flash-tts-preview',
    providerVoice: 'Charon',
    responseFormat: 'pcm',
    costPerMinuteUsd: 0.0594,
    firstAudioSeconds: 7.65,
  },
  {
    id: 'kore',
    name: 'Kore',
    description: 'Even and precise. Slow and costly to render.',
    model: 'google/gemini-3.1-flash-tts-preview',
    providerVoice: 'Kore',
    responseFormat: 'pcm',
    costPerMinuteUsd: 0.0596,
    firstAudioSeconds: 10.41,
  },
  {
    id: 'aoede',
    name: 'Aoede',
    description: 'Softer and more lyrical. Slow and costly to render.',
    model: 'google/gemini-3.1-flash-tts-preview',
    providerVoice: 'Aoede',
    responseFormat: 'pcm',
    costPerMinuteUsd: 0.0604,
    firstAudioSeconds: 9.18,
  },
]

/**
 * The default. Fast enough for live answers, mid-priced, and the one that held
 * up best on a listen — so a publisher who never opens the picker still gets a
 * voice that works everywhere the product uses one.
 */
export const DEFAULT_VOICE_ID = 'alloy'

export function getVoice(id: string | null | undefined): NarrationVoice {
  return (
    NARRATION_VOICES.find((v) => v.id === id) ??
    NARRATION_VOICES.find((v) => v.id === DEFAULT_VOICE_ID)!
  )
}

export function isKnownVoiceId(id: unknown): id is string {
  return typeof id === 'string' && NARRATION_VOICES.some((v) => v.id === id)
}

/**
 * Can this voice speak a live Q&A answer, or only pre-rendered narration?
 *
 * Derived from the measured latency rather than hand-flagged, so re-running the
 * bake-off updates it and nobody has to remember to.
 */
export function canSpeakLiveAnswers(voice: NarrationVoice): boolean {
  return voice.firstAudioSeconds <= LIVE_ANSWER_MAX_FIRST_AUDIO_SECONDS
}

/**
 * What rendering this deck will cost, in whole cents, rounded up.
 *
 * Rounded UP so the number a publisher is shown is never less than what they
 * are charged. `minutes` is the finished audio across every variant, not the
 * deck's running time.
 */
export function estimateCostCents(voice: NarrationVoice, minutes: number): number {
  if (!(minutes > 0)) return 0
  return Math.ceil(voice.costPerMinuteUsd * minutes * 100)
}

/**
 * Total finished audio for a deck of `runtimeMinutes`, across all three
 * variants: full, compressed (~55% of full) and the closing segment.
 *
 * The closing is a fixed ~40s rather than a proportion — it says the same kind
 * of thing whether the deck is five minutes or fifty.
 */
export const COMPRESSED_VARIANT_RATIO = 0.55
export const CLOSING_VARIANT_MINUTES = 0.67

export function totalRenderMinutes(runtimeMinutes: number): number {
  if (!(runtimeMinutes > 0)) return 0
  return runtimeMinutes * (1 + COMPRESSED_VARIANT_RATIO) + CLOSING_VARIANT_MINUTES
}
