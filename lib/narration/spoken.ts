/**
 * The lines the deck says that are not slides.
 *
 * Three of them, and they have very different lifetimes:
 *
 *   **Announcements** are fixed text. "Running long — let me bring this home."
 *   One per voice, rendered once, cached forever. Identical for every deck.
 *
 *   **The closing** is per-deck but stable. Rendered with the deck's segments
 *   and stored in the ledger like any slide.
 *
 *   **Answers** are per-question and never repeat. Rendered inside the pause the
 *   audience is sitting in, and deliberately NOT stored — a ledger row for a
 *   sentence nobody will hear twice is a row that only costs storage.
 *
 * The thing that decides whether any of this is bearable is latency, which is
 * why the voice registry measures it. A viewer who has just asked a question is
 * waiting in silence; two seconds reads as thinking, nine reads as broken.
 */

import { getVoice, canSpeakLiveAnswers } from './voices'
import { synthesize, type SynthesisResult } from './tts'
import { pcmToWav } from './wav'
import { contentKey, getMedia, putMedia } from './media-store'

/**
 * What the deck says when the clock beats it.
 *
 * Spoken rather than shown, because the audience is listening, not reading —
 * and because a presenter who is running late says so out loud rather than
 * putting a caption on the wall. Deliberately warm and brief: it is an
 * apology-adjacent moment and the worst version is a long one.
 */
export const RUNNING_LONG_LINE =
  "We're a little tight on time, so let me bring this home."

/** Fallback when a deck has no closing of its own. Says nothing specific,
 *  because it cannot — but it still ENDS, which is the entire job. */
export const DEFAULT_CLOSING_LINE =
  "That's the core of it. The detail is all in the deck, and I'm happy to take questions."

export function canSpeakAnswers(voiceId: string): boolean {
  return canSpeakLiveAnswers(getVoice(voiceId))
}

function audioFrom(result: SynthesisResult): { body: Buffer; contentType: string } {
  return result.format === 'pcm'
    ? { body: pcmToWav(result.audio), contentType: 'audio/wav' }
    : { body: result.audio, contentType: 'audio/mpeg' }
}

/**
 * Render a fixed line for a voice, once, forever.
 *
 * Used for announcements: the text is a constant in this file, so the content
 * key changes only when the wording or the voice does. Every deck in the system
 * shares one object per voice.
 */
export async function speakFixedLine(
  text: string,
  voiceId: string,
  slot: string
): Promise<{ body: Buffer; contentType: string; cached: boolean } | null> {
  const voice = getVoice(voiceId)
  const key = contentKey({ text, model: voice.model, providerVoice: voice.providerVoice })
  const extension = voice.responseFormat === 'pcm' ? 'wav' : 'mp3'
  const path = `spoken/${slot}/${voice.id}.${key}.${extension}`

  const stored = await getMedia(path)
  if (stored) return { ...stored, cached: true }

  try {
    const result = await synthesize(text, voice.id)
    const audio = audioFrom(result)
    await putMedia(path, audio.body, audio.contentType)
    return { ...audio, cached: false }
  } catch (error) {
    // A missing announcement must never stop a presentation. The run falls back
    // to the on-screen notice, which is what it had before this existed.
    console.error(`[Narration] could not render the ${slot} line for ${voice.id}:`, error)
    return null
  }
}

/**
 * Speak one answer, now.
 *
 * NOT cached: this sentence will not be said again, so a stored object and a
 * ledger row would both be pure cost. The audience is waiting while this runs,
 * which is why only voices that start speaking inside the live-answer threshold
 * are allowed to reach it at all.
 */
export async function speakAnswer(
  text: string,
  voiceId: string
): Promise<{ body: Buffer; contentType: string; costCents: number } | null> {
  if (!canSpeakAnswers(voiceId)) return null
  const voice = getVoice(voiceId)
  try {
    const result = await synthesize(text, voice.id)
    const audio = audioFrom(result)
    const seconds =
      result.durationSeconds ?? text.split(/\s+/).filter(Boolean).length / (140 / 60)
    return {
      ...audio,
      costCents: Math.max(0, Math.ceil((seconds / 60) * voice.costPerMinuteUsd * 100)),
    }
  } catch (error) {
    console.error('[Narration] could not speak an answer:', error)
    return null
  }
}
