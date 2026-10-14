/**
 * PASS2 #2 fix-forward (flag NEXT_PUBLIC_STUDIO_FIRST_RUN_V2), J2 pass-2 P1: an existing deck flashed the first-run welcome while its session loaded.
 *
 * The first-run welcome shows whenever the transcript holds no user turn. That is also true, for a moment, of an existing session whose history
 * is still being fetched. So the welcome must wait until the session is CONFIRMED new (or restored). Pure policy, no React and no globals but the
 * injected storage; the page passes the result to MessageList (studioRestoring) and to the stage's first-run attribute.
 *
 * A session is still restoring while its history loads, unless the page already knows it is new:
 *  - the session hook just assigned this local UUID itself (studioInitialKnownFresh: its "load" is only the lookup that finds no row), or
 *  - this tab generated the route's id and has not saved it (the per-id unsaved marker the session hygiene already trusts to keep an unknown id
 *    as a new, unsaved session: a reload of a bare /builder's own URL).
 */
import { readSessionOrigin } from '@/lib/studio-session-hygiene'

interface StorageLike { getItem(key: string): string | null }

/** True only when this tab generated `routeSessionId` for `ownerId` and it still has no saved row (the marker is per account and per id, so it cannot leak from another session). */
export function isLocalUnsavedRoute(ownerId: string, routeSessionId: string | null, getStorage: () => StorageLike | null | undefined): boolean {
  if (!ownerId || !routeSessionId || routeSessionId === 'new') return false
  let storage: StorageLike | null | undefined = null
  try { storage = getStorage() } catch { return false }
  return readSessionOrigin(storage, ownerId, routeSessionId).unsavedMarker
}

export function isStudioSessionRestoring(input: {
  /** session.isLoadingSession: the history of the URL's session is being fetched. */
  loadingSession: boolean
  /** The session hook assigned this local UUID itself (studioInitialKnownFresh). */
  knownFresh: boolean
  /** The route's id is a local, unsaved id (isLocalUnsavedRoute). */
  localUnsavedRoute: boolean
}): boolean {
  return input.loadingSession && !input.knownFresh && !input.localUnsavedRoute
}
