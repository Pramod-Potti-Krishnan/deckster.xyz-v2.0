/**
 * GET /api/narration/voice/sample/[voiceId] — the voice preview clip.
 *
 * Three cache layers, each covering the one below it:
 *
 *   1. process memory  — free, but dies with the lambda
 *   2. `deck-media` bucket — DURABLE, and the one that actually matters
 *   3. browser cache   — `private`, so it never reaches the CDN
 *
 * Layer 2 is the point of this file. Without it, every new browser that opened
 * the picker re-rendered all nine voices (~7¢ a time, five Gemini clips
 * dominating), because a `private` header caches in the browser and nowhere
 * else. Synthesis costs money each time it runs, so anything rendered has to
 * outlive the process that rendered it.
 *
 * Authenticated: the first request for an uncached voice spends money, so this
 * is not an open synthesis endpoint wearing a different hat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { getVoice, isKnownVoiceId } from '@/lib/narration/voices';
import { synthesize, isNarrationConfigured } from '@/lib/narration/tts';
import { pcmToWav } from '@/lib/narration/wav';
import { contentKey, getMedia, putMedia, voiceSamplePath } from '@/lib/narration/media-store';

export const dynamic = 'force-dynamic';

/**
 * The preview line every voice reads.
 *
 * Deliberately about NOTHING. An earlier version used a line from a real deck
 * about battery prices, which made the picker sound like it belonged to one
 * presentation — useless for auditioning a voice you intend to use on your own.
 *
 * Topic-free, but still presentation-SHAPED, because that is what is being
 * judged: a greeting to hear warmth, a number to hear how figures are read, an
 * em-dash to hear whether it pauses, a triad for rhythm, and a forward push at
 * the end to hear energy. About sixteen seconds.
 *
 * Changing this text changes every clip's content key, so old objects are
 * simply never read again. No invalidation step, no stale audio.
 */
const SAMPLE_TEXT =
  'Good morning, and thanks for making the time. I want to cover three ' +
  'things — where we stand today, what changed this quarter, and the one ' +
  "decision I'd like to reach before we finish. Let's start with where we stand.";

const memo = new Map<string, { body: Buffer; contentType: string }>();

function audioResponse(body: Buffer, contentType: string, source: string) {
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': contentType,
      // `private` on purpose: the clip is served through an authenticated route
      // and must not sit in a shared cache. The bucket, not the CDN, is what
      // stops us paying to render it twice.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Sample-Source': source,
    },
  });
}

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

    const voice = getVoice(voiceId);
    const key = contentKey({
      text: SAMPLE_TEXT,
      model: voice.model,
      providerVoice: voice.providerVoice,
    });
    // Gemini returns PCM, which a browser cannot play, so it is stored as WAV.
    const extension = voice.responseFormat === 'pcm' ? 'wav' : 'mp3';
    const contentType = extension === 'wav' ? 'audio/wav' : 'audio/mpeg';
    const path = voiceSamplePath(voice.id, key, extension);

    // L1 — process memory.
    const hot = memo.get(path);
    if (hot) return audioResponse(hot.body, hot.contentType, 'memory');

    // L2 — the bucket. The layer that stops us paying twice.
    const stored = await getMedia(path);
    if (stored) {
      memo.set(path, stored);
      return audioResponse(stored.body, stored.contentType, 'bucket');
    }

    // Only now does this cost anything.
    if (!isNarrationConfigured()) {
      return NextResponse.json({ error: 'Narration is not available' }, { status: 503 });
    }

    const result = await synthesize(SAMPLE_TEXT, voiceId);
    const body = result.format === 'pcm' ? pcmToWav(result.audio) : result.audio;

    memo.set(path, { body, contentType });
    // Best-effort and deliberately not awaited into the failure path: if the
    // bucket does not exist yet the clip is still served, just uncached, which
    // is exactly the behaviour before this store existed.
    const persisted = (await putMedia(path, body, contentType)).ok;

    console.info(
      `[Narration] rendered sample voice=${voice.id} model=${voice.model} ` +
        `ttfa=${result.firstAudioSeconds.toFixed(2)}s bytes=${body.byteLength} ` +
        `persisted=${persisted}`
    );

    return audioResponse(body, contentType, persisted ? 'rendered+stored' : 'rendered');
  } catch (error) {
    console.error('[Narration] sample render failed:', error);
    return NextResponse.json({ error: 'Could not render that sample' }, { status: 502 });
  }
}
