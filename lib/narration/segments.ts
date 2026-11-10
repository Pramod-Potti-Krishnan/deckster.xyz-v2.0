/**
 * The rendered-audio ledger.
 *
 * Narration is expensive in a way text is not: every render is a paid call, and
 * a 20-slide deck in two variants is 40 of them. So the governing design is that
 * **audio is addressed by its content, never by the deck it belongs to.**
 *
 * Two hashes decide everything:
 *
 *   scriptHash      the exact words
 *   renderSpecHash  the voice, the model, the provider voice, the format
 *
 * Edit slide 7 and only its scriptHash moves, so one segment re-renders and
 * nineteen are untouched. Change the voice and renderSpecHash moves for every
 * row, so the deck re-renders in full — which is precisely why that has to be
 * priced before it is allowed to start, not discovered afterwards.
 *
 * The UNIQUE index is the cache. A `ready` row is proof the audio exists; we
 * never infer it from a timestamp or a status flag alone.
 */

import { createHash } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { getVoice, type NarrationVoice } from './voices'

export type SegmentVariant = 'full' | 'compressed' | 'closing'
export const SEGMENT_VARIANTS: SegmentVariant[] = ['full', 'compressed', 'closing']

/**
 * Bump when the render pipeline changes what the bytes sound like — a different
 * sample rate, a different container, a change to how text is prepared before
 * synthesis. It is part of renderSpecHash, so bumping it invalidates every
 * cached segment on purpose.
 *
 * NOT bumped for changes that cannot alter the audio (logging, error handling),
 * because a needless bump re-renders every deck every publisher owns.
 */
export const RENDER_ENGINE_VERSION = 'v1'

/**
 * Normalise before hashing so cosmetic edits don't force a re-render.
 *
 * Collapsing whitespace and trimming means re-wrapping a paragraph in the Script
 * tab costs nothing, while changing a word costs one segment. Case is NOT
 * normalised — a voice reads "IT" and "it" differently.
 */
export function scriptHash(script: string): string {
  return createHash('sha256')
    .update(script.replace(/\s+/g, ' ').trim())
    .digest('hex')
    .slice(0, 32)
}

/**
 * Everything about HOW the words are spoken.
 *
 * The model id and the provider's voice id are both in here deliberately. If a
 * voice were ever repointed at a different model — a cheaper vendor, a
 * deprecated preview replaced — segments rendered before the switch would
 * otherwise still count as valid, and a deck would speak in two different
 * voices partway through. That is the failure this hash exists to prevent.
 */
export function renderSpecHash(voice: NarrationVoice): string {
  // NUL-joined so the parts cannot run together and collide: without a
  // separator, model 'a/b' + voice 'cd' and model 'a/bc' + voice 'd' would
  // hash identically. NUL is the one byte none of these inputs can contain.
  return createHash('sha256')
    .update(
      [
        voice.id,
        voice.model,
        voice.providerVoice,
        voice.responseFormat,
        RENDER_ENGINE_VERSION,
      ].join('\u0000')
    )
    .digest('hex')
    .slice(0, 32)
}

/** Where a segment's audio lives in the `deck-media` bucket. Content-addressed
 *  like the row, so a stale object can never be served for a fresh hash. */
export function segmentPath(
  presentationId: string,
  slideId: string,
  variant: SegmentVariant,
  script: string,
  voice: NarrationVoice
): string {
  const extension = voice.responseFormat === 'pcm' ? 'wav' : 'mp3'
  return `narration/${presentationId}/${slideId}.${variant}.${scriptHash(script)}.${renderSpecHash(voice)}.${extension}`
}

export interface SegmentRequest {
  presentationId: string
  slideId: string
  variant: SegmentVariant
  script: string
  voiceId: string
}

/**
 * The already-rendered segment for this exact content, or null.
 *
 * Only `ready` counts. A `failed` row is a record of an attempt, not an asset,
 * and a `pending` one is a render that may never have finished — serving either
 * would mean a slide that plays nothing.
 */
export async function findReadySegment(request: SegmentRequest) {
  const voice = getVoice(request.voiceId)
  return prisma.mediaSegment.findFirst({
    where: {
      slideId: request.slideId,
      variant: request.variant,
      scriptHash: scriptHash(request.script),
      renderSpecHash: renderSpecHash(voice),
      kind: 'audio',
      status: 'ready',
    },
  })
}

/**
 * Record a finished render.
 *
 * Upserted on the content key rather than inserted, because two requests can
 * legitimately race for the same segment — a publisher clicking twice, a retry
 * arriving late. The loser overwriting the winner with identical audio is
 * harmless; a unique-constraint crash in the middle of a 40-segment render is
 * not.
 */
export async function recordSegment(
  request: SegmentRequest,
  userId: string,
  result: {
    status: 'ready' | 'failed'
    assetPath?: string | null
    durationMs?: number | null
    bytes?: number | null
    costCents?: number
    error?: string | null
  }
) {
  const voice = getVoice(request.voiceId)
  const key = {
    slideId: request.slideId,
    variant: request.variant,
    scriptHash: scriptHash(request.script),
    renderSpecHash: renderSpecHash(voice),
    kind: 'audio',
  }
  const data = {
    ...key,
    userId,
    presentationId: request.presentationId,
    voiceId: voice.id,
    status: result.status,
    assetPath: result.assetPath ?? null,
    durationMs: result.durationMs ?? null,
    bytes: result.bytes ?? null,
    costCents: result.costCents ?? 0,
    error: result.error ?? null,
  }
  return prisma.mediaSegment.upsert({
    where: {
      slideId_variant_scriptHash_renderSpecHash_kind: key,
    },
    create: data,
    update: data,
  })
}

/**
 * What a deck currently has rendered, and what it cost.
 *
 * Counts only `ready` segments toward coverage: a failed render is not audio,
 * and reporting it as progress would tell a publisher their deck can speak when
 * it cannot.
 */
export async function deckSegmentSummary(presentationId: string) {
  const rows = await prisma.mediaSegment.findMany({
    where: { presentationId },
    select: { status: true, costCents: true, durationMs: true, variant: true },
  })
  const ready = rows.filter((r) => r.status === 'ready')
  return {
    ready: ready.length,
    failed: rows.filter((r) => r.status === 'failed').length,
    totalCostCents: rows.reduce((sum, r) => sum + r.costCents, 0),
    totalDurationMs: ready.reduce((sum, r) => sum + (r.durationMs ?? 0), 0),
  }
}
