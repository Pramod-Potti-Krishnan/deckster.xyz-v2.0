/**
 * Durable storage for generated audio.
 *
 * Synthesis costs money every time it runs, so anything we render must survive
 * the process that rendered it. The voice samples shipped without this: they
 * lived in a per-lambda `Map` behind a `private` cache header, which caches in
 * the browser but not the CDN — so every new browser that auditioned the picker
 * re-rendered all nine voices, about 7¢ a time, forever. Small per user and
 * entirely avoidable.
 *
 * Samples are the easy case and the right place to start: the script is a
 * constant and the roster is fixed, so nine objects written once. The same
 * store is what the per-slide `MediaSegment` renders will use later.
 *
 * DEGRADES WHEN THE BUCKET IS ABSENT. Every function here returns null or false
 * rather than throwing if `deck-media` does not exist or the service-role key is
 * unset. That keeps this deployable before the bucket is created — the caller
 * falls back to render-and-serve, which is exactly today's behaviour — and it
 * starts caching the moment the bucket appears, with no redeploy.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createHash } from 'node:crypto'

export const MEDIA_BUCKET = 'deck-media'

let client: SupabaseClient | null = null

function admin(): SupabaseClient | null {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  client = createClient(url, key, { auth: { persistSession: false } })
  return client
}

export function isMediaStoreConfigured(): boolean {
  return admin() !== null
}

/**
 * Content address for a rendered clip.
 *
 * Everything that changes the audio goes in: the text, the model and the
 * provider's voice id. So re-wording the sample script, or repointing a voice
 * at a different model, produces a different key and the old object is simply
 * never read again — no invalidation logic, no stale audio, no cache-busting
 * query strings.
 *
 * This is the same idea `render_spec_hash` will use for deck segments, at a
 * smaller scale.
 */
export function contentKey(parts: {
  text: string
  model: string
  providerVoice: string
}): string {
  // NUL-delimited so the parts cannot run together: without a separator,
  // model 'a/b' + voice 'cd' and model 'a/bc' + voice 'd' would hash
  // identically, and two different voices would share one stored clip.
  // NUL is the one byte that cannot appear in any of these inputs.
  return createHash('sha256')
    .update(`${parts.model}\u0000${parts.providerVoice}\u0000${parts.text}`)
    .digest('hex')
    .slice(0, 16)
}

/** Fetch a stored object, or null on any miss. Never throws. */
export async function getMedia(
  path: string
): Promise<{ body: Buffer; contentType: string } | null> {
  const supabase = admin()
  if (!supabase) return null
  try {
    const { data, error } = await supabase.storage.from(MEDIA_BUCKET).download(path)
    if (error || !data) return null
    const body = Buffer.from(await data.arrayBuffer())
    // A zero-length object is a failed upload, not a cache hit. Treat it as a
    // miss so the next request re-renders instead of serving silence.
    if (body.byteLength < 500) return null
    return { body, contentType: data.type || 'application/octet-stream' }
  } catch {
    return null
  }
}

/**
 * Store an object. Returns whether it stuck.
 *
 * `upsert` is deliberate: two cold requests for the same voice can render
 * concurrently, and the loser overwriting the winner with byte-identical audio
 * is harmless. The alternative — a lock — would cost more than the duplicate
 * render it prevents.
 */
export async function putMedia(
  path: string,
  body: Buffer,
  contentType: string
): Promise<boolean> {
  const supabase = admin()
  if (!supabase) return false
  try {
    const { error } = await supabase.storage
      .from(MEDIA_BUCKET)
      .upload(path, body, { contentType, upsert: true })
    if (error) {
      // Most likely the bucket does not exist yet. Log once at info rather than
      // error: it is an expected state before setup, not a fault.
      console.info(`[Narration] media store unavailable (${error.message}) — serving without cache`)
      return false
    }
    return true
  } catch (error) {
    console.info('[Narration] media store threw, serving without cache:', error)
    return false
  }
}

/** Where a voice's preview clip lives. */
export function voiceSamplePath(voiceId: string, key: string, extension: string): string {
  return `voice-samples/${voiceId}.${key}.${extension}`
}
