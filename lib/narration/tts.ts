/**
 * Speech synthesis, behind one interface.
 *
 * Everything goes through OpenRouter's `/api/v1/audio/speech`, which is
 * OpenAI-Audio-Speech-compatible. That is deliberate and it is the whole
 * reversibility story: switching a voice to a different vendor is a row in
 * `NARRATION_VOICES`, not a new adapter, because every vendor is already
 * behind one endpoint, one key and one usage ledger — the same one the rest of
 * the platform's model traffic already runs through.
 *
 * `MediaProvider` exists so that if OpenRouter ever stops being the right
 * gateway, the thing that gets replaced is this file and nothing else.
 */

import { getVoice, type NarrationVoice } from './voices'

const OPENROUTER_SPEECH_URL = 'https://openrouter.ai/api/v1/audio/speech'

/** 24 kHz, 16-bit, mono — the shape Gemini returns headerless PCM in. */
export const PCM_SAMPLE_RATE = 24000
export const PCM_BYTES_PER_SAMPLE = 2

export interface SynthesisResult {
  audio: Buffer
  /** 'mp3' is storable as-is; 'pcm' must be transcoded before it goes in a bucket. */
  format: 'mp3' | 'pcm'
  contentType: string
  /** OpenRouter's id for this generation — the handle for the billed cost. */
  generationId: string | null
  /** Seconds until the first byte arrived. Worth recording: it is the number
   *  that decides whether a voice may ever answer a question live. */
  firstAudioSeconds: number
  /** Exact for PCM (bytes ÷ rate); null for mp3, which needs a probe. */
  durationSeconds: number | null
}

export interface MediaProvider {
  synthesize(text: string, voice: NarrationVoice): Promise<SynthesisResult>
}

export class SynthesisError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly voiceId: string
  ) {
    super(message)
    this.name = 'SynthesisError'
  }
}

export function isNarrationConfigured(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY)
}

class OpenRouterSpeechProvider implements MediaProvider {
  async synthesize(text: string, voice: NarrationVoice): Promise<SynthesisResult> {
    const key = process.env.OPENROUTER_API_KEY
    if (!key) {
      throw new SynthesisError('OPENROUTER_API_KEY is not configured', null, voice.id)
    }
    const trimmed = text.trim()
    if (!trimmed) {
      throw new SynthesisError('Nothing to speak', null, voice.id)
    }

    const started = Date.now()
    let response: Response
    try {
      response = await fetch(OPENROUTER_SPEECH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          model: voice.model,
          input: trimmed,
          voice: voice.providerVoice,
          // Per-voice, not global: Gemini rejects mp3 outright and is the only
          // one that does. Carrying the quirk in the voice row keeps every
          // caller from having to know about it.
          response_format: voice.responseFormat,
        }),
      })
    } catch (error) {
      throw new SynthesisError(
        `Could not reach the speech service: ${error instanceof Error ? error.message : 'unknown'}`,
        null,
        voice.id
      )
    }

    const firstAudioSeconds = (Date.now() - started) / 1000

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new SynthesisError(
        `Speech synthesis failed (${response.status}): ${detail.slice(0, 200)}`,
        response.status,
        voice.id
      )
    }

    const audio = Buffer.from(await response.arrayBuffer())
    // A 200 carrying almost nothing is a provider failure wearing a success
    // code. Treat it as an error rather than storing a silent segment.
    if (audio.byteLength < 500) {
      throw new SynthesisError(
        `Speech synthesis returned ${audio.byteLength} bytes, which is not audio`,
        response.status,
        voice.id
      )
    }

    return {
      audio,
      format: voice.responseFormat,
      contentType: voice.responseFormat === 'mp3' ? 'audio/mpeg' : 'audio/pcm',
      generationId: response.headers.get('x-generation-id'),
      firstAudioSeconds,
      durationSeconds:
        voice.responseFormat === 'pcm'
          ? audio.byteLength / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE)
          : null,
    }
  }
}

export const mediaProvider: MediaProvider = new OpenRouterSpeechProvider()

export function synthesize(text: string, voiceId: string): Promise<SynthesisResult> {
  return mediaProvider.synthesize(text, getVoice(voiceId))
}

/**
 * What OpenRouter actually charged for a generation.
 *
 * Used to reconcile the estimate a publisher was shown against the real cost,
 * and to keep `NARRATION_VOICES` honest over time — a vendor changing its rate
 * should show up here rather than in a surprise invoice. Best-effort: the
 * record lags the response slightly, and never failing the render over it is
 * the right trade.
 */
export async function billedCostUsd(generationId: string | null): Promise<number | null> {
  const key = process.env.OPENROUTER_API_KEY
  if (!generationId || !key) return null
  try {
    const response = await fetch(
      `https://openrouter.ai/api/v1/generation?id=${encodeURIComponent(generationId)}`,
      { headers: { Authorization: `Bearer ${key}` } }
    )
    if (!response.ok) return null
    const body = (await response.json()) as { data?: { total_cost?: number } }
    return body?.data?.total_cost ?? null
  } catch {
    return null
  }
}
