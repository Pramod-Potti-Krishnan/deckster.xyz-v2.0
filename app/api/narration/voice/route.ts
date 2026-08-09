/**
 * GET/PATCH /api/narration/voice?sessionId=… — the deck's narration voice.
 *
 * The catalogue is served from here rather than imported into the client so the
 * measured cost and latency figures have exactly one home. Re-running the
 * bake-off updates `lib/narration/voices.ts` and the picker follows; nothing
 * has to be kept in sync by hand.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { prisma } from '@/lib/prisma';
import { getSessionVoiceId, setSessionVoiceId } from '@/lib/narration/voice-store';
import {
  NARRATION_VOICES,
  DEFAULT_VOICE_ID,
  canSpeakLiveAnswers,
  isKnownVoiceId,
} from '@/lib/narration/voices';
import { isNarrationConfigured } from '@/lib/narration/tts';

export const dynamic = 'force-dynamic';

/** The catalogue as the picker needs it: our ids and the measured numbers, and
 *  no vendor model strings — those are ours to change, not the client's to
 *  depend on. */
function catalogue() {
  return NARRATION_VOICES.map((voice) => ({
    id: voice.id,
    name: voice.name,
    description: voice.description,
    costPerMinuteUsd: voice.costPerMinuteUsd,
    firstAudioSeconds: voice.firstAudioSeconds,
    liveAnswers: canSpeakLiveAnswers(voice),
    sampleUrl: `/api/narration/voice/sample/${voice.id}`,
  }));
}

async function requireOwnedSession(sessionId: string | null) {
  if (!sessionId) {
    return { error: NextResponse.json({ error: 'sessionId is required' }, { status: 400 }) };
  }
  const auth = await getServerSession(authOptions);
  if (!auth?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const user = await prisma.user.findUnique({ where: { email: auth.user.email } });
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  return { userId: user.id, sessionId };
}

export async function GET(request: NextRequest) {
  try {
    const owned = await requireOwnedSession(new URL(request.url).searchParams.get('sessionId'));
    if ('error' in owned) return owned.error;

    const { voiceId, persisted } = await getSessionVoiceId(owned.sessionId, owned.userId);
    return NextResponse.json({
      voices: catalogue(),
      selectedVoiceId: voiceId,
      effectiveVoiceId: voiceId ?? DEFAULT_VOICE_ID,
      // Surfaced rather than hidden: until the migration is applied a choice
      // cannot be stored, and the picker says so instead of silently forgetting.
      persistenceReady: persisted,
      // Likewise for synthesis. Without OPENROUTER_API_KEY the catalogue still
      // renders — the cost and latency figures are static — but no sample can
      // play. Saying which of the two is missing beats a generic playback
      // failure that looks like a broken voice.
      samplesReady: isNarrationConfigured(),
    });
  } catch (error) {
    console.error('[Narration] voice read failed:', error);
    return NextResponse.json({ error: 'Could not load voices' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const owned = await requireOwnedSession(
      typeof body.sessionId === 'string' ? body.sessionId : null
    );
    if ('error' in owned) return owned.error;

    // Rejected rather than coerced: a voice id we do not ship is a client bug
    // or a stale tab, and silently substituting the default would narrate the
    // deck in a voice nobody chose.
    if (!isKnownVoiceId(body.voiceId)) {
      return NextResponse.json({ error: 'Unknown voice' }, { status: 400 });
    }

    const { persisted, found } = await setSessionVoiceId(
      owned.sessionId,
      owned.userId,
      body.voiceId
    );
    if (!found) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ selectedVoiceId: body.voiceId, persistenceReady: persisted });
  } catch (error) {
    console.error('[Narration] voice write failed:', error);
    return NextResponse.json({ error: 'Could not save that voice' }, { status: 500 });
  }
}
