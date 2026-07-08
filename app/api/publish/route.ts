import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/publish/slug';
import { hashPasscode } from '@/lib/publish/passcode';
import {
  deletePresentationSnapshot,
  getPresentationSlideCount,
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

    // Slide count: session metadata, fallback to the deck JSON
    let slideCount = chatSession.slideCount ?? null;
    if (!slideCount || slideCount <= 0) {
      slideCount = await getPresentationSlideCount(snapshot.snapshotId);
    }

    const title = chatSession.title || 'Untitled presentation';
    const passcodeHash =
      passcode === undefined ? undefined : passcode.length > 0 ? hashPasscode(passcode) : null;

    let record;
    if (existing) {
      // Republish: swap the snapshot pointer, reap the old snapshot (best effort)
      if (existing.snapshotPresentationId && existing.snapshotPresentationId !== snapshot.snapshotId) {
        await deletePresentationSnapshot(existing.snapshotPresentationId);
      }
      record = await prisma.publishedDeck.update({
        where: { id: existing.id },
        data: {
          sourcePresentationId: chatSession.finalPresentationId,
          snapshotPresentationId: snapshot.snapshotId,
          title,
          slideCount: slideCount ?? existing.slideCount,
          republishedAt: new Date(),
          revokedAt: null,
          ...(visibility !== undefined ? { visibility } : {}),
          ...(passcodeHash !== undefined ? { passcodeHash } : {}),
          ...(allowPdf !== undefined ? { allowPdf } : {}),
          ...(allowPptx !== undefined ? { allowPptx } : {}),
        },
      });
    } else {
      record = await prisma.publishedDeck.create({
        data: {
          slug: generateSlug(),
          userId: user.id,
          sessionId,
          sourcePresentationId: chatSession.finalPresentationId,
          snapshotPresentationId: snapshot.snapshotId,
          title,
          slideCount: slideCount ?? 0,
          visibility: visibility ?? 'unlisted',
          passcodeHash: passcodeHash ?? null,
          ...(allowPdf !== undefined ? { allowPdf } : {}),
          ...(allowPptx !== undefined ? { allowPptx } : {}),
        },
      });
    }

    return NextResponse.json({ deck: serializePublishedDeck(record) });

  } catch (error) {
    console.error('Error publishing deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
