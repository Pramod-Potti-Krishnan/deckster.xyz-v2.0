import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import type { PublishedDeck } from '@prisma/client';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/publish/slug';
import { hashPasscode, MIN_PASSCODE_LENGTH } from '@/lib/publish/passcode';
import {
  deletePresentationSnapshot,
  getPresentationUpdatedAt,
  getPresentationUpdatedAtWithRetry,
  getSnapshotSlideCountWithRetry,
  resolveStalenessBaseline,
  retryDeleteStaleSnapshots,
  snapshotPresentation,
} from '@/lib/publish/layout';
import { isPublishVisibility, serializePublishedDeck } from '@/lib/publish/serialize';
import { refreshQaCorpus } from '@/lib/publish/qa-corpus';

/**
 * POST /api/publish
 * Publish (or republish) the final deck of a session.
 *
 * Body:
 * - sessionId: string (required)
 * - visibility?: 'public' | 'unlisted' | 'restricted'
 * - passcode?: string (restricted; empty string clears)
 * - allowPdf?: boolean
 * - allowPptx?: boolean
 */
export async function POST(req: NextRequest) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Parse request body — explicit field whitelist, never spread raw bodies
    const body = await req.json().catch(() => null);
    const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    if (body.visibility !== undefined && !isPublishVisibility(body.visibility)) {
      return NextResponse.json(
        { error: "visibility must be 'public', 'unlisted' or 'restricted'" },
        { status: 400 }
      );
    }
    const visibility: string | undefined = body.visibility;
    const passcode: string | undefined =
      typeof body.passcode === 'string' ? body.passcode : undefined;
    // Enforce a minimum passcode length at set time (empty string clears it)
    if (passcode !== undefined && passcode.length > 0 && passcode.length < MIN_PASSCODE_LENGTH) {
      return NextResponse.json(
        { error: `Passcode must be at least ${MIN_PASSCODE_LENGTH} characters` },
        { status: 400 }
      );
    }
    const allowPdf: boolean | undefined =
      typeof body.allowPdf === 'boolean' ? body.allowPdf : undefined;
    const allowPptx: boolean | undefined =
      typeof body.allowPptx === 'boolean' ? body.allowPptx : undefined;

    // Verify session exists and ownership
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: sessionId }
    });

    if (!chatSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (chatSession.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Only a final deck can be published
    if (!chatSession.finalPresentationId) {
      return NextResponse.json(
        { error: 'This session has no final deck yet. Finish building the presentation before publishing.' },
        { status: 409 }
      );
    }

    const existing = await prisma.publishedDeck.findUnique({
      where: { sessionId }
    });

    // Restricted decks must have a passcode (new or already on the record)
    const effectiveVisibility = visibility ?? existing?.visibility ?? 'unlisted';
    const willHavePasscode =
      passcode !== undefined ? passcode.length > 0 : Boolean(existing?.passcodeHash);
    if (effectiveVisibility === 'restricted' && !willHavePasscode) {
      return NextResponse.json(
        { error: 'A passcode is required for restricted visibility' },
        { status: 400 }
      );
    }

    // Staleness baseline, part 1: read the SOURCE deck's updated_at BEFORE the
    // snapshot is taken. Reading it only afterwards opens a false-NEGATIVE
    // window — the snapshot freezes at T0, the read lands at T1 (after the
    // slide-count retry, several hundred ms later), and any write in between is
    // captured in the stored baseline but NOT in the frozen copy, so the next
    // comparison reports "up to date" on a copy that is already behind.
    // Best-effort with one retry: never fails a publish, but a null here would
    // permanently disable staleness for this deck, so it's worth a second try.
    const sourceUpdatedAtBefore = await getPresentationUpdatedAtWithRetry(
      chatSession.finalPresentationId,
    );

    // Freeze the deck: snapshot on the Layout Service
    const snapshot = await snapshotPresentation(chatSession.finalPresentationId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'Failed to snapshot the presentation. Please try again.' },
        { status: 502 }
      );
    }

    // Slide count is authoritative-or-fail: read it ONLY from the frozen
    // SNAPSHOT deck — that's exactly what viewers (and the PPTX export) receive.
    // The session/source counts go stale after a manual in-builder slide
    // add/delete, so falling back to them could persist a count that doesn't
    // match the snapshot (the PPTX export then silently emits the wrong number
    // of slides). Bounded retry (the snapshot was just created), then fail closed.
    const slideCount = await getSnapshotSlideCountWithRetry(snapshot.snapshotId);
    if (!slideCount || slideCount <= 0) {
      // Couldn't read the authoritative count — drop the just-created snapshot so
      // it doesn't orphan, then ask to retry rather than publish a wrong count.
      await deletePresentationSnapshot(snapshot.snapshotId);
      return NextResponse.json(
        { error: 'Could not read the published slide count; please retry' },
        { status: 502 }
      );
    }

    // Staleness baseline, part 2: read it again now that the snapshot exists.
    // resolveStalenessBaseline keeps the PRE-snapshot value when the two differ
    // (conservative: the next dialog open reports "stale" rather than missing a
    // change the frozen copy may not contain) and only falls back to this one
    // when the pre-snapshot read came back unknown. Best-effort throughout —
    // neither read throws, and a null is simply stored as "unknown" (surfaced to
    // the owner as "can't verify", never as "up to date").
    const sourceUpdatedAtAfter = await getPresentationUpdatedAt(chatSession.finalPresentationId);
    const sourceUpdatedAt = resolveStalenessBaseline(
      sourceUpdatedAtBefore,
      sourceUpdatedAtAfter,
      `session ${sessionId}`,
    );

    const title = chatSession.title || 'Untitled presentation';
    const passcodeHash =
      passcode === undefined ? undefined : passcode.length > 0 ? hashPasscode(passcode) : null;

    let record: PublishedDeck | null = null;
    // true only when the previously-live snapshot is confirmed gone
    let snapshotDeleted = true;
    if (existing) {
      // Republish: swap the DB pointer FIRST, then reap the old snapshot.
      // Deleting before the update would, if the update throws, leave the live
      // slug pointing at a destroyed snapshot (iframe → 404) and orphan the new one.
      const oldSnapshotId = existing.snapshotPresentationId;
      // Self-heal: retry earlier failed deletes (safe anytime — unreferenced).
      const carriedStale = await retryDeleteStaleSnapshots(existing.staleSnapshotIds, existing.id);
      // Pre-park the old snapshot id IN THE SAME version-CAS that swaps the
      // pointer, BEFORE attempting the external Layout delete. Once the swap
      // lands, the old id is already durably recorded in staleSnapshotIds, so no
      // later failure — a failed Layout DELETE, a failed tidy-up write, or the
      // route throwing before cleanup — can lose it: the next lifecycle op's
      // retryDeleteStaleSnapshots sweep will reap it. dedup via Set so a
      // carried-over id isn't duplicated.
      const willReapOld = Boolean(oldSnapshotId && oldSnapshotId !== snapshot.snapshotId);
      const stagedStale = willReapOld
        ? Array.from(new Set([...carriedStale, oldSnapshotId]))
        : carriedStale;
      // Swap the pointer under an optimistic version-CAS: the update only lands
      // if nobody else mutated this record since we read `existing`. Without it,
      // a concurrent lifecycle op would clobber the stale-id sweep (losing a
      // failed-delete id) or leave our brand-new snapshot untracked-but-live.
      const swap = await prisma.publishedDeck.updateMany({
        where: { id: existing.id, version: existing.version },
        data: {
          sourcePresentationId: chatSession.finalPresentationId,
          snapshotPresentationId: snapshot.snapshotId,
          title,
          slideCount,
          sourceUpdatedAt,
          staleSnapshotIds: stagedStale,
          version: { increment: 1 },
          republishedAt: new Date(),
          revokedAt: null,
          ...(visibility !== undefined ? { visibility } : {}),
          ...(passcodeHash !== undefined ? { passcodeHash } : {}),
          ...(allowPdf !== undefined ? { allowPdf } : {}),
          ...(allowPptx !== undefined ? { allowPptx } : {}),
        },
      });
      if (swap.count === 0) {
        // Lost the race — someone else mutated the record first. Our just-created
        // snapshot is referenced by nobody, so delete it (orphan cleanup) and ask
        // the client to retry against the fresh state. If that cleanup delete
        // fails, the new snapshot is live-but-untracked — park it ATOMICALLY on
        // the winner's record (same source-deck lineage) so a future sweep
        // retries it. A failed park here is a compound double-failure: acceptable
        // residual, so it stays non-fatal and we still return the 409.
        const { ok } = await deletePresentationSnapshot(snapshot.snapshotId);
        if (!ok) {
          await prisma.publishedDeck.update({
            where: { id: existing.id },
            data: { staleSnapshotIds: { push: snapshot.snapshotId }, version: { increment: 1 } },
          }).catch(() => {});
        }
        return NextResponse.json(
          { error: 'Publish state changed, please retry' },
          { status: 409 }
        );
      }
      // The old snapshot id is already durably parked by the CAS above. Reap it
      // AFTER the pointer swap (never fail the request). On success, best-effort
      // REMOVE it from staleSnapshotIds (tidy-up) under a version-CAS so a
      // concurrent op isn't clobbered; if that removal loses or throws it's
      // non-fatal — the next op's sweep deletes the already-gone id (404 → ok)
      // and drops it. On failure, leave it parked (already recorded).
      if (willReapOld) {
        const { ok } = await deletePresentationSnapshot(oldSnapshotId);
        snapshotDeleted = ok;
        if (ok) {
          const fresh = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
          if (fresh && fresh.staleSnapshotIds.includes(oldSnapshotId)) {
            await prisma.publishedDeck.updateMany({
              where: { id: existing.id, version: fresh.version },
              data: {
                staleSnapshotIds: fresh.staleSnapshotIds.filter((sid) => sid !== oldSnapshotId),
                version: { increment: 1 },
              },
            }).catch(() => {});
          }
        }
      }
      // Re-read for the response (updateMany returns only a count).
      record = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
    } else {
      // First publish for this session. Two concurrent first-publishes both read
      // existing=null and both create a snapshot; the unique sessionId constraint
      // lets only one create() win. The loser must NOT fall through to the generic
      // 500 — its just-created snapshot would then be referenced by nobody
      // (orphan). On P2002 (sessionId unique violation) the loser best-effort
      // deletes its own now-unreferenced snapshot and returns a clean 409.
      try {
        record = await prisma.publishedDeck.create({
          data: {
            slug: generateSlug(),
            userId: user.id,
            sessionId,
            sourcePresentationId: chatSession.finalPresentationId,
            snapshotPresentationId: snapshot.snapshotId,
            title,
            slideCount,
            sourceUpdatedAt,
            visibility: visibility ?? 'unlisted',
            passcodeHash: passcodeHash ?? null,
            ...(allowPdf !== undefined ? { allowPdf } : {}),
            ...(allowPptx !== undefined ? { allowPptx } : {}),
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          await deletePresentationSnapshot(snapshot.snapshotId);
          return NextResponse.json(
            { error: 'This deck was just published in another request; please refresh.' },
            { status: 409 }
          );
        }
        throw error;
      }
    }

    if (!record) {
      // The record vanished between the CAS update and the re-read (e.g. the
      // session was deleted concurrently) — nothing coherent to serialize.
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Rebuild the Q&A corpus AFTER the response. Embedding a deck takes tens of
    // seconds; awaiting it would make every publish that slow, and a corpus
    // failure would surface as a failed publish for something the owner may not
    // even have enabled. `after()` runs it once the response is sent, which also
    // means it survives on Vercel — a bare floating promise would not.
    //
    // A republish invalidates the old corpus: it was frozen from the previous
    // snapshot, so leaving it would answer questions about slides that are no
    // longer published.
    if (record.qaEnabled) {
      after(() => refreshQaCorpus(record.id));
    }

    return NextResponse.json({ deck: serializePublishedDeck(record), snapshotDeleted });

  } catch (error) {
    console.error('Error publishing deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
