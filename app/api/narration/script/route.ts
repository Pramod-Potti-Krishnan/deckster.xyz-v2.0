/**
 * POST /api/narration/script — draft the spoken script for a whole deck.
 *
 * The piece that makes the time budget do something rather than merely describe
 * itself. It reads the deck from Layout, divides the publisher's speaking time
 * across the slides in proportion to what each has to say, drafts two variants
 * per slide inside those budgets, and writes them back.
 *
 * Three properties this route is built around:
 *
 *   1. **It never invents figures.** A number spoken over a slide that nobody
 *      wrote is the one failure that would genuinely embarrass a publisher, so
 *      a slide whose draft fails that check is SKIPPED, not written.
 *   2. **It never silently overwrites a human.** A slide whose script the owner
 *      has already written is left alone unless `overwrite` is explicitly set.
 *   3. **A slide that fails does not fail the deck.** Each slide is written
 *      independently and reported on; the response says exactly what happened
 *      to each one.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getPresentation, updateSlideNarration } from '@/lib/layout-service-client';
import { resolveBudget, COMPRESSED_RATIO } from '@/lib/narration/budget';
import { allocate, allocatedSeconds } from '@/lib/narration/allocate';
import { draftSlideScript, DraftError } from '@/lib/narration/draft';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/** Slides drafted at once. Bounded because each is a model call and a whole
 *  deck at once would burst the provider's concurrency long before ours. */
const CONCURRENCY = 4;

/** Plain text out of whatever shape a slide's content happens to be. Layout
 *  stores producer-owned HTML verbatim, so this strips tags rather than trying
 *  to understand them. */
function slideText(slide: Record<string, any>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  const walk = (value: unknown, depth = 0) => {
    if (depth > 6 || value == null) return;
    if (typeof value === 'string') {
      const text = value.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      // Skip URLs, data URIs and CSS-ish blobs — none of it is spoken content.
      if (text.length < 2 || /^(https?:|data:|#[0-9a-f]{3,8}$)/i.test(text)) return;
      if (seen.has(text)) return;
      seen.add(text);
      out.push(text);
      return;
    }
    if (Array.isArray(value)) return value.forEach((v) => walk(v, depth + 1));
    if (typeof value === 'object') {
      for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
        // Never feed the model the previous script — it would rewrite its own
        // output instead of the slide, and drift a little further each run.
        if (['script', 'script_compressed', 'image', 'background_image'].includes(key)) continue;
        walk(v, depth + 1);
      }
    }
  };
  walk(slide.content);
  for (const key of ['title', 'subtitle']) if (typeof slide[key] === 'string') out.unshift(slide[key]);
  return out.join('\n').slice(0, 6000);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getServerSession(authOptions);
    if (!auth?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const user = await prisma.user.findUnique({ where: { email: auth.user.email } });
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const slug = typeof body.slug === 'string' ? body.slug : null;
    const overwrite = body.overwrite === true;
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    // Ownership is checked against the published deck, which is also where the
    // budget lives — one read, one authorisation.
    const deck = await prisma.publishedDeck.findUnique({
      where: { slug },
      select: {
        userId: true,
        sessionId: true,
        narrationBudgetMinutes: true,
        qaReserveMinutes: true,
        narrationClosingScript: true,
        session: { select: { finalPresentationId: true } },
      },
    });
    if (!deck || deck.userId !== user.id) {
      return NextResponse.json({ error: 'Published deck not found' }, { status: 404 });
    }

    const budget = resolveBudget(deck.narrationBudgetMinutes, deck.qaReserveMinutes);
    if (!budget) {
      return NextResponse.json(
        { error: 'Set how long the session is before generating a script' },
        { status: 400 }
      );
    }

    const presentationId = deck.session?.finalPresentationId;
    if (!presentationId) {
      return NextResponse.json({ error: 'This deck has no slides yet' }, { status: 400 });
    }
    const presentation = await getPresentation(presentationId);
    const slides: Record<string, any>[] = presentation?.slides ?? [];
    if (slides.length === 0) {
      return NextResponse.json({ error: 'This deck has no slides yet' }, { status: 400 });
    }

    const allocations = allocate(
      slides.map((slide, index) => ({
        slideId: String(slide.slide_id ?? slide.id ?? index),
        durationSeconds: slide.narration_duration_seconds ?? null,
      })),
      budget.narrationMinutes,
      COMPRESSED_RATIO
    );

    const results: { slide: number; status: string; detail?: string }[] = [];

    // PHASE 1 — draft concurrently. Model calls are the slow part and they touch
    // nothing shared, so this is where the parallelism belongs.
    interface Drafted { index: number; slideId: string; full: string; compressed: string }
    const drafted: Drafted[] = [];

    for (let start = 0; start < slides.length; start += CONCURRENCY) {
      const batch = slides.slice(start, start + CONCURRENCY);
      await Promise.all(
        batch.map(async (slide, offset) => {
          const index = start + offset;
          const allocation = allocations[index];
          const slideId = allocation?.slideId;
          if (!slideId) {
            results.push({ slide: index + 1, status: 'skipped', detail: 'no stable slide id' });
            return;
          }
          if (!overwrite && typeof slide.script === 'string' && slide.script.trim()) {
            results.push({ slide: index + 1, status: 'kept', detail: 'already written' });
            return;
          }
          try {
            const script = await draftSlideScript(
              {
                index,
                title: slide.title ?? null,
                bodyText: slideText(slide),
                speakerNotes: slide.speaker_notes ?? null,
                pacingHints: slide.narration_pacing_hints ?? null,
              },
              allocation.words,
              allocation.compressedWords
            );
            drafted.push({ index, slideId, full: script.full, compressed: script.compressed });
          } catch (error) {
            results.push({
              slide: index + 1,
              status: 'failed',
              detail:
                error instanceof DraftError
                  ? error.message
                  : error instanceof Error
                    ? error.message
                    : 'unknown',
            });
          }
        })
      );
    }

    // PHASE 2 — write SEQUENTIALLY, threading updated_at forward.
    //
    // Every narration write is guarded by `expected_updated_at`, and a
    // successful write BUMPS it. Writing concurrently — or reusing the token
    // from the initial GET — means the first write wins and every one after it
    // is rejected as stale. That is exactly what happened: 1 of 6 written, the
    // other 5 refused with a 409.
    //
    // So the token moves with each save, and a 409 is retried once against the
    // value the server reports. One retry, not a loop: a second conflict means
    // somebody else is editing the deck right now, and racing them is worse
    // than saying so.
    drafted.sort((a, b) => a.index - b.index);
    let token = String(presentation?.updated_at ?? '');

    for (const item of drafted) {
      const fields = { script: item.full, script_compressed: item.compressed };
      let write = await updateSlideNarration(presentationId, item.slideId, fields, token);

      if (!write?.success && write?.status === 409 && write.currentUpdatedAt) {
        token = write.currentUpdatedAt;
        write = await updateSlideNarration(presentationId, item.slideId, fields, token);
      }

      if (write?.success) {
        if (write.updatedAt) token = write.updatedAt;
        results.push({ slide: item.index + 1, status: 'written' });
      } else {
        results.push({
          slide: item.index + 1,
          status: 'failed',
          // Say WHICH rejection. "Layout rejected the write" hid a 409 behind
          // words that could have meant anything.
          detail:
            write?.status === 409
              ? 'the deck changed while writing — try again'
              : write?.error?.message || `Layout returned ${write?.status ?? 'no response'}`,
        });
      }
    }

    // The closing. Drafted from the deck's own titles rather than from any one
    // slide, because its job is to end a session from ANY point — including one
    // cut short at slide four. "And finally..." would be a lie there.
    let closing = deck.narrationClosingScript;
    if (!closing || overwrite) {
      try {
        const titles = slides
          .map((slide, i) => `${i + 1}. ${slide.title ?? ''}`.trim())
          .filter((line) => line.length > 3)
          .join('\n');
        const drafted = await draftSlideScript(
          {
            index: 0,
            title: 'Closing',
            bodyText:
              `This deck covers:\n${titles}\n\n` +
              'Write the CLOSING line the presenter says to end the session. It must ' +
              'make sense whether the deck finished or was cut short — never refer to ' +
              '"the last slide" or "finally". Land the through-line in one or two ' +
              'sentences, then hand over to questions.',
            speakerNotes: null,
            pacingHints: null,
          },
          45,
          25
        );
        closing = drafted.full;
        await prisma.publishedDeck.update({
          where: { slug },
          data: { narrationClosingScript: closing },
        });
      } catch (error) {
        // A deck without its own closing still gets one — the default line ends
        // a session just as well, it simply says nothing specific.
        console.error('[Narration] closing draft failed, using the default:', error);
      }
    }

    results.sort((a, b) => a.slide - b.slide);
    const written = results.filter((r) => r.status === 'written').length;

    return NextResponse.json({
      written,
      total: slides.length,
      narrationMinutes: budget.narrationMinutes,
      qaReserveMinutes: budget.qaReserveMinutes,
      closing: Boolean(closing),
      // Surfaced rather than hidden: the per-slide floor can push a deck with
      // many tiny slides past its slot, and a publisher should hear that from
      // us rather than from a clock in the room.
      allocatedSeconds: allocatedSeconds(allocations),
      results,
    });
  } catch (error) {
    console.error('[Narration] script generation failed:', error);
    return NextResponse.json({ error: 'Could not generate the script' }, { status: 500 });
  }
}
