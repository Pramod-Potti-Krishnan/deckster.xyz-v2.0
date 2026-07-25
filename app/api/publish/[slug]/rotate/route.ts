import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/publish/slug';
import {
  deletePresentationSnapshot,
  getSnapshotSlideCountWithRetry,
  retryDeleteStaleSnapshots,
  snapshotPresentation,
} from '@/lib/publish/layout';
import { serializePublishedDeck } from '@/lib/publish/serialize';

/**
 * POST /api/publish/[slug]/rotate
 * Genuinely revoke access to a leaked link without unpublishing:
 *  - mint a NEW slug (invalidates the old URL and its slug-scoped unlock cookie), and
 *  - create a NEW snapshot and point the record at it, then reap the old snapshot.
 * Rotating only the slug would leave the old, unauthenticated
 * {layout}/p/{snapshotId} URL live — anyone who saved it would keep access.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { slug } = await params;

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

    // Verify record exists and ownership
    const existing = await prisma.publishedDeck.findUnique({
      where: { slug }
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Published deck not found' },
        { status: 404 }
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Re-snapshot the SOURCE deck so the old snapshot id stops resolving.
    // Re-read finalPresentationId to snapshot the freshest source state.
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: existing.sessionId },
    });
    const sourcePresentationId =
      chatSession?.finalPresentationId || existing.sourcePresentationId;

    const snapshot = await snapshotPresentation(sourcePresentationId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'Failed to re-snapshot the presentation. Please try again.' },
        { status: 502 }
      );
    }

    const oldSnapshotId = existing.snapshotPresentationId;

    // Slide count is authoritative-or-fail: read it ONLY from the freshly-created
    // SNAPSHOT deck (a re-snapshot can pick up in-builder slide add/delete since
    // the last publish). The previous/source counts go stale, so a fallback could
    // persist a count that doesn't match what viewers receive. Bounded retry (the
    // snapshot was just created), then fail closed.
    const slideCount = await getSnapshotSlideCountWithRetry(snapshot.snapshotId);
    if (!slideCount || slideCount <= 0) {
      // Couldn't read the authoritative count — drop the just-created snapshot so
      // it doesn't orphan, then ask to retry rather than persist a wrong count.
      await deletePresentationSnapshot(snapshot.snapshotId);
      return NextResponse.json(
        { error: 'Could not read the published slide count; please retry' },
        { status: 502 }
      );
    }

    // Self-heal: retry earlier failed deletes (safe anytime — unreferenced).
    const carriedStale = await retryDeleteStaleSnapshots(existing.staleSnapshotIds, existing.id);
    // Pre-park the old snapshot id IN THE SAME version-CAS that swaps the pointer,
    // BEFORE attempting the external Layout delete. Once the swap lands, the old
    // id is already durably recorded in staleSnapshotIds, so no later failure — a
    // failed Layout DELETE, a failed tidy-up write, or the route throwing before
    // cleanup — can lose it: the next lifecycle op's sweep reaps it. dedup via Set
    // so a carried-over id isn't duplicated. (Slug-collision retries below re-CAS
    // with this SAME staged array, since the failed update wrote nothing.)
    const willReapOld = Boolean(oldSnapshotId && oldSnapshotId !== snapshot.snapshotId);
    const stagedStale = willReapOld
      ? Array.from(new Set([...carriedStale, oldSnapshotId]))
      : carriedStale;

    // Mint a fresh slug + point at the new snapshot under an optimistic
    // version-CAS: the swap only lands if nobody else mutated this record since
    // we read `existing` (otherwise the stale-id sweep would be clobbered or the
    // new snapshot orphaned). Retry ONLY the (astronomically unlikely) slug
    // collision — regenerating the slug and re-CASing on the SAME expected
    // version. A genuine version conflict is not retried (it's a real concurrent
    // mutation): clean up the orphan and 409.
    let swapCount = 0;
    for (let attempt = 0; attempt < 5 && swapCount === 0; attempt++) {
      try {
        const res = await prisma.publishedDeck.updateMany({
          where: { id: existing.id, version: existing.version },
          data: {
            slug: generateSlug(),
            snapshotPresentationId: snapshot.snapshotId,
            sourcePresentationId,
            slideCount,
            staleSnapshotIds: stagedStale,
            version: { increment: 1 },
          },
        });
        swapCount = res.count;
        if (swapCount === 0) {
          // Version mismatch — another lifecycle op won the race. Our new
          // snapshot is referenced by nobody, so delete it (orphan cleanup) and
          // ask the client to retry against fresh state. If that cleanup delete
          // fails, the new snapshot is live-but-untracked — park it ATOMICALLY on
          // the winner's record (same source-deck lineage) so a future sweep
          // retries it. A failed park here is a compound double-failure:
          // acceptable residual, so it stays non-fatal and we still return 409.
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
      } catch (error: any) {
        // P2002 = slug unique-constraint collision — roll a new slug and re-CAS
        // on the SAME expected version (the failed update wrote nothing).
        if (error?.code !== 'P2002') throw error;
      }
    }

    if (swapCount === 0) {
      // Exhausted slug-collision retries — drop the just-created snapshot so it
      // doesn't orphan.
      await deletePresentationSnapshot(snapshot.snapshotId);
      return NextResponse.json(
        { error: 'Failed to rotate link. Please try again.' },
        { status: 500 }
      );
    }

    // The old snapshot id is already durably parked by the swap CAS above. Reap
    // it AFTER the pointer swap (Fix A ordering) — rotating the slug alone doesn't
    // revoke the {layout}/p/{snapshotId} URL, only deleting the snapshot does. On
    // success, best-effort REMOVE it from staleSnapshotIds (tidy-up) under a
    // version-CAS so a concurrent op isn't clobbered; if that removal loses or
    // throws it's non-fatal — the next op's sweep deletes the already-gone id
    // (404 → ok) and drops it. On failure, leave it parked (already recorded) and
    // tell the owner the truth (the old copy is still being cleaned up).
    let snapshotDeleted = true;
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
    const updated = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
    if (!updated) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ deck: serializePublishedDeck(updated), snapshotDeleted });

  } catch (error) {
    console.error('Error rotating published deck slug:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
