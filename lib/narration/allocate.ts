/**
 * Dividing a deck's speaking time between its slides.
 *
 * The naive answer — total minutes ÷ slide count — is wrong in the way that
 * matters most: a title slide and a dense comparison slide would get the same
 * time, so the title drags and the comparison races. What a deck actually needs
 * is time in proportion to how much each slide has to say.
 *
 * Researcher already knows that. It emits `duration_seconds_estimate` per
 * slide, and the whole point of re-threading it through Director, Slide Builder
 * and Layout was to have it here. These are used as WEIGHTS, not as absolute
 * durations: they express the deck's internal shape, and the shape is then
 * scaled to whatever slot the publisher actually has.
 *
 * So a 6-slide deck whose estimates sum to 5 minutes, given a 15-minute slot,
 * keeps its proportions and speaks for 15 minutes — it does not stop at 5.
 */

import { wordBudget } from './budget'

/** A slide with no estimate falls back to this before weighting. Roughly what
 *  Researcher's own default is (45s), so a mixed deck stays sane. */
export const FALLBACK_SLIDE_SECONDS = 45

/** No slide gets less than this: below it there is no room for a sentence, and
 *  a slide that flashes past unnarrated reads as a bug. */
export const MIN_SLIDE_SECONDS = 8

export interface SlideAllocation {
  slideId: string
  index: number
  seconds: number
  /** Words the full variant may run to. */
  words: number
  /** Words the compressed variant may run to. */
  compressedWords: number
  /** True when this slide had no estimate and was given the fallback weight. */
  estimated: boolean
}

/**
 * Spread `totalMinutes` across slides in proportion to their estimates.
 *
 * Returns an empty array for an empty deck or a non-positive budget rather than
 * dividing by zero — callers treat that as "nothing to generate".
 */
export function allocate(
  slides: { slideId: string; durationSeconds?: number | null }[],
  totalMinutes: number,
  compressedRatio: number
): SlideAllocation[] {
  if (slides.length === 0 || !(totalMinutes > 0)) return []

  const weights = slides.map((slide) => {
    const raw = slide.durationSeconds
    const usable = typeof raw === 'number' && Number.isFinite(raw) && raw > 0
    return { weight: usable ? raw : FALLBACK_SLIDE_SECONDS, estimated: !usable }
  })

  const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0)
  const totalSeconds = totalMinutes * 60

  // Scale the shape to the slot, then enforce the floor. The floor can push the
  // sum over budget on a deck with many tiny slides; that is the right way to be
  // wrong — a slide with one short sentence is recoverable, a slide with none
  // looks broken.
  return slides.map((slide, index) => {
    const share = weights[index].weight / totalWeight
    const seconds = Math.max(MIN_SLIDE_SECONDS, Math.round(totalSeconds * share))
    const minutes = seconds / 60
    return {
      slideId: slide.slideId,
      index,
      seconds,
      words: Math.max(12, wordBudget(minutes)),
      compressedWords: Math.max(8, Math.round(wordBudget(minutes) * compressedRatio)),
      estimated: weights[index].estimated,
    }
  })
}

/** Total seconds an allocation actually comes to — may exceed the budget when
 *  the per-slide floor bound. Surfaced so the UI can say so rather than quietly
 *  overrunning the publisher's slot. */
export function allocatedSeconds(allocations: SlideAllocation[]): number {
  return allocations.reduce((sum, a) => sum + a.seconds, 0)
}
