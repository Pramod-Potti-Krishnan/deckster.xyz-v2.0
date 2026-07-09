import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/publish/slug';
import { hashPasscode, MIN_PASSCODE_LENGTH } from '@/lib/publish/passcode';
import {
  deletePresentationSnapshot,
  getPresentationSlideCount,
  retryDeleteStaleSnapshots,
  snapshotPresentation,
} from '@/lib/publish/layout';
import { isPublishVisibility, serializePublishedDeck } from '@/lib/publish/serialize';

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

    // Freeze the deck: snapshot on the Layout Service
    const snapshot = await snapshotPresentation(chatSession.finalPresentationId);
    if (!snapshot) {
      return NextResponse.json(
        { error: 'Failed to snapshot the presentation. Please try again.' },
        { status: 502 }
      );
    }

    // Slide count: read it from the frozen SNAPSHOT deck — that's exactly what
    // viewers (and the PPTX export) see. Manual in-builder slide add/delete only
    // mutates viewer-local state, never ChatSession.slideCount, so trusting the
    // session first would publish a stale count. Session metadata is a fallback,
    // then one last authoritative attempt off the source deck.
    let slideCount = await getPresentationSlideCount(snapshot.snapshotId);
    if (!slideCount || slideCount <= 0) {
      slideCount = chatSession.slideCount ?? null;
    }
    if (!slideCount || slideCount <= 0) {
      slideCount = await getPresentationSlideCount(chatSession.finalPresentationId);
    }
    // Never publish with an unknown slide count — the viewer's PPTX export
    // falls back to 1 slide, silently producing a 1-slide deck of an N-slide deck.
    if (!slideCount || slideCount <= 0) {
      // Drop the just-created snapshot so it doesn't orphan, then ask to retry
      await deletePresentationSnapshot(snapshot.snapshotId);
      return NextResponse.json(
        { error: 'Could not determine slide count; please retry' },
        { status: 502 }
      );
    }

    const title = chatSession.title || 'Untitled presentation';
    const passcodeHash =
      passcode === undefined ? undefined : passcode.length > 0 ? hashPasscode(passcode) : null;

    let record;
    // true only when the previously-live snapshot is confirmed gone
    let snapshotDeleted = true;
    if (existing) {
      // Republish: swap the DB pointer FIRST, then reap the old snapshot.
      // Deleting before the update would, if the update throws, leave the live
      // slug pointing at a destroyed snapshot (iframe → 404) and orphan the new one.
      const oldSnapshotId = existing.snapshotPresentationId;
      // Self-heal: retry earlier failed deletes (safe anytime — unreferenced).
      const carriedStale = await retryDeleteStaleSnapshots(existing.staleSnapshotIds);
      record = await prisma.publishedDeck.update({
        where: { id: existing.id },
        data: {
          sourcePresentationId: chatSession.finalPresentationId,
          snapshotPresentationId: snapshot.snapshotId,
          title,
          slideCount,
          staleSnapshotIds: carriedStale,
          republishedAt: new Date(),
          revokedAt: null,
          ...(visibility !== undefined ? { visibility } : {}),
          ...(passcodeHash !== undefined ? { passcodeHash } : {}),
          ...(allowPdf !== undefined ? { allowPdf } : {}),
          ...(allowPptx !== undefined ? { allowPptx } : {}),
        },
      });
      // Reap the now-replaced snapshot AFTER the pointer swap (never fail the
      // request). If the delete didn't stick, carry the id forward so a later
      // publish op retries it, and don't claim the old copy is gone.
      if (oldSnapshotId && oldSnapshotId !== snapshot.snapshotId) {
        const { ok } = await deletePresentationSnapshot(oldSnapshotId);
        snapshotDeleted = ok;
        if (!ok) {
          record = await prisma.publishedDeck.update({
            where: { id: existing.id },
            // De-dup against the carried backlog: oldSnapshotId may already be
            // in carriedStale (e.g. a prior unpublish left it unreaped).
            data: {
              staleSnapshotIds: Array.from(new Set([...carriedStale, oldSnapshotId])),
            },
          });
        }
      }
    } else {
      record = await prisma.publishedDeck.create({
        data: {
          slug: generateSlug(),
          userId: user.id,
          sessionId,
          sourcePresentationId: chatSession.finalPresentationId,
          snapshotPresentationId: snapshot.snapshotId,
          title,
          slideCount,
          visibility: visibility ?? 'unlisted',
          passcodeHash: passcodeHash ?? null,
          ...(allowPdf !== undefined ? { allowPdf } : {}),
          ...(allowPptx !== undefined ? { allowPptx } : {}),
        },
      });
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
