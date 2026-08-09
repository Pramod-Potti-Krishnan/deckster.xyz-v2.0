import { NextRequest, NextResponse } from 'next/server';
import { after } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { hashPasscode, MIN_PASSCODE_LENGTH } from '@/lib/publish/passcode';
import { deletePresentationSnapshot, retryDeleteStaleSnapshots } from '@/lib/publish/layout';
import { isPublishVisibility, serializePublishedDeck } from '@/lib/publish/serialize';
import { refreshQaCorpus, teardownQaCorpus } from '@/lib/publish/qa-corpus';

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
      qaEnabled?: boolean;
      qaDailyCap?: number;
      qaMonthlyCap?: number;
      qaTonePreset?: string;
      qaToneInstruction?: string | null;
      qaCiteWebSources?: boolean;
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

    // --- Q&A settings (rung 1) -------------------------------------------
    // Enabling attaches a public LLM endpoint to this deck that spends the
    // owner's wallet, so it rides the same version-CAS as visibility below:
    // a concurrent republish must not be able to silently revert it on.
    if (typeof body.qaEnabled === 'boolean') data.qaEnabled = body.qaEnabled;
    // Caps are the owner's spend ceiling. Clamped rather than rejected — a
    // nonsense value should land on a safe number, not leave the deck on the
    // previous (possibly higher) one.
    if (typeof body.qaDailyCap === 'number' && Number.isFinite(body.qaDailyCap)) {
      data.qaDailyCap = Math.min(1000, Math.max(0, Math.trunc(body.qaDailyCap)));
    }
    if (typeof body.qaMonthlyCap === 'number' && Number.isFinite(body.qaMonthlyCap)) {
      data.qaMonthlyCap = Math.min(20000, Math.max(0, Math.trunc(body.qaMonthlyCap)));
    }
    // Tone is STYLE ONLY. Researcher grounds with the tone absent from stage 1,
    // so no value here can move a refusal threshold — an unknown preset is a
    // cosmetic no-op, not a safety hole.
    if (typeof body.qaTonePreset === 'string') {
      const preset = body.qaTonePreset.trim().slice(0, 40);
      if (preset) data.qaTonePreset = preset;
    }
    if (typeof body.qaToneInstruction === 'string') {
      const instruction = body.qaToneInstruction.trim().slice(0, 200);
      data.qaToneInstruction = instruction || null;
    }
    if (typeof body.qaCiteWebSources === 'boolean') {
      data.qaCiteWebSources = body.qaCiteWebSources;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Apply the settings change under an optimistic version-CAS so a concurrent
    // republish/rotate can't silently revert it (a lost passcode/visibility change
    // would leave the deck more exposed than the owner believes). The
    // restricted-must-have-a-passcode invariant is re-validated against the fresh
    // record on each attempt. On a lost CAS, re-read and retry ONCE, then 409.
    let current = existing;
    let updated = null;
    for (let attempt = 0; attempt < 2 && !updated; attempt++) {
      const nextVisibility = data.visibility ?? current.visibility;
      const nextPasscodeHash =
        data.passcodeHash !== undefined ? data.passcodeHash : current.passcodeHash;
      if (nextVisibility === 'restricted' && !nextPasscodeHash) {
        return NextResponse.json(
          { error: 'A passcode is required for restricted visibility' },
          { status: 400 }
        );
      }

      const res = await prisma.publishedDeck.updateMany({
        where: { id: current.id, version: current.version },
        data: { ...data, version: { increment: 1 } },
      });
      if (res.count > 0) {
        updated = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
        break;
      }
      const fresh = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
      if (!fresh) {
        return NextResponse.json({ error: 'Published deck not found' }, { status: 404 });
      }
      current = fresh;
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Publish state changed, please retry' },
        { status: 409 }
      );
    }

    // Q&A is off by default, so a deck's first publish never built a corpus.
    // Switching it ON is therefore the moment to build one — otherwise the
    // owner enables the feature and every question defers with 'not_ready'
    // until they happen to republish.
    if (data.qaEnabled === true && !existing.qaEnabled) {
      after(() => refreshQaCorpus(updated.id));
    }

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
      const carriedStale = await retryDeleteStaleSnapshots(current.staleSnapshotIds, existing.id);
      // Pre-park the snapshot being revoked IN THE SAME version-CAS that flips
      // revokedAt, BEFORE the external Layout delete. Once the revoke lands, the
      // id is already durably recorded in staleSnapshotIds, so no later failure —
      // a failed Layout DELETE, a failed tidy-up write, or the route throwing —
      // can lose it: the next lifecycle op's sweep reaps it. dedup via Set. Uses
      // current.snapshotPresentationId, which a concurrent republish may have
      // swapped, so it's re-read on each CAS attempt.
      const toReap = current.snapshotPresentationId;
      const stagedStale = toReap
        ? Array.from(new Set([...carriedStale, toReap]))
        : carriedStale;
      const res = await prisma.publishedDeck.updateMany({
        where: { id: current.id, version: current.version },
        data: {
          revokedAt: new Date(),
          staleSnapshotIds: stagedStale,
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

    // Snapshot cleanup on the Layout Service — never fail the request. The
    // snapshot that was live when we revoked (current.snapshotPresentationId — a
    // concurrent republish may have swapped the pointer) is already durably parked
    // by the revoke CAS above. On success, best-effort REMOVE it from
    // staleSnapshotIds (tidy-up) under a version-CAS so a concurrent op isn't
    // clobbered; if that removal loses or throws it's non-fatal — the next op's
    // sweep deletes the already-gone id (404 → ok) and drops it. On failure, the
    // {layout}/p/{snapshotId} URL is still live, so leave it parked (already
    // recorded) and don't claim the copy is gone.
    const revokedSnapshotId = current.snapshotPresentationId;
    let snapshotDeleted = true;
    if (revokedSnapshotId) {
      const { ok } = await deletePresentationSnapshot(revokedSnapshotId);
      snapshotDeleted = ok;
      if (ok) {
        const fresh = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
        if (fresh && fresh.staleSnapshotIds.includes(revokedSnapshotId)) {
          await prisma.publishedDeck.updateMany({
            where: { id: existing.id, version: fresh.version },
            data: {
              staleSnapshotIds: fresh.staleSnapshotIds.filter((sid) => sid !== revokedSnapshotId),
              version: { increment: 1 },
            },
          }).catch(() => {});
        }
      }
    }

    // Re-read for the response (updateMany returns only a count).
    const revoked = await prisma.publishedDeck.findUnique({ where: { id: existing.id } });
    if (!revoked) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Drop the frozen corpus with the deck. /ask already refuses a revoked
    // deck before it reads anything, so this is hygiene rather than the
    // security boundary — but leaving a corpus behind for a deck the owner
    // deliberately revoked is not a defensible default.
    after(() => teardownQaCorpus(revoked.id));

    return NextResponse.json({ deck: serializePublishedDeck(revoked), snapshotDeleted });

  } catch (error) {
    console.error('Error unpublishing deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
