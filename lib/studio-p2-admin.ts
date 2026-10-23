// PASS2 ADMIN USERS + COUPONS (flag NEXT_PUBLIC_STUDIO_P2_ADMIN, default off). Import-free: the flag, the words, the routes and the rules the two pages use. Nothing here is a permission rule:
// who may open /admin/users and /admin/coupons is decided by the routes under app/api/admin (the signed-in email against DEV_BYPASS_EMAIL), and this file never looks at an email.
//
// What the pages keep: the six requests (GET + POST approve for users; GET + POST + PATCH for coupons) with the bodies they always sent, the filter / search / totals, "Access denied" for a 403 with the way to
// Studio, and the sign-in redirect. What it fixes: a failed read is no longer "Access denied" (users) or a spinner that never ends (coupons); a failed action says so; a refresh does not blank the page;
// the dates, initials and totals cannot throw; the tier reads "Max" on both pages.

/** Exact "true" turns it on. Anything else (unset, "false", "TRUE", " true") is off. The callers pass `process.env.NEXT_PUBLIC_STUDIO_P2_ADMIN` (Next inlines it at build time). */
export function studioP2AdminOn(value: string | null | undefined): boolean {
  return value === 'true'
}

export const STUDIO_P2_ADMIN_ROUTES = { users: '/admin/users', coupons: '/admin/coupons', studio: '/builder' } as const

/** The sign-in page for a signed-out visit, coming back to the page asked for (the same strings the old pages push). */
export const STUDIO_P2_ADMIN_SIGN_IN = {
  users: '/auth/signin?callbackUrl=/admin/users',
  coupons: '/auth/signin?callbackUrl=/admin/coupons',
} as const

/** The admin routes the pages call. Unchanged by this change. */
export const STUDIO_P2_ADMIN_API = {
  users: '/api/admin/users',
  approve: '/api/admin/users/approve',
  coupons: '/api/admin/coupons',
  coupon: (id: string) => `/api/admin/coupons/${id}`,
} as const

export const STUDIO_P2_ADMIN_NAV = [
  { id: 'users', label: 'Users', href: STUDIO_P2_ADMIN_ROUTES.users },
  { id: 'coupons', label: 'Coupons', href: STUDIO_P2_ADMIN_ROUTES.coupons },
] as const

export const STUDIO_P2_ADMIN_WORDS = {
  eyebrow: 'Admin',
  home: 'Deckster home',
  navLabel: 'Admin pages',
  openStudio: 'Open Studio',
  usersTitle: 'User management',
  usersLead: 'Approve or revoke access to Deckster.',
  couponsTitle: 'Coupon management',
  couponsLead: 'Create access coupons and switch them on or off.',
  usersDocumentTitle: 'User management',
  couponsDocumentTitle: 'Coupon management',
  loadingUsers: 'Loading users…',
  loadingCoupons: 'Loading coupons…',
  refreshUsers: 'Refresh users',
  refreshCoupons: 'Refresh coupons',
  retry: 'Try again',
  signIn: 'Sign in',
  deniedTitle: 'Access denied',
  deniedBody: 'This account does not have permission to open this page.',
  failedUsersTitle: 'Users could not be loaded',
  failedCouponsTitle: 'Coupons could not be loaded',
  failedBody: 'The request did not go through, so nothing is shown. Your access has not changed.',
  signedOutTitle: 'Your session has ended',
  signedOutBody: 'Sign in again to see this page.',
  refreshFailed: 'The list could not be refreshed. What is shown is the last list that loaded.',
  statTotalUsers: 'Total users',
  statPending: 'Pending approval',
  statApproved: 'Approved',
  statTotalCoupons: 'Total coupons',
  statActive: 'Active',
  statRedemptions: 'Redemptions',
  searchLabel: 'Search users',
  searchPlaceholder: 'Search by email or name',
  approve: 'Approve',
  revoke: 'Revoke',
  noName: 'No name',
  statusApproved: 'Approved',
  statusPending: 'Pending',
  statusActive: 'Active',
  statusInactive: 'Inactive',
  newCoupon: 'New coupon',
  createTitle: 'Create a coupon',
  createSubmit: 'Create coupon',
  cancel: 'Cancel',
  disable: 'Disable',
  enable: 'Enable',
  copyTitle: 'Copy the code',
  copied: 'Copied',
  noCoupons: 'No coupons yet. Create one to get started.',
  labels: { code: 'Code', value: 'Value (USD)', tier: 'Plan tier', max: 'Max redemptions (blank = unlimited)', expires: 'Expires at (optional)', note: 'Note (internal)' },
  placeholders: { code: 'e.g. WELCOME50', value: 'e.g. 50.00', max: 'e.g. 100', note: 'e.g. For beta testers batch 1' },
} as const

// ---------------------------------------------------------------- reading a list

export type StudioP2AdminListOutcome = 'ready' | 'signin' | 'forbidden' | 'failed'

/** What a list read means, from its HTTP status (null: the request itself failed). Only a 403 is "access denied"; the old users page also called every other failure that, and the coupons page waited forever. */
export function studioP2AdminListOutcome(status: number | null | undefined): StudioP2AdminListOutcome {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'failed'
  if (status >= 200 && status < 300) return 'ready'
  if (status === 401) return 'signin'
  if (status === 403) return 'forbidden'
  return 'failed'
}

/** The rows of a list reply (`{ users: [...] }` / `{ coupons: [...] }`); anything else is an empty list, not a crash. */
export function studioP2AdminRows<T>(data: unknown, key: 'users' | 'coupons'): T[] {
  const rows = data && typeof data === 'object' ? (data as Record<string, unknown>)[key] : undefined
  return Array.isArray(rows) ? (rows as T[]) : []
}

// ---------------------------------------------------------------- a request that did not work

export type StudioP2AdminFailureKind = 'session' | 'forbidden' | 'rejected' | 'failed'

/** 401 the session ended; 403 this account may not; another 4xx the route refused the input (its own sentence is worth showing); anything else (a 5xx, an unreadable reply, no network) is a plain failure. */
export function studioP2AdminFailureKind(status: number | null | undefined): StudioP2AdminFailureKind {
  if (typeof status !== 'number' || !Number.isFinite(status)) return 'failed'
  if (status === 401) return 'session'
  if (status === 403) return 'forbidden'
  if (status >= 400 && status < 500) return 'rejected'
  return 'failed'
}

export const STUDIO_P2_ADMIN_FAILURE_WORDS = {
  session: 'Your session has ended. Sign in again, then try once more.',
  forbidden: 'This account is not allowed to do that.',
} as const

/** The sentence under a failed action. `own` is what the route said (`{ error }`); it is used for a refused input only, and only when it reads as a sentence; otherwise `fallback`. */
export function studioP2AdminFailureSentence(status: number | null | undefined, own: unknown, fallback: string): string {
  const kind = studioP2AdminFailureKind(status)
  if (kind === 'session' || kind === 'forbidden') return STUDIO_P2_ADMIN_FAILURE_WORDS[kind]
  if (kind === 'rejected' && typeof own === 'string') {
    const said = own.trim()
    if (said.length <= 200 && /[A-Za-z]/.test(said) && !said.startsWith('<')) return said
  }
  return fallback
}

export function studioP2AdminApproveFailure(name: string, approved: boolean): string {
  return `${approved ? 'Could not approve' : 'Could not revoke'} ${name}. Try again.`
}

export function studioP2AdminToggleFailure(code: string, active: boolean): string {
  return `Could not ${active ? 'disable' : 'enable'} ${code}. Try again.`
}

export const STUDIO_P2_ADMIN_CREATE_FAILURE = 'The coupon could not be created. Try again.'

export function studioP2AdminCopyFailure(code: string): string {
  return `Could not copy ${code}. Select the code and copy it by hand.`
}

// ---------------------------------------------------------------- the requests (the bodies the pages always sent)

export interface StudioP2AdminInit { method: string; headers: Record<string, string>; body: string }

const JSON_HEADERS = { 'Content-Type': 'application/json' }

/** POST /api/admin/users/approve: `{ userId, approved }`. */
export function studioP2AdminApproveInit(userId: string, approved: boolean): StudioP2AdminInit {
  return { method: 'POST', headers: { ...JSON_HEADERS }, body: JSON.stringify({ userId, approved }) }
}

/** PATCH /api/admin/coupons/:id: `{ active }`, the opposite of what the coupon is now. */
export function studioP2AdminToggleInit(active: boolean): StudioP2AdminInit {
  return { method: 'PATCH', headers: { ...JSON_HEADERS }, body: JSON.stringify({ active: !active }) }
}

export interface StudioP2AdminCouponForm { code: string; valueDollars: string; tier: string; maxRedemptions: string; expiresAt: string; note: string }

export const STUDIO_P2_ADMIN_EMPTY_FORM: StudioP2AdminCouponForm = { code: '', valueDollars: '', tier: 'starter', maxRedemptions: '', expiresAt: '', note: '' }

/** The create body, field for field the old page's. */
export function studioP2AdminCouponBody(form: StudioP2AdminCouponForm) {
  return {
    code: form.code,
    valueCents: Math.round(parseFloat(form.valueDollars) * 100),
    tier: form.tier,
    maxRedemptions: form.maxRedemptions ? parseInt(form.maxRedemptions) : null,
    expiresAt: form.expiresAt || null,
    note: form.note || null,
  }
}

/** POST /api/admin/coupons. */
export function studioP2AdminCreateInit(form: StudioP2AdminCouponForm): StudioP2AdminInit {
  return { method: 'POST', headers: { ...JSON_HEADERS }, body: JSON.stringify(studioP2AdminCouponBody(form)) }
}

// ---------------------------------------------------------------- users

export type StudioP2AdminUserFilter = 'all' | 'pending' | 'approved'
export const STUDIO_P2_ADMIN_USER_FILTERS: readonly StudioP2AdminUserFilter[] = ['all', 'pending', 'approved']
export const STUDIO_P2_ADMIN_DEFAULT_FILTER: StudioP2AdminUserFilter = 'pending'
export const STUDIO_P2_ADMIN_FILTER_LABELS: Record<StudioP2AdminUserFilter, string> = { all: 'All', pending: 'Pending', approved: 'Approved' }

export interface StudioP2AdminUser {
  id: string
  email: string
  name: string | null
  image: string | null
  approved: boolean
  approvedAt: string | null
  createdAt: string
  tier: string
}

export function studioP2AdminUserCounts(users: readonly { approved: boolean }[]) {
  const approved = users.filter(user => user.approved).length
  return { total: users.length, pending: users.length - approved, approved }
}

/** The approval filter, then the search over email and name (case-insensitive; a search padded with spaces is trimmed, so "rowan " finds Rowan). */
export function studioP2AdminFilterUsers<T extends { email: string; name: string | null; approved: boolean }>(users: readonly T[], filter: StudioP2AdminUserFilter, query: string): T[] {
  let rows = users.slice()
  if (filter === 'pending') rows = rows.filter(user => !user.approved)
  else if (filter === 'approved') rows = rows.filter(user => user.approved)
  const needle = query.trim().toLowerCase()
  if (needle) rows = rows.filter(user => (user.email ?? '').toLowerCase().includes(needle) || (user.name ?? '').toLowerCase().includes(needle))
  return rows
}

/** What the list says when it has no rows: because of the search, or because of the filter, or because there is nobody. */
export function studioP2AdminUsersEmpty(filter: StudioP2AdminUserFilter, query: string, total: number): { title: string; body: string } {
  const needle = query.trim()
  if (needle) return { title: `No users match “${needle}”.`, body: 'Check the spelling, or clear the search.' }
  if (total === 0) return { title: 'No users have signed up yet.', body: 'People appear here as soon as they sign up.' }
  if (filter === 'pending') return { title: 'No one is waiting for approval.', body: 'Everyone who has signed up is approved.' }
  if (filter === 'approved') return { title: 'No users have been approved yet.', body: 'Approve someone from the Pending list.' }
  return { title: 'No users to show.', body: '' }
}

// ---------------------------------------------------------------- shared by both pages

/** "premium" is sold as Max; the other tiers are their name with a capital. */
export function studioP2AdminTierLabel(tier: string | null | undefined): string {
  if (typeof tier !== 'string' || tier === '') return 'No plan'
  return tier === 'premium' ? 'Max' : tier.charAt(0).toUpperCase() + tier.slice(1)
}

/** The letter in the avatar when there is no photo: the name's, else the email's. */
export function studioP2AdminInitial(name: string | null | undefined, email: string | null | undefined): string {
  const source = (name && name.trim()) || (email && email.trim()) || ''
  return source ? source.charAt(0).toUpperCase() : '?'
}

/** A date from the API, or null when it is missing or not a date (the old pages threw on one and blanked the page). */
export function studioP2AdminDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function studioP2AdminMoney(cents: number | null | undefined): string {
  return `$${((typeof cents === 'number' && Number.isFinite(cents) ? cents : 0) / 100).toFixed(2)}`
}

// ---------------------------------------------------------------- coupons

export interface StudioP2AdminCoupon {
  id: string
  code: string
  valueCents: number
  tier: string
  maxRedemptions: number | null
  timesRedeemed: number
  expiresAt: string | null
  active: boolean
  note: string | null
  createdAt: string
}

export function studioP2AdminCouponTotals(coupons: readonly { active: boolean; timesRedeemed: number; valueCents: number }[]) {
  return {
    total: coupons.length,
    active: coupons.filter(coupon => coupon.active).length,
    redemptions: coupons.reduce((sum, coupon) => sum + coupon.timesRedeemed, 0),
    creditedCents: coupons.reduce((sum, coupon) => sum + coupon.timesRedeemed * coupon.valueCents, 0),
  }
}

/** "Expires" or "Expired" for a coupon's expiry date, against the clock `nowMs` (the old row said "Expires" for one that already had). Null when there is no usable date. */
export function studioP2AdminExpiry(expiresAt: string | null | undefined, nowMs: number): { expired: boolean; date: Date; word: 'Expires' | 'Expired' } | null {
  const date = studioP2AdminDate(expiresAt)
  if (!date) return null
  const expired = date.getTime() < nowMs
  return { expired, date, word: expired ? 'Expired' : 'Expires' }
}

/** "37 of 100 redeemed" with a limit, "12 redeemed" without one. */
export function studioP2AdminRedeemed(times: number, max: number | null | undefined): string {
  return typeof max === 'number' ? `${times} of ${max} redeemed` : `${times} redeemed`
}

/** The "Copied" mark stays this long. */
export const STUDIO_P2_ADMIN_COPIED_MS = 2000
