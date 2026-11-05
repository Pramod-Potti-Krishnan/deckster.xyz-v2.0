/**
 * K-02 / identity-v1 phase A: the owner id the chat paperclip upload sends to Researcher
 * `sessions/create`. Import-free (scripts/test-studio-upload-owner.mjs compiles and runs it).
 *
 * Flag NEXT_PUBLIC_STUDIO_OWNER_CUID_ENABLED (exact 'true', default off):
 *  - off: `user.email` (today's behaviour, byte-identical);
 *  - on:  `user.id` (the NextAuth cuid, auth_users.id) when it passes the identity/v1 R2 charset
 *         and is not a placeholder; otherwise '' (never the e-mail: an e-mail is never an owner id).
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
  if (!enabled) return user?.email || ''
  return isCanonicalOwnerId(user?.id) ? user!.id! : ''
}
