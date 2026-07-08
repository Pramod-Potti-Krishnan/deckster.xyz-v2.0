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

/**
 * Best-effort delete of a presentation (used to reap replaced/revoked
 * snapshots). Failures are logged, never thrown.
 */
export async function deletePresentationSnapshot(presentationId: string): Promise<void> {
  try {
    const response = await fetch(
      `${getLayoutServiceBaseUrl()}/api/presentations/${presentationId}`,
      { method: 'DELETE' }
    )
    if (!response.ok) {
      console.error('[Publish] Snapshot delete failed:', presentationId, response.status)
    }
  } catch (error) {
    console.error('[Publish] Snapshot delete error:', presentationId, error)
  }
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
