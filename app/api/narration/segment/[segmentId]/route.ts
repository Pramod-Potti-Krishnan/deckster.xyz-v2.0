/**
 * GET /api/narration/segment/[segmentId] — one slide's audio.
 *
 * The bucket is private, and that is the whole point: narration for an unlisted
 * or passcode-protected deck must not be fetchable by anyone who guesses a URL.
 * So audio is served through here, re-running the SAME access checks the deck
 * itself uses — a segment is exactly as reachable as the slide it speaks for,
 * never more.
 *
 * Two callers, two gates:
 *   - the creator, authenticated and matched against the segment's owner
 *   - a viewer, allowed only if the deck is published, narration is on, and
 *     they have cleared whatever the deck's visibility requires
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode';
import { getMedia } from '@/lib/narration/media-store';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segmentId: string }> }
) {
  try {
    const { segmentId } = await params;

    const segment = await prisma.mediaSegment.findUnique({
      where: { id: segmentId },
      select: {
        userId: true,
        presentationId: true,
        assetPath: true,
        status: true,
        voiceId: true,
      },
    });
    // A segment that is not ready has no audio behind it. 404 rather than 500:
    // from the caller's side it does not exist.
    if (!segment || segment.status !== 'ready' || !segment.assetPath) {
      return NextResponse.json({ error: 'No audio for that segment' }, { status: 404 });
    }

    let allowed = false;

    // Gate 1 — the creator.
    const auth = await getServerSession(authOptions).catch(() => null);
    if (auth?.user?.email) {
      const user = await prisma.user.findUnique({
        where: { email: auth.user.email },
        select: { id: true },
      });
      if (user?.id === segment.userId) allowed = true;
    }

    // Gate 2 — a viewer of the published deck this segment belongs to.
    if (!allowed) {
      const slug = new URL(request.url).searchParams.get('slug');
      if (slug) {
        const deck = await prisma.publishedDeck.findUnique({
          where: { slug },
          select: {
            revokedAt: true,
            visibility: true,
            passcodeHash: true,
            narrationEnabled: true,
            session: { select: { finalPresentationId: true } },
          },
        });
        // Every condition matters, and the presentation match is the one that
        // stops a published deck being used as a key to somebody else's audio.
        const sameDeck = deck?.session?.finalPresentationId === segment.presentationId;
        if (deck && !deck.revokedAt && deck.narrationEnabled && sameDeck) {
          if (deck.visibility === 'restricted') {
            const cookieStore = await cookies();
            allowed = verifyUnlockCookie(
              slug,
              deck.passcodeHash ?? '',
              cookieStore.get(unlockCookieName(slug))?.value
            );
          } else {
            allowed = true;
          }
        }
      }
    }

    if (!allowed) {
      // Deliberately the same 404 an unknown segment gets. A 403 would confirm
      // that a segment exists for a deck the caller cannot open.
      return NextResponse.json({ error: 'No audio for that segment' }, { status: 404 });
    }

    const stored = await getMedia(segment.assetPath);
    if (!stored) {
      return NextResponse.json({ error: 'Audio is no longer stored' }, { status: 404 });
    }

    return new NextResponse(new Uint8Array(stored.body), {
      headers: {
        'Content-Type': stored.contentType || 'audio/mpeg',
        'Content-Length': String(stored.body.byteLength),
        // Content-addressed: the id changes when the words or the voice change,
        // so the bytes behind an id never do.
        'Cache-Control': 'private, max-age=31536000, immutable',
        'Accept-Ranges': 'none',
      },
    });
  } catch (error) {
    console.error('[Narration] segment fetch failed:', error);
    return NextResponse.json({ error: 'Could not load that audio' }, { status: 500 });
  }
}
