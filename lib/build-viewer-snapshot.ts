/** A completed, owned Director build is a snapshot revision, even when /p/{id}
 * stays unchanged. This signal never comes from iframe messages or a timer. */
export interface CompletedBuildSnapshot {
  buildId: string
  presentationId: string
  slideCount: number
}

export function completedBuildSnapshotKey(snapshot: CompletedBuildSnapshot | null | undefined): string | null {
  if (!snapshot?.buildId || !snapshot.presentationId || !Number.isSafeInteger(snapshot.slideCount)
    || snapshot.slideCount < 1) return null
  return JSON.stringify([snapshot.buildId, snapshot.presentationId, snapshot.slideCount])
}

export function nativeSnapshotSlideCount(receipt: any): number | null {
  const count = receipt?.data?.count
  return receipt?.success === true && Number.isSafeInteger(count) && count > 0 ? count : null
}

export function buildSnapshotNavigationUrl(approvedUrl: string | null, revision: number): string | null {
  if (!approvedUrl) return null
  const url = new URL(approvedUrl)
  if (revision > 0) url.searchParams.set('studio_build_snapshot', String(revision))
  return url.toString()
}
