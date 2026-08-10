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

/**
 * How much of an answer is worth SAYING.
 *
 * About fifteen seconds. A spoken answer is not a written one read aloud: the
 * audience is mid-presentation, they cannot re-read a sentence they missed, and
 * a minute of speech to answer one question costs more of the session than the
 * question was worth.
 *
 * So the deck says the short form and points at the written one, which is
 * already on screen and already carries the citations.
 */
export const SPOKEN_ANSWER_MAX_WORDS = 35
export const SPOKEN_ANSWER_TAIL = " There's more detail in the chat."

/**
 * The spoken form of an answer.
 *
 * Whole SENTENCES up to the budget, never a truncation — "the figure fell by
 * twenty-five per" is worse than saying less. And a subset of already-verified
 * text rather than a fresh generation, so nothing new can be introduced and no
 * second model call sits between the question and the reply.
 */
export function spokenPrecis(text: string, maxWords = SPOKEN_ANSWER_MAX_WORDS): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) return ''
  const wordCount = (value: string) => value.split(' ').filter(Boolean).length
  if (wordCount(clean) <= maxWords) return clean

  const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean]
  let out = ''
  for (const sentence of sentences) {
    const next = `${out}${sentence}`.trim()
    // Accept a sentence only if the RESULT still fits. Checking `out` first —
    // as an earlier version did — let the very first sentence through at any
    // length, so an unpunctuated answer was read out in full.
    if (wordCount(next) > maxWords) break
    out = next
  }
  // Nothing fit, which means one sentence is longer than the whole budget. It
  // still has to stop somewhere; a word boundary is the least-bad version of a
  // bad case, and the pointer below tells the listener where the rest is.
  if (!out) out = `${clean.split(' ').slice(0, maxWords).join(' ')}…`

  return out.trim() + SPOKEN_ANSWER_TAIL
}

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
