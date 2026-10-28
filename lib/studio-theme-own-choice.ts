/**
 * THEME-OWN-CHOICE (FRONTEND-2; flag NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE, exact "true", default off, read inline by app/builder/page.tsx).
 *
 * THE DEFECT (E2E-2, Studio dev, session 57f9e99a, 27 Oct). Before a reload every user_message carried theme {"mode":"auto"}; after it
 * they carried {"mode":"preset","preset_id":"corporate_light"} and the composer read "Theme locked: Corporate Light", which the user never
 * chose. The cause is a pair of facts that meet in lib/studio-theme-restore.ts (NEXT_PUBLIC_STUDIO_THEME_RESTORE):
 *  - Director stores the RESOLVED selection. A user_message that carries theme auto (or a set_theme with auto) runs _handle_set_theme,
 *    whose desired_theme_state.selection is what _apply_theme_to_presentation returns: Auto resolved, the user's standard theme else the
 *    fixed default {"mode":"preset","preset_id":"corporate_light"} (src/utils/theme_selection.py resolve_build_theme_selection). The
 *    request id is a real one (chat-theme-<hash of the raw selection> for a send, Studio's uuid for a set_theme).
 *  - The connect-time `restored` theme_sync carries that selection and "restore:<sid>:<that request id>"; only ":none" (nothing was ever
 *    requested) is read as "never picked" (isNeverPickedRestore). Any other id is adopted as the user's pick (page.tsx
 *    observeThemeRestoreFrame -> setBuildThemeSelection), which locks the preset and puts it in every later send.
 * The frame says nothing about whether the selection was chosen or resolved, so this change keeps its own record of what the USER chose.
 *
 * THE RECORD. sessionStorage (per tab, which is what a reload keeps), one key per session id: the user's own selection, written ONLY by a
 * real pick (the theme picker's handleBuildThemeChange, a chat theme change's applyChatThemeSelection) and, the first time a restore
 * reaches a tab that has none and leaves it on Auto, as the baseline "this tab has seen the session with no pick". Never by a restore that
 * adopts a theme, and never by the standard-theme hydration.
 *
 * THE RULE (themeOwnChoiceRestore). A restore is held back as "Director's resolution, not the user's choice" only when ALL hold:
 *  1. the tab has a record for the session and the user's own selection on record is Auto;
 *  2. the selection the tab holds right now is Auto (nothing picked in between);
 *  3. the restore's adopted theme is exactly Director's default for Auto (corporate_light, no overrides). Any other theme is adopted as
 *     today, so another tab's genuine pick is never lost.
 * Then the page keeps what it holds (Auto), commits the theme-sync state applied for that Auto selection (like restore:<sid>:none) and
 * sends nothing. Everything else is today's behaviour, byte for byte.
 *
 * LIMIT. A tab with no record (a closed and reopened tab, a session saved before this flag) cannot tell a deliberate pick of Corporate
 * Light from Director's default: it adopts, as today, and a real earlier pick is never lost.
 *
 * Pure: no React, no network. The only global is sessionStorage, read and written in try/catch (a blocked store means no record).
 */
import type { BuildThemeSelection } from '@/lib/theme-builder'

export const THEME_OWN_CHOICE_KEY_PREFIX = 'deckster:studio-theme-own-choice:v1:'
/** Director's fixed default for Auto when the user has no standard theme (src/utils/theme_selection.py default_build_theme_selection). */
export const DIRECTOR_AUTO_DEFAULT_PRESET_ID = 'corporate_light'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const FONT_KEYS = ['font_family', 'font_family_heading'] as const

function storage(): Storage | null {
  try {
    return typeof sessionStorage === 'undefined' ? null : sessionStorage
  } catch {
    return null
  }
}

/** The user's own selection on record for the session, or null when this tab has none. */
export function readOwnThemeChoice(sessionId: string | null | undefined): BuildThemeSelection | null {
  if (!sessionId) return null
  try {
    const raw = storage()?.getItem(`${THEME_OWN_CHOICE_KEY_PREFIX}${sessionId}`)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.v !== 1 || !isRecord(parsed.own)) return null
    const mode = parsed.own.mode
    return mode === 'auto' || mode === 'preset' || mode === 'custom' ? (parsed.own as unknown as BuildThemeSelection) : null
  } catch {
    return null
  }
}

/** Put the user's own selection on record (a real pick, or the baseline of a first restore). A blocked store records nothing. */
export function recordOwnThemeChoice(sessionId: string | null | undefined, selection: BuildThemeSelection): void {
  if (!sessionId) return
  try {
    storage()?.setItem(`${THEME_OWN_CHOICE_KEY_PREFIX}${sessionId}`, JSON.stringify({ v: 1, own: selection }))
  } catch {
    // Browser storage can fail (private mode, quota): the restore then behaves as it does today.
  }
}

/** Auto, with or without the fonts it may name. */
function isAutoSelection(selection: BuildThemeSelection | null | undefined): boolean {
  return Boolean(selection) && selection!.mode === 'auto'
}

/** Exactly Director's default for Auto: the corporate_light preset and nothing else (a font choice on Auto rides along, nothing more). */
export function isDirectorAutoDefault(selection: BuildThemeSelection | null | undefined): boolean {
  if (!selection || selection.mode !== 'preset' || selection.preset_id !== DIRECTOR_AUTO_DEFAULT_PRESET_ID) return false
  return Object.keys(selection).every(key => key === 'mode' || key === 'preset_id' || (FONT_KEYS as readonly string[]).includes(key))
}

/**
 * Whether a restore's adopted theme is Director's resolution of the user's Auto rather than their choice. `adopted` is the selection
 * the restore would adopt today (restoredAdoptedSelection), `held` the selection the tab holds now. Returns the selection to KEEP (the
 * held Auto) or null for today's behaviour. Side effect: a tab with no record whose restore leaves it on Auto writes the Auto baseline, so
 * the NEXT restore of this session in this tab is judged against what this tab has seen.
 */
export function themeOwnChoiceRestore(
  sessionId: string | null | undefined,
  held: BuildThemeSelection,
  adopted: BuildThemeSelection | null,
): BuildThemeSelection | null {
  if (!sessionId) return null
  const own = readOwnThemeChoice(sessionId)
  if (!own) {
    // A restore that leaves the tab on Auto (a never-picked session, an explicit Auto) is the baseline: this tab has seen the session with no
    // pick. A restore that adopts a theme is NOT recorded (it is Director's word, not a pick); the tab then adopts the next one the same way.
    if (!adopted || isAutoSelection(adopted)) recordOwnThemeChoice(sessionId, { mode: 'auto' })
    return null
  }
  return isAutoSelection(own) && isAutoSelection(held) && isDirectorAutoDefault(adopted) ? held : null
}
