/**
 * K-02 / identity-v1 phase A: the owner id the chat paperclip upload sends to Researcher
 * `sessions/create`. Import-free (scripts/test-studio-upload-owner.mjs compiles and runs it).
 *
 * Flag NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED (exact 'true', default off):
 *  - off: `user.email` (today's behaviour, byte-identical);
 *  - on:  `user.id` (the NextAuth cuid, auth_users.id) when it passes the identity/v1 R2 charset
 *         and is not a placeholder; otherwise the base's own value (`user.email`, as with the flag off), so the flag on is
 *         never worse than the flag off and never turns a known owner into the empty value the upload hook sends as 'anonymous'.
 */
export const STUDIO_OWNER_CUID_ENABLED = process.env.NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED === 'true'

const CANONICAL = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,254}$/
const PLACEHOLDERS = new Set(['anonymous', 'none', 'null', 'undefined'])

export function isCanonicalOwnerId(value: unknown): value is string {
  return typeof value === 'string' && CANONICAL.test(value) && !PLACEHOLDERS.has(value.toLowerCase())
}

export function uploadOwnerId(
  user: { id?: string | null; email?: string | null } | null | undefined,
  enabled: boolean = STUDIO_OWNER_CUID_ENABLED,
): string {
  if (enabled && isCanonicalOwnerId(user?.id)) return user!.id!
  return user?.email || ''
}

/**
 * The page spreads this AFTER the base's own `userId: user?.email || ''` in the useFileUpload options, so the base's line stays
 * as it is (a pure insertion): `{}` when the flag is off or the account id is not a canonical owner id (the base's e-mail stands,
 * byte-identical), `{ userId: <the id> }` only when the flag is on and the id passes the check. It never carries an empty or
 * placeholder `userId`, so the override can never produce the 'anonymous' the upload hook sends for an empty owner.
 */
export function uploadOwnerOverride(
  user: { id?: string | null; email?: string | null } | null | undefined,
  enabled: boolean = STUDIO_OWNER_CUID_ENABLED,
): { userId?: string } {
  const id = user?.id
  return enabled && isCanonicalOwnerId(id) ? { userId: id } : {}
}
