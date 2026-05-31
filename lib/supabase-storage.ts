import { createClient } from "@supabase/supabase-js"

/**
 * Supabase server-side client for Storage operations only.
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL   — project URL (e.g. https://xxx.supabase.co)
 *   SUPABASE_SERVICE_ROLE_KEY  — service-role key (server only, never expose)
 *
 * Bucket setup (one-time via Supabase Dashboard):
 *   1. Create a public bucket named "avatars"
 *   2. Add RLS policy: authenticated users can INSERT/UPDATE/DELETE
 *      their own files (path prefix = user id)
 */

let _client: ReturnType<typeof createClient> | null = null

function getSupabaseAdmin() {
  if (_client) return _client

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "[supabase-storage] Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    )
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  })
  return _client
}

const BUCKET = "avatars"

/**
 * Upload a user avatar to Supabase Storage.
 * Path: `avatars/{userId}/avatar.{ext}`
 * Returns the public URL of the uploaded file.
 */
export async function uploadAvatar(
  userId: string,
  file: Buffer,
  contentType: string
): Promise<string> {
  const supabase = getSupabaseAdmin()

  const ext = contentType.split("/")[1] || "png"
  const path = `${userId}/avatar.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, {
      contentType,
      upsert: true, // overwrite existing avatar
    })

  if (error) {
    throw new Error(`[supabase-storage] Upload failed: ${error.message}`)
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(BUCKET).getPublicUrl(path)

  // Append cache-buster so browsers pick up the new avatar
  return `${publicUrl}?t=${Date.now()}`
}
