import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hashPasscode, MIN_PASSCODE_LENGTH } from '@/lib/publish/passcode';
import { deletePresentationSnapshot, retryDeleteStaleSnapshots } from '@/lib/publish/layout';
import { isPublishVisibility, serializePublishedDeck } from '@/lib/publish/serialize';

/**
 * PATCH /api/publish/[slug]
 * Update sharing settings on a published deck.
 *
 * Body (all fields optional, whitelisted):
 * - visibility: 'public' | 'unlisted' | 'restricted'
 * - passcode: string (new passcode; empty string clears it)
 * - allowPdf: boolean
 * - allowPptx: boolean
 */
export async function PATCH(
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

    // Parse request body — explicit field whitelist, never spread raw bodies
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (body.visibility !== undefined && !isPublishVisibility(body.visibility)) {
      return NextResponse.json(
        { error: "visibility must be 'public', 'unlisted' or 'restricted'" },
        { status: 400 }
      );
    }

    const data: {
      visibility?: string;
      passcodeHash?: string | null;
      allowPdf?: boolean;
      allowPptx?: boolean;
    } = {};

    if (body.visibility !== undefined) data.visibility = body.visibility;
    if (typeof body.passcode === 'string') {
      // Enforce a minimum passcode length at set time (empty string clears it)
      if (body.passcode.length > 0 && body.passcode.length < MIN_PASSCODE_LENGTH) {
        return NextResponse.json(
          { error: `Passcode must be at least ${MIN_PASSCODE_LENGTH} characters` },
          { status: 400 }
        );
      }
      data.passcodeHash = body.passcode.length > 0 ? hashPasscode(body.passcode) : null;
    }
    if (typeof body.allowPdf === 'boolean') data.allowPdf = body.allowPdf;
    if (typeof body.allowPptx === 'boolean') data.allowPptx = body.allowPptx;

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Restricted decks must keep a passcode
    const nextVisibility = data.visibility ?? existing.visibility;
    const nextPasscodeHash =
      data.passcodeHash !== undefined ? data.passcodeHash : existing.passcodeHash;
    if (nextVisibility === 'restricted' && !nextPasscodeHash) {
      return NextResponse.json(
        { error: 'A passcode is required for restricted visibility' },
        { status: 400 }
      );
    }

    const updated = await prisma.publishedDeck.update({
      where: { id: existing.id },
      data,
    });

    return NextResponse.json({ deck: serializePublishedDeck(updated) });

  } catch (error) {
    console.error('Error updating published deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/publish/[slug]
 * Unpublish a deck: set revokedAt and delete the snapshot (best effort).
 * The row is kept so the record (and slug) survives for republish.
 */
export async function DELETE(
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

    // Revoke under an optimistic version-CAS so a concurrent lifecycle op can't
    // clobber the stale-id sweep. Set revokedAt FIRST, then reap the snapshot
    // (best effort) — deleting before the update would, on a lost CAS, leave the
    // deck "published" while its snapshot is already destroyed (iframe → 404).
    // On a lost CAS, re-read and retry the revoke ONCE against the fresh version
    // (re-sweeping the fresh backlog); if it still loses, 409.
    let current = existing;
    let revokedCount = 0;
    for (let attempt = 0; attempt < 2 && revokedCount === 0; attempt++) {
      // Self-heal: retry earlier failed deletes (safe anytime — unreferenced).
      const carriedStale = await retryDeleteStaleSnapshots(current.staleSnapshotIds);
      const res = await prisma.publishedDeck.updateMany({
        where: { id: current.id, version: current.version },
        data: {
          revokedAt: new Date(),
          staleSnapshotIds: carriedStale,
          version: { increment: 1 },
        },
      });
      revokedCount = res.count;
      if (revokedCount === 0) {
        const fresh = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
        if (!fresh) {
          return NextResponse.json(
            { error: 'Published deck not found' },
            { status: 404 }
          );
        }
        current = fresh;
      }
    }

    if (revokedCount === 0) {
      return NextResponse.json(
        { error: 'Publish state changed, please retry' },
        { status: 409 }
      );
    }

    // Snapshot cleanup on the Layout Service — never fail the request. Reap the
    // snapshot that was live when we revoked (current.snapshotPresentationId — a
    // concurrent republish may have swapped the pointer). If the delete didn't
    // stick, the {layout}/p/{snapshotId} URL is still live, so park the id
    // ATOMICALLY (append, not read-modify-write) and don't claim the copy is gone.
    let snapshotDeleted = true;
    if (current.snapshotPresentationId) {
      const { ok } = await deletePresentationSnapshot(current.snapshotPresentationId);
      snapshotDeleted = ok;
      if (!ok) {
        await prisma.publishedDeck.update({
          where: { id: existing.id },
          data: { staleSnapshotIds: { push: current.snapshotPresentationId } },
        });
      }
    }

    // Re-read for the response (updateMany returns only a count).
    const revoked = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
    if (!revoked) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ deck: serializePublishedDeck(revoked), snapshotDeleted });

  } catch (error) {
    console.error('Error unpublishing deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
