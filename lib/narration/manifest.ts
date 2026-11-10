/**
 * What a deck can actually play, right now.
 *
 * Built once per session rather than resolved per slide, because the expensive
 * part — reading the deck to learn what each slide currently SAYS — has to
 * happen before any audio can be trusted, and doing it per request would put a
 * multi-megabyte deck fetch behind every play button.
 *
 * The property this exists to guarantee:
 *
 *   **A slide whose script has changed since it was recorded plays NOTHING.**
 *
 * Not the old audio. Speaking words the author has replaced, over the slide
 * they replaced them on, is the worst failure this feature has available to it
 * — worse than silence, because silence is obviously missing and wrong words
 * sound authoritative. So staleness is decided here, by hash, and a stale slide
 * comes back with no segment at all.
 */

import { prisma } from '@/lib/prisma'
import { canSpeakLiveAnswers, getVoice } from './voices'
import { renderSpecHash, scriptHash, type SegmentVariant } from './segments'

export interface SlideAudio {
  slideId: string
  index: number
  /** Segment ids, or null when there is nothing safe to play. */
  full: string | null
  compressed: string | null
  fullDurationMs: number | null
  compressedDurationMs: number | null
  /** True when a script exists but its recording is out of date. Surfaced so
   *  the creator can be told to re-record rather than left wondering why a
   *  slide is silent. */
  stale: boolean
}

export interface NarrationManifest {
  voiceId: string
  voiceName: string
  slides: SlideAudio[]
  /** The segment that ends a session from ANY point. Reserved out of the budget
   *  so it can never be squeezed out — a deck may be consumed to zero, but never
   *  past the point where there is no ending. */
  closing: string | null
  closingDurationMs: number | null
  /** Whether this deck's voice starts speaking fast enough to answer live. */
  speaksAnswers: boolean
  /** Slides with a script but no usable audio. */
  missing: number
  totalDurationMs: number
}

/**
 * Resolve every slide's playable audio for one voice.
 *
 * `slides` comes from the deck JSON the caller already holds, so this adds one
 * indexed database read and no network calls.
 */
export async function buildManifest(
  presentationId: string,
  slides: Record<string, unknown>[],
  voiceId: string
): Promise<NarrationManifest> {
  const voice = getVoice(voiceId)
  const specHash = renderSpecHash(voice)

  // One query for the whole deck. Every ready segment in this voice, which is a
  // superset of what we need — filtering by script hash in memory is cheaper
  // than a query per slide per variant.
  const rows = await prisma.mediaSegment.findMany({
    where: { presentationId, renderSpecHash: specHash, kind: 'audio', status: 'ready' },
    select: { id: true, slideId: true, variant: true, scriptHash: true, durationMs: true },
  })
  const bySlide = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = bySlide.get(row.slideId) ?? []
    list.push(row)
    bySlide.set(row.slideId, list)
  }

  let missing = 0
  let totalDurationMs = 0

  const resolved: SlideAudio[] = slides.map((slide, index) => {
    const slideId = String(
      (slide as { slide_id?: unknown; id?: unknown }).slide_id ??
        (slide as { id?: unknown }).id ??
        index
    )
    const candidates = bySlide.get(slideId) ?? []

    const pick = (variant: SegmentVariant, script: unknown) => {
      if (typeof script !== 'string' || !script.trim()) return null
      const wanted = scriptHash(script)
      // Matched on the hash of the CURRENT script, never on recency. A newer
      // recording of older words is still the wrong words.
      return candidates.find((r) => r.variant === variant && r.scriptHash === wanted) ?? null
    }

    const fullRow = pick('full', (slide as { script?: unknown }).script)
    const compressedRow = pick('compressed', (slide as { script_compressed?: unknown }).script_compressed)

    const hasScript =
      typeof (slide as { script?: unknown }).script === 'string' &&
      ((slide as { script?: string }).script ?? '').trim().length > 0
    const stale = hasScript && !fullRow
    if (stale) missing += 1
    if (fullRow?.durationMs) totalDurationMs += fullRow.durationMs

    return {
      slideId,
      index,
      full: fullRow?.id ?? null,
      compressed: compressedRow?.id ?? null,
      fullDurationMs: fullRow?.durationMs ?? null,
      compressedDurationMs: compressedRow?.durationMs ?? null,
      stale,
    }
  })

  const closingRow = rows.find((r) => r.variant === 'closing') ?? null

  return {
    voiceId: voice.id,
    voiceName: voice.name,
    slides: resolved,
    closing: closingRow?.id ?? null,
    closingDurationMs: closingRow?.durationMs ?? null,
    speaksAnswers: canSpeakLiveAnswers(voice),
    missing,
    totalDurationMs,
  }
}
