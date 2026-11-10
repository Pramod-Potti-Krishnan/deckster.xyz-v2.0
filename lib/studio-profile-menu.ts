// PASS2 PRO-02/03/04/05/06/07/08/10 (flag NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU, default off). Import-free: words, routes, the theme mapping and the usage meters only.
//
// The Studio account menu (the rail avatar) follows the accepted v4 mockup: "Your details", a three-way Appearance control (Light / Dark / Auto),
// "Settings & preferences", "Keyboard shortcuts", "Workspace & billing", trailing chevrons, sentence-case "Sign out". "Dashboard" and "Knowledge"
// are not here: the rail beside the menu already has both destinations (and calls the second one "Second brain").

/** The values next-themes stores: `system` is the "Auto" of the mockup (it follows the operating system). */
export type StudioAppearance = 'light' | 'dark' | 'system'

export interface StudioAppearanceOption {
  value: StudioAppearance
  label: string
  /** The hover hint; the visible label alone names the choice. */
  hint: string
}

export const STUDIO_APPEARANCE_OPTIONS: readonly StudioAppearanceOption[] = [
  { value: 'light', label: 'Light', hint: 'Always light' },
  { value: 'dark', label: 'Dark', hint: 'Always dark' },
  { value: 'system', label: 'Auto', hint: 'Follows your system' },
]

/** The control's selected value for the stored theme. The app's default is light, so anything that is not dark or system reads as light. */
export function studioAppearanceChoice(theme: string | null | undefined): StudioAppearance {
  return theme === 'dark' || theme === 'system' ? theme : 'light'
}

/** The theme to store for a value the radio group reports, or null for anything that is not one of the three choices. */
export function studioAppearanceFromValue(value: string | null | undefined): StudioAppearance | null {
  return value === 'light' || value === 'dark' || value === 'system' ? value : null
}

export type StudioProfileRowId = 'details' | 'settings' | 'shortcuts' | 'billing' | 'help'

export type StudioProfileEntry =
  | { kind: 'row'; id: StudioProfileRowId; label: string; href: string }
  | { kind: 'appearance' }
  | { kind: 'separator' }

/** The menu body in the mockup's order, between the identity block and the About / usage / sign-out tail. */
export const STUDIO_PROFILE_LAYOUT: readonly StudioProfileEntry[] = [
  { kind: 'row', id: 'details', label: 'Your details', href: '/studio/details' },
  { kind: 'appearance' },
  { kind: 'row', id: 'settings', label: 'Settings & preferences', href: '/settings' },
  { kind: 'row', id: 'shortcuts', label: 'Keyboard shortcuts', href: '/shortcuts' },
  { kind: 'row', id: 'billing', label: 'Workspace & billing', href: '/billing' },
  { kind: 'separator' },
  { kind: 'row', id: 'help', label: 'Help', href: '/help' },
]

/** The words of the controls that are not table rows. */
export const STUDIO_PROFILE_WORDS = {
  appearance: 'Appearance',
  about: 'About Studio',
  signOut: 'Sign out',
} as const

// PRO-03: "Your creative capacity" is always visible, as the mockup's card, with the REAL numbers: the daily and weekly share of the allowance that is
// left (what /api/usage/quota already returns for the old collapsed "Usage remaining" row), one thin meter each, and when it resets. Nothing is invented:
// no token counts (the quota read has none), no plan simulator.

export type StudioUsageMeterId = 'daily' | 'weekly'

export interface StudioUsageMeter {
  id: StudioUsageMeterId
  label: string
  /** Whole percent of the allowance that is left, 0 to 100. */
  percent: number
  /** "Resets in 5h" or "Resets Oct 28"; empty when the read carries no usable reset time. */
  reset: string
}

/** The part of the quota read the card uses (the same shape the menu already fetches). */
export interface StudioQuotaForMeters {
  remainingPct?: { daily?: unknown; weekly?: unknown } | null
  resetAt?: { daily?: unknown; weekly?: unknown } | null
}

export const STUDIO_USAGE_WORDS = {
  title: 'Your creative capacity',
  left: 'left',
  upgrade: 'Upgrade for more usage',
  upgradeHref: '/billing',
} as const

const METERS: readonly { id: StudioUsageMeterId; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
]

/** Whole percent left for a 0..1 share (clamped, like the old row); null for anything that is not a finite number, so no meter shows a made-up value. */
export function studioUsagePercent(share: unknown): number | null {
  return typeof share === 'number' && Number.isFinite(share) ? Math.round(Math.max(0, Math.min(1, share)) * 100) : null
}

const HOUR_MS = 3_600_000
const shortDate = (date: Date): string => date.toLocaleDateString([], { month: 'short', day: 'numeric' })

/** When the allowance resets: hours while under a day away, the date after that; empty for a missing or unreadable time. */
export function studioUsageResetText(resetAt: unknown, now: Date, formatDate: (date: Date) => string = shortDate): string {
  if (typeof resetAt !== 'string') return ''
  const at = new Date(resetAt)
  const ms = at.getTime() - now.getTime()
  if (Number.isNaN(ms)) return ''
  if (ms <= 0) return 'Resets now'
  const hours = Math.floor(ms / HOUR_MS)
  if (hours < 1) return 'Resets in under 1h'
  return hours < 24 ? `Resets in ${hours}h` : `Resets ${formatDate(at)}`
}

/** The card's meters, daily then weekly; a meter whose share is unreadable is left out (none at all when the read has neither). */
export function studioUsageMeters(quota: StudioQuotaForMeters | null | undefined, now: Date = new Date(), formatDate?: (date: Date) => string): StudioUsageMeter[] {
  if (!quota) return []
  const meters: StudioUsageMeter[] = []
  for (const { id, label } of METERS) {
    const percent = studioUsagePercent(quota.remainingPct?.[id])
    if (percent === null) continue
    meters.push({ id, label, percent, reset: studioUsageResetText(quota.resetAt?.[id], now, formatDate) })
  }
  return meters
}
