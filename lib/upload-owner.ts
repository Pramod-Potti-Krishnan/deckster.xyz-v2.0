/**
 * Owner id for browser uploads to the Researcher
 * (R-20261007-frontend-23; contract identity/v1, answer F2).
 *
 * The Researcher binds a session to whatever `user_id` the first
 * `sessions/create` carries. The chat paperclip used to pass the signed-in
 * user's e-mail address, so that binding was an e-mail, not the account id
 * every other path (composer, template ingest, Director, the router) uses.
 *
 * Flag NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED (exact string "true", default off):
 *   - off: nothing changes. The page passes the e-mail and `user_id` is
 *     `userId || 'anonymous'`, exactly as before.
 *   - on:  the page passes `user.id` and the upload is refused, with a clear
 *     message and no request, whenever the owner is not a usable account id
 *     (missing, an e-mail, a placeholder such as 'anonymous').
 *
 * Client and server safe: no imports, no state, the flag is read per call.
 */

/** The platform's owner-id shape: ASCII, starts with a letter or digit, 1-255 characters. */
const OWNER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
const PLACEHOLDER_OWNERS = new Set(['anonymous', 'none', 'null', 'undefined'])

export const UPLOAD_OWNER_REQUIRED_MESSAGE =
  'Upload blocked: your account id could not be confirmed. Please sign out and sign in again, then retry.'

export class UploadOwnerRequiredError extends Error {
  constructor() {
    super(UPLOAD_OWNER_REQUIRED_MESSAGE)
    this.name = 'UploadOwnerRequiredError'
  }
}

/** True when uploads must carry the account id (exact string "true"). */
export function isUploadOwnerIdEnabled(): boolean {
  return process.env.NEXT_PUBLIC_UPLOAD_OWNER_ID_ENABLED === 'true'
}

/** A usable Researcher owner: an account id, never an e-mail or a placeholder. */
export function isUploadOwnerId(value: unknown): value is string {
  return (
    typeof value === 'string'
    && OWNER_ID_PATTERN.test(value)
    && !PLACEHOLDER_OWNERS.has(value.toLowerCase())
  )
}

/**
 * What the builder page hands `useFileUpload` as `userId`.
 * Off: the e-mail, as before. On: the account id (empty when the session has none).
 */
export function builderUploadUserId(
  user: { id?: string | null; email?: string | null } | null | undefined,
): string {
  return isUploadOwnerIdEnabled() ? (user?.id || '') : (user?.email || '')
}

/**
 * The `user_id` for a Researcher `sessions/create` body.
 * Off: `userId || 'anonymous'`, byte-identical to before.
 * On: the account id, or throws UploadOwnerRequiredError (nothing is sent).
 */
export function researcherUploadOwnerId(userId: string | null | undefined): string {
  if (!isUploadOwnerIdEnabled()) return userId || 'anonymous'
  if (!isUploadOwnerId(userId)) throw new UploadOwnerRequiredError()
  return userId
}
