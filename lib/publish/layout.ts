// Server-side Layout Service helpers for the publish API routes.
//
// API routes run on the server, so they prefer the server-only
// LAYOUT_SERVICE_URL (if set) over the public NEXT_PUBLIC_ variant, falling
// back to the same default host the client bundle uses.

export function getLayoutServiceBaseUrl(): string {
  return (
    process.env.LAYOUT_SERVICE_URL ||
    process.env.NEXT_PUBLIC_LAYOUT_SERVICE_URL ||
    'https://web-production-f0d13.up.railway.app'
  )
}

export interface SnapshotResult {
  snapshotId: string
  sourceId: string
}

/**
 * Freeze the current state of a presentation into a new write-locked copy.
 * POST /api/presentations/{id}/snapshot -> {"snapshot_id", "source_id"}
 */
export async function snapshotPresentation(presentationId: string): Promise<SnapshotResult | null> {
  try {
    const response = await fetch(
      `${getLayoutServiceBaseUrl()}/api/presentations/${presentationId}/snapshot`,
      { method: 'POST' }
    )
    if (!response.ok) {
      console.error('[Publish] Snapshot failed:', response.status, await response.text().catch(() => ''))
      return null
    }
    const data = await response.json()
    if (!data?.snapshot_id) return null
    return { snapshotId: data.snapshot_id, sourceId: data.source_id ?? presentationId }
  } catch (error) {
    console.error('[Publish] Snapshot request error:', error)
    return null
  }
}

export interface DeleteResult {
  /** true only when the snapshot is confirmed gone from the Layout Service */
  ok: boolean
}

/**
 * Best-effort delete of a presentation (used to reap replaced/revoked
 * snapshots). Never throws — returns { ok } so callers can tell the owner the
 * truth about whether the old copy is actually gone.
 *
 * `ok` is true on a 2xx delete, and also on 404 — an already-absent snapshot IS
 * revoked (and lets a re-deleted, previously-reaped snapshot drop off the stale
 * list instead of retrying forever). A key mismatch (403) or a Layout 5xx means
 * the snapshot may still be live, so `ok` is false and the caller must not claim
 * revocation.
 *
 * The Layout Service gates bare-DELETE of a publish snapshot behind the
 * X-Publish-Key header. The SAME secret lives in Vercel env LAYOUT_PUBLISH_KEY
 * and Railway layout env PUBLISH_DELETE_KEY. Server-side only — never exposed
 * to the client bundle.
 */
export async function deletePresentationSnapshot(presentationId: string): Promise<DeleteResult> {
  try {
    const response = await fetch(
      `${getLayoutServiceBaseUrl()}/api/presentations/${presentationId}`,
      {
        method: 'DELETE',
        headers: { 'X-Publish-Key': process.env.LAYOUT_PUBLISH_KEY || '' },
      }
    )
    if (response.ok || response.status === 404) return { ok: true }
    console.error('[Publish] Snapshot delete failed:', presentationId, response.status)
    return { ok: false }
  } catch (error) {
    console.error('[Publish] Snapshot delete error:', presentationId, error)
    return { ok: false }
  }
}

/**
 * Opportunistic self-heal: retry-delete snapshot ids a previous
 * publish/rotate/unpublish couldn't reap, and return the ids that STILL can't be
 * deleted (to persist back onto the record). No cron needed — every publish
 * lifecycle op sweeps the backlog.
 */
export async function retryDeleteStaleSnapshots(ids: readonly string[]): Promise<string[]> {
  if (!ids || ids.length === 0) return []
  // De-dup: the stored backlog can contain repeats, and there is no point
  // issuing the same DELETE twice in one sweep.
  const unique = Array.from(new Set(ids))
  const stillStale: string[] = []
  await Promise.all(
    unique.map(async (id) => {
      const { ok } = await deletePresentationSnapshot(id)
      if (!ok) stillStale.push(id)
    })
  )
  return stillStale
}

/**
 * Fallback slide count: read slides.length off the full deck JSON.
 */
export async function getPresentationSlideCount(presentationId: string): Promise<number | null> {
  try {
    const response = await fetch(
      `${getLayoutServiceBaseUrl()}/api/presentations/${presentationId}`
    )
    if (!response.ok) return null
    const data = await response.json()
    return Array.isArray(data?.slides) ? data.slides.length : null
  } catch (error) {
    console.error('[Publish] Slide count fetch error:', presentationId, error)
    return null
  }
}
