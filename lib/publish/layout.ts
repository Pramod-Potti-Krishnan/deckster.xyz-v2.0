// Server-side Layout Service helpers for the publish API routes.
//
// The URL itself is resolved by lib/publish/service-urls, which refuses to fall
// back to the production Layout Service from a non-production deployment —
// publish writes (snapshot create/delete), so a silent prod fallback in UAT
// would create and delete presentations in production.

import { getLayoutServiceBaseUrl } from './service-urls'

export { getLayoutServiceBaseUrl }

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

// Warn once the still-failing stale-snapshot backlog crosses this size. The
// Set de-dup removes exact repeats, but under a sustained delete-key mismatch
// each republish parks a NEW distinct old-snapshot id, so the backlog grows
// unbounded (bigger reads + bigger DELETE sweeps every lifecycle op).
const STALE_SNAPSHOT_BACKLOG_WARN_THRESHOLD = 20

/**
 * Opportunistic self-heal: retry-delete snapshot ids a previous
 * publish/rotate/unpublish couldn't reap, and return the ids that STILL can't be
 * deleted (to persist back onto the record). No cron needed — every publish
 * lifecycle op sweeps the backlog. `deckRef` (id/slug) is logging context only.
 */
export async function retryDeleteStaleSnapshots(
  ids: readonly string[],
  deckRef?: string,
): Promise<string[]> {
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
  // A growing backlog means revocation DELETEs keep failing — surface it loudly
  // for operators instead of accumulating silently. Do NOT cap or discard ids
  // (that would leak live snapshots); just make the trend visible in logs.
  // TODO(publish): move persistently-failing ids onto a dedicated cleanup queue
  // rather than carrying them inline forever (documented follow-up).
  if (stillStale.length > STALE_SNAPSHOT_BACKLOG_WARN_THRESHOLD) {
    console.warn(
      `[Publish] Stale-snapshot backlog is growing: ${stillStale.length} snapshots ` +
        `still cannot be deleted${deckRef ? ` for deck ${deckRef}` : ''}. Likely cause: ` +
        `the publish delete key (LAYOUT_PUBLISH_KEY / PUBLISH_DELETE_KEY) is misconfigured, ` +
        `so Layout revocation DELETEs are rejected.`
    )
  }
  return stillStale
}

export interface PresentationMeta {
  /** Layout's top-level `updated_at` string, verbatim (null if absent) */
  updatedAt: string | null
  /** slides.length (null if the deck has no slides array) */
  slideCount: number | null
}

/**
 * One GET of the deck JSON -> the two facts publish cares about. The deck JSON
 * can be multi-MB, so callers that need both must use this rather than issuing
 * two fetches (and no caller should reach for it on a hot path).
 *
 * Never throws: every failure mode collapses to null, because the callers use
 * this for advisory signals that must not break a publish.
 */
export async function getPresentationMeta(presentationId: string): Promise<PresentationMeta> {
  try {
    const response = await fetch(
      `${getLayoutServiceBaseUrl()}/api/presentations/${presentationId}`
    )
    if (!response.ok) return { updatedAt: null, slideCount: null }
    const data = await response.json()
    return {
      updatedAt: typeof data?.updated_at === 'string' ? data.updated_at : null,
      slideCount: Array.isArray(data?.slides) ? data.slides.length : null,
    }
  } catch (error) {
    console.error('[Publish] Presentation meta fetch error:', presentationId, error)
    return { updatedAt: null, slideCount: null }
  }
}

/**
 * Slide count: read slides.length off the full deck JSON.
 */
export async function getPresentationSlideCount(presentationId: string): Promise<number | null> {
  const { slideCount } = await getPresentationMeta(presentationId)
  return slideCount
}

/**
 * The SOURCE deck's `updated_at`, persisted at publish time and compared on the
 * owner's next dialog open to tell them — exactly, not by clock heuristics —
 * that the frozen published copy no longer matches the deck they're editing.
 *
 * Returns null on ANY failure (non-2xx, network error, field missing/not a
 * string). A null is stored as "unknown" and never fails the publish, and the
 * staleness check treats unknown as "not stale" so a Layout hiccup can't nag the
 * owner into pointless republishes.
 *
 * ACCEPTED TRADE-OFF: Layout bumps `updated_at` on ANY deck write, including a
 * speaker-notes / script save. Editing only narration therefore counts as
 * "changed" here even though viewers of the published deck see no visible
 * difference. We prefer that false positive (a redundant republish) to the false
 * negative this whole signal exists to kill (a silently stale public link).
 */
export async function getPresentationUpdatedAt(presentationId: string): Promise<string | null> {
  const { updatedAt } = await getPresentationMeta(presentationId)
  return updatedAt
}

/**
 * Read the slide count off a just-created SNAPSHOT deck with a small bounded
 * retry. The snapshot's count is authoritative — it's exactly what viewers and
 * the PPTX export receive — so publish/rotate must never fall back to a
 * possibly-stale session/source count. The snapshot was created moments ago, so
 * a transient GET failure is worth a couple of quick retries before the caller
 * fails closed. Returns a positive count, or null if it still can't be read.
 */
export async function getSnapshotSlideCountWithRetry(
  snapshotId: string,
  attempts = 3,
  delayMs = 250,
): Promise<number | null> {
  for (let i = 0; i < attempts; i++) {
    const count = await getPresentationSlideCount(snapshotId)
    if (count && count > 0) return count
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  return null
}
