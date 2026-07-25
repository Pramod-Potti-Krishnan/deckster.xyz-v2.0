import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getPresentationMeta } from '@/lib/publish/layout';
import { serializePublishedDeck } from '@/lib/publish/serialize';

/**
 * GET /api/publish/by-session/[sessionId]
 * Owner lookup for the Share dialog: the session's publish record, or null
 * if the deck has never been published.
 *
 * Query:
 * - checkStale=1 — ALSO compare the live source deck against the frozen copy and
 *   return { isStale, currentSlideCount }. OPT-IN because it costs one GET of the
 *   full deck JSON from the Layout Service, which can be multi-MB; the default
 *   path stays a single DB read and never touches Layout.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { sessionId } = await params;

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

    const deck = await prisma.publishedDeck.findUnique({
      where: { sessionId }
    });

    if (!deck) {
      return NextResponse.json({ deck: null });
    }

    if (deck.userId !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (req.nextUrl.searchParams.get('checkStale') !== '1') {
      return NextResponse.json({ deck: serializePublishedDeck(deck) });
    }

    // Staleness: compare the LIVE source deck's current updated_at against the
    // one recorded when the frozen copy was made. Resolve the source id the same
    // way republish/rotate do (the session's current finalPresentationId, falling
    // back to the recorded one) so a deck that was rebuilt into a NEW
    // presentation id also reads as changed.
    const chatSession = await prisma.chatSession.findUnique({
      where: { id: deck.sessionId },
    });
    const currentSourceId =
      chatSession?.finalPresentationId || deck.sourcePresentationId;
    const { updatedAt, slideCount } = await getPresentationMeta(currentSourceId);

    // Fail SOFT in both unknown directions: a record published before this
    // column existed (sourceUpdatedAt null) or a Layout read that didn't come
    // back (updatedAt null) reports "not stale" rather than nagging the owner
    // into a pointless republish on evidence we don't have.
    const isStale =
      deck.sourceUpdatedAt != null && updatedAt != null && deck.sourceUpdatedAt !== updatedAt;

    return NextResponse.json({
      deck: serializePublishedDeck(deck),
      isStale,
      currentSlideCount: slideCount,
    });

  } catch (error) {
    console.error('Error fetching publish record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
