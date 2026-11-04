// FRONTEND-1 (Pass 5 author lane F-1). Flag NEXT_PUBLIC_STUDIO_AUTHOR_PICKER (the string "true", default off, build-time).
// A "Standard / Author" choice on the outline-approval step, shown only to a premium or internal user. Pure decisions live here.
// Visibility comes ONLY from a server-signed tier claim (the bq claim, F-quota-bq-claim). The NextAuth session's `tier` is NOT used:
// lib/auth-options.ts copies `session.tier` from a client update() into the token, so it is client-editable.
// OPEN: no signed tier claim reaches the browser yet (the bq-claim builder is the open PR #304), so signedAuthorTierClaim() returns null
// and the control stays hidden even with the flag on. Wire (spec F-1): build_mode:"author" on the accept message, only when chosen.

export type AuthorBuildChoice = 'standard' | 'author'
/** A verified, server-signed tier claim as the server hands it over. Never built from client state. */
export type SignedTierClaim = { verified: true; tier: string; internal?: boolean }

export const AUTHOR_PICKER_TIERS = new Set(['premium'])

export const authorPickerFlagOn = (value: string | undefined = process.env.NEXT_PUBLIC_STUDIO_AUTHOR_PICKER): boolean => value === 'true'

/** The signed claim the picker may read. OPEN until the bq claim reaches the client: null, so the control is hidden. */
export function signedAuthorTierClaim(): SignedTierClaim | null {
  return null
}

/** Shown only when the flag is on AND a verified signed claim says premium or internal. Anything else (null, unverified, a plain string, free/starter/pro) hides it. */
export function authorPickerVisible(flag: boolean, claim: unknown): boolean {
  if (!flag || !claim || typeof claim !== 'object') return false
  const c = claim as Partial<SignedTierClaim>
  if (c.verified !== true) return false
  return c.internal === true || (typeof c.tier === 'string' && AUTHOR_PICKER_TIERS.has(c.tier))
}

/** The outline-approval accept actions (the step F-1 sits on). */
export const isOutlineAcceptAction = (value: unknown): boolean =>
  value === 'accept_strawman' || (typeof value === 'string' && value.startsWith('accept_strawman:'))

let choice: AuthorBuildChoice = 'standard'
export const getAuthorBuildChoice = (): AuthorBuildChoice => choice
/** Kept only while the picker is visible; any other call resets to standard. */
export function setAuthorBuildChoice(next: unknown, visible: boolean): AuthorBuildChoice {
  choice = visible && next === 'author' ? 'author' : 'standard'
  return choice
}

/** The field the accept message carries: {build_mode:"author"} only when the flag is on, the claim allows it, the action is the outline accept and Author was chosen; else nothing. */
export function authorBuildModeField(actionValue: unknown, flag: boolean = authorPickerFlagOn(), claim: unknown = signedAuthorTierClaim(), chosen: AuthorBuildChoice = choice): { build_mode?: 'author' } {
  return authorPickerVisible(flag, claim) && isOutlineAcceptAction(actionValue) && chosen === 'author' ? { build_mode: 'author' } : {}
}
