// PASS2 Profile page (NEXT_PUBLIC_STUDIO_P2_PROFILE_PAGE): the words and the small rules of /settings/profile in the Studio shell. Import-free, so the test runs it as plain code.
// The limits below are the profile routes' own (app/api/profile/route.ts, app/api/profile/avatar/route.ts); the test pins them to those sources.

export const STUDIO_PROFILE_NAME_MAX = 80
export const STUDIO_PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const STUDIO_PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const

export const STUDIO_PROFILE_WORDS = {
  title: 'Profile information',
  lede: 'Your personal details and account information',
  edit: 'Edit profile',
  cancel: 'Cancel',
  save: 'Save',
  saving: 'Saving…',
  changePhoto: 'Change photo',
  uploading: 'Uploading…',
  photoHint: 'JPEG, PNG, WebP, or GIF · up to 5 MB',
  nameLabel: 'Display name',
  nameHelp: 'Your account display name · up to 80 characters',
  namePlaceholder: 'Enter your display name',
  nameUnset: 'Not set',
  emailLabel: 'Email address',
  emailNote: 'Your email is linked to your Google account and cannot be changed here.',
  planTitle: 'Your plan',
  planNote: 'Plan, payment method, and invoices',
  planAction: 'Manage plan',
  loading: 'Loading your profile…',
  signedOutTitle: 'You are signed out',
  signedOutBody: 'Sign in to see and edit your profile.',
  signIn: 'Sign in',
  nameSaved: 'Display name saved.',
  photoSaved: 'Account photo saved.',
  reload: 'Reload to refresh your account session.',
} as const

export type StudioProfileKind = 'name' | 'photo'

/** The two letters shown when there is no photo: first letters of the first two words, upper case; "U" when the name is empty. */
export function studioProfileInitials(name: unknown): string {
  if (typeof name !== 'string') return 'U'
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toUpperCase()
  return letters || 'U'
}

/** '' when the name can be saved, else the sentence to show. Mirrors the route: trimmed, 1 to 80 characters. */
export function studioProfileNameProblem(name: unknown): string {
  const trimmed = typeof name === 'string' ? name.trim() : ''
  return trimmed && trimmed.length <= STUDIO_PROFILE_NAME_MAX ? '' : 'Use a display name between 1 and 80 characters.'
}

/** '' when the file can be uploaded, else the sentence to show (checked before any request, as the route would refuse it). */
export function studioProfilePhotoProblem(file: { type?: unknown; size?: unknown } | null | undefined): string {
  if (!file) return ''
  if (!(STUDIO_PROFILE_PHOTO_TYPES as readonly unknown[]).includes(file.type)) return 'Choose a JPEG, PNG, WebP, or GIF image.'
  if (typeof file.size !== 'number' || !(file.size > 0)) return 'This image is empty. Choose another file.'
  if (file.size > STUDIO_PROFILE_PHOTO_MAX_BYTES) return 'Choose an account photo smaller than 5 MB.'
  return ''
}

const FAILURE = {
  name: 'Your display name could not be saved. Your edit is still here.',
  photo: 'Your account photo could not be uploaded. Try again.',
} as const

/** The sentence for a refused request. A signed-out or oversized reply gets its own words; another 4xx passes on the route's reason; a server fault (or anything unreadable) gets the plain fallback. */
export function studioProfileFailure(kind: StudioProfileKind, status: unknown, body: unknown): string {
  const code = typeof status === 'number' ? status : 0
  if (code === 401) return 'Your session has ended. Sign in again, then try once more.'
  if (code === 413) return kind === 'photo' ? 'Choose an account photo smaller than 5 MB.' : FAILURE[kind]
  const reason = body && typeof body === 'object' ? (body as { error?: unknown }).error : undefined
  if (code >= 400 && code < 500 && typeof reason === 'string' && reason.trim()) return reason.trim()
  return FAILURE[kind]
}

/** The sentence after a saved change: whether the signed-in session was refreshed decides the second half. */
export function studioProfileSaved(kind: StudioProfileKind, refreshed: boolean): string {
  const saved = kind === 'name' ? STUDIO_PROFILE_WORDS.nameSaved : STUDIO_PROFILE_WORDS.photoSaved
  return refreshed ? saved : `${saved} ${STUDIO_PROFILE_WORDS.reload}`
}

/** The plan badge next to the name: nothing for free (or no plan), "Max" for the premium tier, the plan's own name otherwise. */
export function studioProfileTier(tier: unknown): { id: string; label: string } | null {
  if (typeof tier !== 'string') return null
  const id = tier.trim().toLowerCase()
  if (!id || id === 'free') return null
  if (id === 'premium') return { id, label: 'Max' }
  return { id, label: id.charAt(0).toUpperCase() + id.slice(1) }
}
