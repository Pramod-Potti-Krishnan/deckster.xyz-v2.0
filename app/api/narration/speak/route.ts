/**
 * POST /api/narration/speak — say one line out loud.
 *
 * The security shape matters more than anything else here. A public endpoint
 * that synthesises arbitrary caller-supplied text is a free TTS service on
 * somebody else's wallet, so this one **never accepts text from the caller**.
 *
 *   - `announcement` speaks a constant defined in the codebase
 *   - `answer` speaks the STORED answer of a question this deck already
 *     produced, looked up by id
 *
 * In both cases the words are ours, not the caller's. The most a determined
 * caller can do is make the deck repeat something it already said.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { unlockCookieName, verifyUnlockCookie } from '@/lib/publish/passcode';
import { getSessionVoiceId } from '@/lib/narration/voice-store';
import {
  speakAnswer,
  speakFixedLine,
  canSpeakAnswers,
  RUNNING_LONG_LINE,
} from '@/lib/narration/spoken';
import { isNarrationConfigured } from '@/lib/narration/tts';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const slug = typeof body.slug === 'string' ? body.slug : null;
    const kind = body.kind === 'answer' ? 'answer' : 'announcement';
    if (!slug) return NextResponse.json({ error: 'slug is required' }, { status: 400 });

    const deck = await prisma.publishedDeck.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        sessionId: true,
        revokedAt: true,
        visibility: true,
        passcodeHash: true,
        narrationEnabled: true,
      },
    });
    if (!deck || deck.revokedAt || !deck.narrationEnabled) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    // The same gate the deck itself uses. Audio is never more reachable than
    // the slides it belongs to.
    if (deck.visibility === 'restricted') {
      const cookieStore = await cookies();
      const ok = verifyUnlockCookie(
        slug,
        deck.passcodeHash ?? '',
        cookieStore.get(unlockCookieName(slug))?.value
      );
      if (!ok) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (!isNarrationConfigured()) {
      return NextResponse.json({ error: 'Narration is not available' }, { status: 503 });
    }

    const { voiceId } = await getSessionVoiceId(deck.sessionId, deck.userId);
    const voice = voiceId ?? '';

    if (kind === 'announcement') {
      // Fixed text, one object per voice, shared by every deck in the system.
      const spoken = await speakFixedLine(RUNNING_LONG_LINE, voice, 'running-long');
      if (!spoken) return NextResponse.json({ error: 'Could not speak that' }, { status: 502 });
      return new NextResponse(new Uint8Array(spoken.body), {
        headers: {
          'Content-Type': spoken.contentType,
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      });
    }

    // --- answer ------------------------------------------------------------
    // Only voices that start speaking inside the live-answer threshold get
    // here. A nine-second wait after asking reads as broken, not thoughtful.
    if (!canSpeakAnswers(voice)) {
      return NextResponse.json({ error: 'This voice does not speak answers' }, { status: 409 });
    }

    const questionId = typeof body.questionId === 'string' ? body.questionId : null;
    if (!questionId) {
      return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
    }

    // The words come from OUR record, never from the caller. Scoped to this
    // deck so a question id from elsewhere cannot be spoken here.
    const question = await prisma.deckQuestion.findFirst({
      where: { id: questionId, publishedDeckId: deck.id },
      select: { aiAnswer: true, ownerAnswer: true, status: true },
    });
    const text = (question?.ownerAnswer || question?.aiAnswer || '').trim();
    if (!text) {
      // A deferred question has no answer to speak. Silence is correct: the
      // panel already shows the defer in words.
      return NextResponse.json({ error: 'That question has no spoken answer' }, { status: 404 });
    }

    const spoken = await speakAnswer(text, voice);
    if (!spoken) return NextResponse.json({ error: 'Could not speak that' }, { status: 502 });

    // Metered against the publisher, like every other model call this deck
    // makes on a viewer's behalf. Failure to bill must not withhold audio the
    // viewer is already waiting on — it is logged instead.
    try {
      const { debitWallet } = await import('@/lib/wallet');
      if (spoken.costCents > 0) {
        await debitWallet({
          userId: deck.userId,
          amountCents: spoken.costCents,
          reason: 'token_usage',
          sourceRef: `narration:answer:${questionId}`,
          metadata: { kind: 'spoken_answer', voice },
        });
      }
    } catch (error) {
      console.error('[Narration] spoken answer billed nothing:', error);
    }

    return new NextResponse(new Uint8Array(spoken.body), {
      headers: { 'Content-Type': spoken.contentType, 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    console.error('[Narration] speak failed:', error);
    return NextResponse.json({ error: 'Could not speak that' }, { status: 500 });
  }
}
