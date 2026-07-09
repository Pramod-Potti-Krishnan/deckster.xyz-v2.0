import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/publish/slug';
import {
  deletePresentationSnapshot,
  getPresentationSlideCount,
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

    // Recompute the slide count off the freshly-created snapshot — a re-snapshot
    // can pick up in-builder slide add/delete since the last publish, and rotate
    // must persist that authoritative count (the previous rotate left it stale).
    let slideCount = await getPresentationSlideCount(snapshot.snapshotId);
    if (!slideCount || slideCount <= 0) {
      slideCount = existing.slideCount ?? null;
    }
    if (!slideCount || slideCount <= 0) {
      slideCount = await getPresentationSlideCount(sourcePresentationId);
    }
    if (!slideCount || slideCount <= 0) {
      // Never persist an unknown count — drop the orphan snapshot and ask to retry
      await deletePresentationSnapshot(snapshot.snapshotId);
      return NextResponse.json(
        { error: 'Could not determine slide count; please retry' },
        { status: 502 }
      );
    }

    // Self-heal: retry earlier failed deletes (safe anytime — unreferenced).
    const carriedStale = await retryDeleteStaleSnapshots(existing.staleSnapshotIds);

    // Mint a fresh slug + point at the new snapshot; retry on the
    // (astronomically unlikely) slug collision.
    let updated = null;
    for (let attempt = 0; attempt < 5 && !updated; attempt++) {
      try {
        updated = await prisma.publishedDeck.update({
          where: { id: existing.id },
          data: {
            slug: generateSlug(),
            snapshotPresentationId: snapshot.snapshotId,
            sourcePresentationId,
            slideCount,
            staleSnapshotIds: carriedStale,
          },
        });
      } catch (error: any) {
        // P2002 = unique constraint violation — roll again
        if (error?.code !== 'P2002') throw error;
      }
    }

    if (!updated) {
      // Couldn't persist — drop the just-created snapshot so it doesn't orphan
      await deletePresentationSnapshot(snapshot.snapshotId);
      return NextResponse.json(
        { error: 'Failed to rotate link. Please try again.' },
        { status: 500 }
      );
    }

    // Reap the old snapshot AFTER the pointer swap (Fix A ordering). Rotating the
    // slug alone doesn't revoke the {layout}/p/{snapshotId} URL — only deleting
    // the snapshot does. If the delete didn't stick, carry the id forward and
    // tell the owner the truth (the old copy is still being cleaned up).
    let snapshotDeleted = true;
    if (oldSnapshotId && oldSnapshotId !== snapshot.snapshotId) {
      const { ok } = await deletePresentationSnapshot(oldSnapshotId);
      snapshotDeleted = ok;
      if (!ok) {
        updated = await prisma.publishedDeck.update({
          where: { id: existing.id },
          data: { staleSnapshotIds: { push: oldSnapshotId } },
        });
      }
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
