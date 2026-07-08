import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  UNLOCK_COOKIE_MAX_AGE,
  unlockCookieName,
  unlockCookieValue,
  verifyPasscode,
} from '@/lib/publish/passcode';

// Small fixed delay on failed attempts — cheap brute-force damper
const FAILURE_DELAY_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * POST /api/publish/[slug]/unlock
 * Public endpoint: verify the passcode for a restricted deck and set the
 * httpOnly unlock cookie (HMAC of the slug, scoped to the slug's name).
 *
 * Body: { passcode: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    // Await params (Next.js 15 requirement)
    const { slug } = await params;

    const body = await req.json().catch(() => null);
    const passcode = typeof body?.passcode === 'string' ? body.passcode : '';

    const deck = await prisma.publishedDeck.findUnique({
      where: { slug }
    });

    if (!deck || deck.revokedAt) {
      return NextResponse.json(
        { error: 'Published deck not found' },
        { status: 404 }
      );
    }

    // Nothing to unlock for public/unlisted decks
    if (deck.visibility !== 'restricted' || !deck.passcodeHash) {
      return NextResponse.json({ success: true });
    }

    if (!passcode || !verifyPasscode(passcode, deck.passcodeHash)) {
      await delay(FAILURE_DELAY_MS);
      return NextResponse.json(
        { error: 'Incorrect passcode' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(unlockCookieName(slug), unlockCookieValue(slug), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: UNLOCK_COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === 'production',
    });
    return response;

  } catch (error) {
    console.error('Error unlocking published deck:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
