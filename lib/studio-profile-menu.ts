// PASS2 PRO-02/04/05/06/07/08/10 (flag NEXT_PUBLIC_STUDIO_P2_PROFILE_MENU, default off). Import-free: words, routes and the theme mapping only.
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
