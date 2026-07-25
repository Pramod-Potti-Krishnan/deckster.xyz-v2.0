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
 *   return { staleness, isStale, currentSlideCount }. OPT-IN because it costs one
 *   GET of the full deck JSON from the Layout Service, which can be multi-MB; the
 *   default path stays a single DB read and never touches Layout.
 *
 * `staleness` is deliberately THREE-valued — 'stale' | 'current' | 'unknown' —
 * because a missing baseline and a Layout read that didn't come back are not the
 * same thing as "up to date", and the dialog must not tell the owner their copy
 * is current on evidence it doesn't have. `isStale` is the boolean projection
 * ('stale' only), kept so a caller that just wants the banner needn't branch.
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

    // A revoked record has no live link, so nothing consumes the verdict — skip
    // the multi-MB deck GET entirely rather than pay for an answer that is only
    // read in the live branch of the dialog.
    if (req.nextUrl.searchParams.get('checkStale') !== '1' || deck.revokedAt) {
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

    // Report UNKNOWN, not "current", when either side is missing: a record
    // published before this column existed (sourceUpdatedAt null) or a Layout
    // read that didn't come back (updatedAt null) means we have no evidence
    // either way. Collapsing that to "not stale" is what makes a silently-stale
    // link look healthy — the dialog turns 'unknown' into a neutral "can't
    // verify" hint instead of the amber "has changed" banner, so the owner is
    // never nagged into a pointless republish OR told a lie.
    const staleness: 'stale' | 'current' | 'unknown' =
      deck.sourceUpdatedAt == null || updatedAt == null
        ? 'unknown'
        : deck.sourceUpdatedAt !== updatedAt
          ? 'stale'
          : 'current';

    return NextResponse.json({
      deck: serializePublishedDeck(deck),
      staleness,
      isStale: staleness === 'stale',
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
