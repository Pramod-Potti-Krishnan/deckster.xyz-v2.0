/**
 * P4-15 piece C (DARK): remove ONE Drive item from the library with a real erase (Researcher DELETE /gdrive/items, !273,
 * RESEARCHER_CONNECTOR_ITEM_REMOVE_ENABLED). Rides the Drive flag NEXT_PUBLIC_STUDIO_CONNECTORS_GDRIVE_ENABLED (exact "true", default
 * off): off = no Settings card at all and the /api/connectors/gdrive/items DELETE handler 404s without a fetch.
 * Client-safe (no node: imports). The outcome rule is "never a fake success": a removal is only reported when Researcher says this id
 * was removed AND its content was erased; anything else (503 erase unavailable, rejected, empty, malformed, network) is a failure
 * with a message that says what state the item is in.
 */

export const MAX_REMOVE_ITEMS = 25 // = Researcher RemoveItemsRequest max_length

/** Library item ids (Researcher _REF_RE): any bad id rejects the whole list; deduped, order kept. Empty is not a removal. */
export function validateRemoveItemIds(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_REMOVE_ITEMS) return null
  const out: string[] = []
  for (const id of input) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** Copy from the Drive connector mocks (D6b confirm dialog, D6c success toast). No chat count: the library list does not carry one. */
export const REMOVE_DIALOG_BULLETS = [
  'Deckster deletes its copy of the text and its search index (vectors).',
  'It is unlinked from the chats that use it. Existing slides keep their text, but the citation stops resolving.',
  'Your file in Google Drive is not touched.',
] as const
export const REMOVE_DIALOG_WARNING = 'This cannot be undone. To use it again, re-add it from Drive.'
export const REMOVE_CONFIRM_LABEL = 'Remove permanently'
export const REMOVE_SUCCESS_TOAST = 'Removed. Content and index were deleted. Your Drive file is unchanged.'
export const removeDialogTitle = (title: string | null | undefined) => `Remove "${title || 'Untitled'}" from your library?`

export const REMOVE_FAILED_MESSAGE = "Couldn't remove it. Nothing was changed. Please try again."
export const REMOVE_UNAVAILABLE_MESSAGE = "Couldn't remove it: removal isn't available right now, so nothing was changed. Please try again later."
export const REMOVE_INCOMPLETE_MESSAGE = "Couldn't finish removing it, so it is still in your library. Please try again."
export const REMOVE_NOT_FOUND_MESSAGE = 'That file is no longer in your library.'

export type RemoveOutcome =
  | { kind: 'removed'; message: string; refresh: true }
  | { kind: 'not_found'; message: string; refresh: true }
  | { kind: 'failed'; message: string; refresh: boolean }

/** Maps one Studio response (status + JSON body) for a single-id removal to what the user is told. Pure. */
export function classifyRemoveResponse(id: string, status: number, data: unknown): RemoveOutcome {
  const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>
  if (status < 200 || status >= 300) {
    const unavailable = d.error_code === 'CONNECTOR_ERASE_UNAVAILABLE'
    return { kind: 'failed', refresh: false, message: unavailable ? REMOVE_UNAVAILABLE_MESSAGE : REMOVE_FAILED_MESSAGE }
  }
  const removed = Array.isArray(d.removed) ? d.removed : []
  const rejected = (Array.isArray(d.rejected) ? d.rejected : []) as Array<Record<string, unknown> | null>
  if (removed.includes(id) && d.content_erased === true && rejected.length === 0) return { kind: 'removed', refresh: true, message: REMOVE_SUCCESS_TOAST }
  const mine = rejected.find(r => r && typeof r === 'object' && r.id === id)
  if (mine?.error === 'not_found') return { kind: 'not_found', refresh: true, message: REMOVE_NOT_FOUND_MESSAGE }
  // erase_incomplete (some content may be gone, links kept), or a 200 that does not confirm this id: never a success.
  return { kind: 'failed', refresh: true, message: mine?.error === 'erase_incomplete' ? REMOVE_INCOMPLETE_MESSAGE : REMOVE_FAILED_MESSAGE }
}

/** Browser side: DELETE /api/connectors/gdrive/items for one id. Never throws; a network failure is a failed outcome with nothing changed. */
export async function removeDriveItem(id: string): Promise<RemoveOutcome> {
  try {
    const res = await fetch('/api/connectors/gdrive/items', {
      method: 'DELETE', cache: 'no-store', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item_ids: [id] }),
    })
    return classifyRemoveResponse(id, res.status, await res.json().catch(() => ({})))
  } catch {
    return { kind: 'failed', refresh: false, message: REMOVE_FAILED_MESSAGE }
  }
}
