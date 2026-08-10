/**
 * GET /api/narration/manifest — what this deck can play right now.
 *
 * One call, one deck read, one indexed query. The player then fetches audio by
 * segment id, which costs a row lookup and a bucket read — no deck JSON behind
 * every play button.
 *
 * Accepts either `slug` (a viewer, or a creator looking at a published deck) or
 * `presentationId` (the creator previewing before publishing).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { cookies } from 'next/headers';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode';
import { getPresentation } from '@/lib/layout-service-client';
import { getSessionVoiceId } from '@/lib/narration/voice-store';
import { buildManifest } from '@/lib/narration/manifest';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const presentationIdParam = url.searchParams.get('presentationId');

    let presentationId: string | null = null;
    let sessionId: string | null = null;
    let ownerId: string | null = null;
    let allowed = false;

    if (slug) {
      const deck = await prisma.publishedDeck.findUnique({
        where: { slug },
        select: {
          userId: true,
          sessionId: true,
          revokedAt: true,
          visibility: true,
          passcodeHash: true,
          narrationEnabled: true,
          session: { select: { finalPresentationId: true } },
        },
      });
      if (!deck || deck.revokedAt) {
        return NextResponse.json({ error: 'Published deck not found' }, { status: 404 });
      }
      // Narration off means no manifest at all, not an empty one: an empty
      // manifest reads as "recorded nothing", which is a different fact.
      if (!deck.narrationEnabled) {
        return NextResponse.json({ error: 'Narration is not enabled for this deck' }, { status: 404 });
      }
      presentationId = deck.session?.finalPresentationId ?? null;
      sessionId = deck.sessionId;
      ownerId = deck.userId;

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

    // The creator's own preview, before or independent of publishing.
    if (!allowed || presentationIdParam) {
      const auth = await getServerSession(authOptions).catch(() => null);
      if (auth?.user?.email) {
        const user = await prisma.user.findUnique({
          where: { email: auth.user.email },
          select: { id: true },
        });
        if (user) {
          if (presentationIdParam) {
            const owned = await prisma.chatSession.findFirst({
              where: { userId: user.id, finalPresentationId: presentationIdParam },
              select: { id: true },
            });
            if (owned) {
              presentationId = presentationIdParam;
              sessionId = owned.id;
              ownerId = user.id;
              allowed = true;
            }
          } else if (ownerId === user.id) {
            allowed = true;
          }
        }
      }
    }

    if (!allowed || !presentationId || !sessionId || !ownerId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const { voiceId } = await getSessionVoiceId(sessionId, ownerId);
    const presentation = await getPresentation(presentationId);
    const slides: Record<string, unknown>[] = (presentation?.slides as never) ?? [];

    const manifest = await buildManifest(presentationId, slides, voiceId ?? '');
    return NextResponse.json(manifest);
  } catch (error) {
    console.error('[Narration] manifest failed:', error);
    return NextResponse.json({ error: 'Could not load the narration' }, { status: 500 });
  }
}
