import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { serializePublishedDeck } from '@/lib/publish/serialize';

/**
 * GET /api/publish/by-session/[sessionId]
 * Owner lookup for the Share dialog: the session's publish record, or null
 * if the deck has never been published.
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

    return NextResponse.json({ deck: serializePublishedDeck(deck) });

  } catch (error) {
    console.error('Error fetching publish record:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
