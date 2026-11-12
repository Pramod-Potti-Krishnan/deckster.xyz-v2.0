interface RestoreBlankElementOptions {
  elementId: string
  trackingWasRemoved: boolean
  deleteElement: () => Promise<unknown>
  insertElement: () => Promise<unknown>
  restoreTracking: (restoredElementId: string) => void
  onDeleteError?: (error: unknown) => void
}

function responseElementId(response: unknown): string | null {
  if (!response || typeof response !== 'object') return null
  const value = (response as Record<string, unknown>).elementId
  return typeof value === 'string' && value ? value : null
}

/**
 * Restore a blank placeholder after any post-spinner generation failure.
 * Layout delete is intentionally best-effort: a missing spinner must never
 * prevent the replacement insert or leave the placeholder untracked.
 */
export async function restoreBlankElementAfterFailure({
  elementId,
  trackingWasRemoved,
  deleteElement,
  insertElement,
  restoreTracking,
  onDeleteError,
}: RestoreBlankElementOptions): Promise<string> {
  try {
    await deleteElement()
  } catch (error) {
    onDeleteError?.(error)
  }

  const response = await insertElement()
  const restoredElementId = responseElementId(response) ?? elementId
  if (trackingWasRemoved || restoredElementId !== elementId) {
    restoreTracking(restoredElementId)
  }
  return restoredElementId
}
