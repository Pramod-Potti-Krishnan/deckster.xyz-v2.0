/**
 * GET /api/narration/voice/sample/[voiceId] — the voice preview clip.
 *
 * Rendered ONCE per voice and then cached, because the alternative is that
 * every publisher who opens the picker and clicks through nine voices pays to
 * synthesise the same fifteen seconds again. Cached at the edge and in the
 * browser for a year: the sample text is a constant in this file, so the only
 * thing that can invalidate a clip is a code change, and the voice id is in
 * the URL.
 *
 * Authenticated: it spends money on first render, so it is not an open
 * synthesis endpoint wearing a different hat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getVoice, isKnownVoiceId } from '@/lib/narration/voices';
import { synthesize, isNarrationConfigured } from '@/lib/narration/tts';
import { pcmToWav } from '@/lib/narration/wav';

export const dynamic = 'force-dynamic';

/**
 * The preview line every voice reads.
 *
 * Real presentation narration rather than a pangram, and deliberately carrying
 * a percentage, a year, an em-dash beat and a topic pivot — those are what
 * separate a voice that can carry a deck from one that sounds fine on "the
 * quick brown fox".
 */
const SAMPLE_TEXT =
  'Battery pack prices fell more than twenty-five percent last year — ' +
  'the steepest drop since 2017. That changes the arithmetic on every ' +
  'project in this deck. Let me show you where the capital should go.';

/** Process-local cache. Survives for the life of a warm lambda, which is long
 *  enough to cover a publisher auditioning every voice in one sitting. The
 *  browser and edge caches below do the durable work. */
const memo = new Map<string, { body: Buffer; contentType: string }>();

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ voiceId: string }> }
) {
  try {
    const { voiceId } = await params;

    const auth = await getServerSession(authOptions);
    if (!auth?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (!isKnownVoiceId(voiceId)) {
      return NextResponse.json({ error: 'Unknown voice' }, { status: 404 });
    }
    if (!isNarrationConfigured()) {
      return NextResponse.json({ error: 'Narration is not available' }, { status: 503 });
    }

    const cached = memo.get(voiceId);
    if (cached) {
      return new NextResponse(new Uint8Array(cached.body), {
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'private, max-age=31536000, immutable',
        },
      });
    }

    const voice = getVoice(voiceId);
    const result = await synthesize(SAMPLE_TEXT, voiceId);

    // PCM gets a WAV header so a browser can play it. mp3 goes out untouched.
    const body = result.format === 'pcm' ? pcmToWav(result.audio) : result.audio;
    const contentType = result.format === 'pcm' ? 'audio/wav' : 'audio/mpeg';

    memo.set(voiceId, { body, contentType });
    console.info(
      `[Narration] rendered sample voice=${voice.id} model=${voice.model} ` +
        `ttfa=${result.firstAudioSeconds.toFixed(2)}s bytes=${body.byteLength}`
    );

    return new NextResponse(new Uint8Array(body), {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('[Narration] sample render failed:', error);
    return NextResponse.json({ error: 'Could not render that sample' }, { status: 502 });
  }
}
