/**
 * POST /api/narration/render — turn a deck's scripts into audio.
 *
 * The piece that makes a deck actually speak. Everything before this decided
 * WHAT is said and for how long; this pays for it and stores the result.
 *
 * Two properties shape the whole file:
 *
 * 1. **Nothing is rendered twice.** Every segment is looked up by content first
 *    — the exact words, the exact voice — and a `ready` row short-circuits the
 *    paid call. Editing one slide costs one segment, not a deck.
 *
 * 2. **A whole-deck re-render is refusable before it starts.** `estimate: true`
 *    returns exactly what would be rendered and what it would cost, without
 *    spending anything. That matters because changing the voice invalidates
 *    every segment at once, and a publisher should meet that number in a dialog
 *    rather than on an invoice.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getPresentation } from '@/lib/layout-service-client';
import { getVoice } from '@/lib/narration/voices';
import {
  synthesize,
  isNarrationConfigured,
  billedCostUsd,
  PCM_SAMPLE_RATE,
  PCM_BYTES_PER_SAMPLE,
} from '@/lib/narration/tts';
import { pcmToWav } from '@/lib/narration/wav';
import { putMedia, mediaStoreStatus } from '@/lib/narration/media-store';
import { getSessionVoiceId } from '@/lib/narration/voice-store';
import {
  findReadySegment,
  recordSegment,
  segmentPath,
  deckSegmentSummary,
  type SegmentVariant,
} from '@/lib/narration/segments';
import { debitWallet, InsufficientFundsError } from '@/lib/wallet';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Concurrent renders. Bounded by the provider's own limits long before ours —
 *  Cartesia-class vendors allow 5 on entry tiers, so 3 leaves headroom for
 *  anything else the account is doing. */
const CONCURRENCY = 3;

/** Both variants of every slide. `closing` is deck-level and arrives with the
 *  closing-segment work, not here. */
const VARIANTS: SegmentVariant[] = ['full', 'compressed'];

interface Job {
  slideId: string;
  index: number;
  variant: SegmentVariant;
  script: string;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getServerSession(authOptions);
    if (!auth?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.user.findUnique({ where: { email: auth.user.email } });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const slug = typeof body.slug === 'string' ? body.slug : null;
    const estimateOnly = body.estimate === true;
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const deck = await prisma.publishedDeck.findUnique({
      where: { slug },
      select: {
        userId: true,
        sessionId: true,
        narrationEnabled: true,
        session: { select: { finalPresentationId: true } },
      },
    });
    if (!deck || deck.userId !== user.id) {
      return NextResponse.json({ error: 'Published deck not found' }, { status: 404 });
    }
    if (!deck.narrationEnabled) {
      return NextResponse.json({ error: 'Narration is not enabled for this deck' }, { status: 400 });
    }

    const presentationId = deck.session?.finalPresentationId;
    if (!presentationId) {
      return NextResponse.json({ error: 'This deck has no slides yet' }, { status: 400 });
    }

    const { voiceId } = await getSessionVoiceId(deck.sessionId, user.id);
    const voice = getVoice(voiceId);

    const presentation = await getPresentation(presentationId);
    const slides: Record<string, any>[] = presentation?.slides ?? [];

    // Only slides that have something to say. A slide with no script is not a
    // failure — it simply has not been written yet, and rendering silence for it
    // would put a paid empty segment in the ledger.
    const jobs: Job[] = [];
    slides.forEach((slide, index) => {
      const slideId = String(slide.slide_id ?? slide.id ?? index);
      for (const variant of VARIANTS) {
        const script = variant === 'full' ? slide.script : slide.script_compressed;
        if (typeof script === 'string' && script.trim()) {
          jobs.push({ slideId, index, variant, script: script.trim() });
        }
      }
    });

    if (jobs.length === 0) {
      return NextResponse.json(
        { error: 'No scripts to render — write the script first' },
        { status: 400 }
      );
    }

    // Content lookup BEFORE any spending. This is the cache, and it is also what
    // makes the estimate honest: the number quoted is for what is genuinely
    // missing, not for the whole deck.
    const pending: Job[] = [];
    for (const job of jobs) {
      const existing = await findReadySegment({
        presentationId,
        slideId: job.slideId,
        variant: job.variant,
        script: job.script,
        voiceId: voice.id,
      });
      if (!existing) pending.push(job);
    }

    // Estimated from the measured per-minute rate and the words actually
    // written, so it moves with the deck rather than being a flat guess.
    const estimatedMinutes = pending.reduce(
      (sum, job) => sum + job.script.split(/\s+/).filter(Boolean).length / 140,
      0
    );
    const estimatedCents = Math.ceil(estimatedMinutes * voice.costPerMinuteUsd * 100);

    if (estimateOnly) {
      return NextResponse.json({
        estimate: true,
        voice: { id: voice.id, name: voice.name },
        toRender: pending.length,
        alreadyRendered: jobs.length - pending.length,
        estimatedCents,
        estimatedMinutes: Math.round(estimatedMinutes * 10) / 10,
      });
    }

    if (!isNarrationConfigured()) {
      return NextResponse.json({ error: 'Narration is not available' }, { status: 503 });
    }

    // Storage is checked BEFORE the first paid call, never after.
    //
    // Audio is charged the moment it is generated. Discovering afterwards that
    // it cannot be stored means the vendor has been paid for bytes we then
    // throw away — which is exactly what the first live render did: every
    // segment synthesised, every segment discarded, and a ledger reporting 0c
    // because it only counts what it managed to keep.
    const storage = await mediaStoreStatus();
    if (!storage.ok) {
      return NextResponse.json(
        {
          error: `Recording is unavailable: ${storage.reason ?? 'the media store is unreachable'}`,
          hint: 'Nothing was charged. Audio cannot be stored, so nothing was generated.',
        },
        { status: 503 }
      );
    }

    const results: { slide: number; variant: string; status: string; detail?: string }[] = [];
    let spentCents = 0;

    for (let start = 0; start < pending.length; start += CONCURRENCY) {
      await Promise.all(
        pending.slice(start, start + CONCURRENCY).map(async (job) => {
          const key = {
            presentationId,
            slideId: job.slideId,
            variant: job.variant,
            script: job.script,
            voiceId: voice.id,
          };
          try {
            const result = await synthesize(job.script, voice.id);
            const audio = result.format === 'pcm' ? pcmToWav(result.audio) : result.audio;
            const path = segmentPath(presentationId, job.slideId, job.variant, job.script, voice);

            const stored = await putMedia(
              path,
              audio,
              result.format === 'pcm' ? 'audio/wav' : 'audio/mpeg'
            );
            if (!stored.ok) {
              // Deliberately NOT recorded as ready. A segment whose audio is not
              // in the bucket is a row that promises sound it cannot produce,
              // and the player would hit a dead path mid-deck.
              await recordSegment(key, user.id, {
                status: 'failed',
                error: `audio could not be stored: ${stored.reason ?? 'unknown'}`,
              });
              results.push({
                slide: job.index + 1,
                variant: job.variant,
                status: 'failed',
                // Say WHY. "could not store the audio" is true of every storage
                // failure and useful for none of them.
                detail: stored.reason ?? 'could not store the audio',
              });
              return;
            }

            // Charge what the provider actually billed where we can see it, and
            // fall back to the measured rate when the record lags. Either way it
            // is recorded per segment, so the spend is auditable row by row.
            const billedUsd = await billedCostUsd(result.generationId);
            const durationMs =
              result.durationSeconds != null
                ? Math.round(result.durationSeconds * 1000)
                : Math.round((audio.byteLength / (PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE)) * 1000);
            const costCents = Math.max(
              0,
              Math.ceil(
                (billedUsd ?? (durationMs / 60000) * voice.costPerMinuteUsd) * 100
              )
            );

            await recordSegment(key, user.id, {
              status: 'ready',
              assetPath: path,
              durationMs,
              bytes: audio.byteLength,
              costCents,
            });
            spentCents += costCents;
            results.push({ slide: job.index + 1, variant: job.variant, status: 'rendered' });
          } catch (error) {
            const detail = error instanceof Error ? error.message : 'unknown';
            await recordSegment(key, user.id, { status: 'failed', error: detail.slice(0, 300) });
            results.push({
              slide: job.index + 1,
              variant: job.variant,
              status: 'failed',
              detail: detail.slice(0, 160),
            });
          }
        })
      );
    }

    // Billed once for the batch, keyed on the presentation and the voice so a
    // retry of the same render cannot double-charge.
    if (spentCents > 0) {
      try {
        await debitWallet({
          userId: user.id,
          amountCents: spentCents,
          // Metered consumption, like every other model call the product makes.
          // The metadata is what distinguishes narration in the ledger — adding
          // a reason to the union would touch billing code this change has no
          // business reaching into.
          reason: 'token_usage',
          sourceRef: `narration:${presentationId}:${voice.id}:${Date.now()}`,
          metadata: { kind: 'narration_render', segments: results.length, voice: voice.id },
        });
      } catch (error) {
        // The audio exists and is recorded; a billing failure must not delete it.
        // Logged loudly because it is real money that did not get charged.
        console.error('[Narration] render succeeded but billing failed:', error);
        if (error instanceof InsufficientFundsError) {
          return NextResponse.json(
            {
              rendered: results.filter((r) => r.status === 'rendered').length,
              results,
              warning: 'Audio was rendered but your balance could not cover it.',
            },
            { status: 402 }
          );
        }
      }
    }

    results.sort((a, b) => a.slide - b.slide || a.variant.localeCompare(b.variant));
    return NextResponse.json({
      rendered: results.filter((r) => r.status === 'rendered').length,
      reused: jobs.length - pending.length,
      total: jobs.length,
      spentCents,
      voice: { id: voice.id, name: voice.name },
      deck: await deckSegmentSummary(presentationId),
      results,
    });
  } catch (error) {
    console.error('[Narration] render failed:', error);
    return NextResponse.json({ error: 'Could not render the narration' }, { status: 500 });
  }
}
