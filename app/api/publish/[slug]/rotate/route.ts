import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { generateSlug } from '@/lib/publish/slug';
import { serializePublishedDeck } from '@/lib/publish/serialize';

/**
 * POST /api/publish/[slug]/rotate
 * Mint a new slug for a published deck. Revokes a leaked unlisted URL
 * (and any passcode-unlock cookies, which are scoped to the slug)
 * without unpublishing.
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

    // Mint a fresh slug; retry on the (astronomically unlikely) collision
    let updated = null;
    for (let attempt = 0; attempt < 5 && !updated; attempt++) {
      try {
        updated = await prisma.publishedDeck.update({
          where: { id: existing.id },
          data: { slug: generateSlug() },
        });
      } catch (error: any) {
        // P2002 = unique constraint violation — roll again
        if (error?.code !== 'P2002') throw error;
      }
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Failed to rotate link. Please try again.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ deck: serializePublishedDeck(updated) });

  } catch (error) {
    console.error('Error rotating published deck slug:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
