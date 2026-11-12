/**
 * THEME-RESET-ON-RECONNECT-P1, Studio half: adopt the theme Director restores on connect.
 *
 * Flag NEXT_PUBLIC_STUDIO_THEME_RESTORE (exact "true", default off), read inline by app/builder/page.tsx. Off, nothing in
 * this module is consulted and the Builder is exactly as before. On (pairs with Director's
 * DIRECTOR_THEME_RESTORE_ON_CONNECT_ENABLED, which must be switched on first):
 *
 *  1. Director sends, once per connect, `theme_sync {status: "restored", theme, applied, desired_status, presentation_id}`:
 *     after `sync_response` on a reconnect, after the blank deck on a new session, always before the history replay and
 *     the greeting. `session_id` is top-level on the frame; the frame has no `message_id`.
 *  2. The page adopts `theme` as its build theme (`restoredThemeSelection`) and commits the theme-sync state the restore
 *     describes (`restoredThemeSync`), so the deck-theme effect finds the theme already applied and sends nothing.
 *     The state is committed settled: a restore whose apply is still in flight on another tab (`desired_status: "syncing"`,
 *     which Director acknowledges only to the socket that asked) counts as applied, with no timer and no banner.
 *     `theme: null` (nothing was ever chosen) shows Auto and sends nothing either. A restore never counts as a user pick.
 *     Exception, `restore:<session_id>:none` (Director found no desired theme state: the user never picked a theme with
 *     `set_theme`, and a build writes none): the theme it carries is Director's own default for the deck, which it applied
 *     when it created the session's blank deck (the user's standard theme, else corporate_light), not a choice. The page keeps
 *     Auto (no "Theme selected" chip) and commits the theme-sync state as applied for the Auto fingerprint of the presentation,
 *     so nothing is sent (restoredAdoptedSelection). Any other id ends in the request id of a real pick (Auto included) and is
 *     adopted as above.
 *  3. Until the restore (or the fallback below) has arrived on the current socket, the socket-ready `set_theme` is held
 *     (`themeRestoreHoldsSocketSync`), unless the user picked a theme: a real pick always goes out, and a restore that
 *     arrives after it is a no-op.
 *  4. Fallback, for a Director without the restore: on a reconnect, the first frame after `sync_response` that is not a
 *     `theme_sync`; on a new session (no `sync_response`), the first `chat_message` (the greeting). Then today's
 *     socket-ready sync runs unchanged. No timer.
 *
 * Pure: no React, no network, no globals. Imports only import-free theme helpers.
 */
import type { BuildThemeSelection } from '@/lib/theme-builder'
import { themeSelectionFingerprint } from '@/lib/theme-builder'
import { themeFontFields } from '@/lib/theme-fonts'
import type { ThemeSyncState } from '@/lib/theme-sync'
import { presetPaletteModeField } from '@/lib/studio-theme-dark-toggle'

export const THEME_RESTORED_STATUS = 'restored'

/** The `restored` payload as Director sends it (connect_theme_restore.restored_theme_payload). */
export interface ThemeRestorePayload {
  request_id?: unknown
  status?: unknown
  presentation_id?: unknown
  theme?: unknown
  applied?: unknown
  desired_status?: unknown
}

/** The few frame fields the gate reads; every Director frame the hook hands the page fits it. */
export interface ThemeRestoreFrame {
  type: string
  session_id?: unknown
  payload?: unknown
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

const HARMONY = ['auto', 'monochrome', 'analogous', 'complementary', 'triadic'] as const
const PALETTE = ['light', 'dark', 'both'] as const

function colorOverrides(value: unknown): Record<string, string> | undefined {
  if (!isRecord(value)) return undefined
  const out: Record<string, string> = {}
  for (const [slot, hex] of Object.entries(value)) {
    if (nonEmptyString(hex)) out[slot] = hex
  }
  return Object.keys(out).length > 0 ? out : undefined
}

/**
 * Director's stored selection (normalize_build_theme_selection: preset | custom, either with color_overrides and fonts,
 * or an explicit auto) as the Builder's BuildThemeSelection. `null` when nothing usable is stored: the caller shows Auto
 * and sends nothing. Fonts survive only with NEXT_PUBLIC_THEME_FONT_SELECTION_ENABLED (themeFontFields), as everywhere else.
 * A preset keeps its palette_mode 'light' | 'dark' only with NEXT_PUBLIC_STUDIO_THEME_DARK_PERSIST (presetPaletteModeField); off, it comes back without it.
 */
export function restoredThemeSelection(theme: unknown): BuildThemeSelection | null {
  if (!isRecord(theme)) return null
  const fonts = themeFontFields(theme)
  if (theme.mode === 'auto') return { mode: 'auto', ...fonts }

  const overrides = colorOverrides(theme.color_overrides)
  if (theme.mode === 'preset') {
    if (!nonEmptyString(theme.preset_id)) return null
    return {
      mode: 'preset',
      preset_id: theme.preset_id,
      ...presetPaletteModeField(theme),
      ...(overrides ? { color_overrides: overrides } : {}),
      ...fonts,
    }
  }

  if (theme.mode === 'custom') {
    const next: BuildThemeSelection = { mode: 'custom' }
    if (nonEmptyString(theme.primary_hex)) next.primary_hex = theme.primary_hex
    if (overrides) next.color_overrides = overrides
    if (nonEmptyString(theme.secondary_hex)) next.secondary_hex = theme.secondary_hex
    if (nonEmptyString(theme.tertiary_hex)) next.tertiary_hex = theme.tertiary_hex
    if (nonEmptyString(theme.neutral_hex)) next.neutral_hex = theme.neutral_hex
    const harmony = HARMONY.find(value => value === theme.harmony_preference)
    if (harmony) next.harmony_preference = harmony
    const palette = PALETTE.find(value => value === theme.palette_mode)
    if (palette) next.palette_mode = palette
    Object.assign(next, fonts)
    // Director only stores a custom theme that carries a primary colour or overrides.
    return next.primary_hex || next.color_overrides ? next : null
  }

  return null
}

/** The suffix Director gives `restore:<session_id>:<desired request id | none>` when the session has no desired theme state. */
export const THEME_RESTORE_NEVER_PICKED_SUFFIX = ':none'

/**
 * A restore of a session whose user never picked a theme (`restore:<session_id>:none`). Director writes desired theme state
 * only for a `set_theme`, so ":none" is guaranteed exactly when no pick was ever made; a build, and the auto-theming of the
 * session's blank deck at creation (stored only as applied state, request id "initial:<presentation id>"), write none.
 */
export function isNeverPickedRestore(payload: ThemeRestorePayload): boolean {
  return nonEmptyString(payload.request_id) && payload.request_id.endsWith(THEME_RESTORE_NEVER_PICKED_SUFFIX)
}

/**
 * The selection the Builder adopts for a restore: Director's stored theme, except for a never-picked restore, whose theme is
 * Director's default for the deck and not the user's choice: the picker stays on Auto. The caller commits the theme-sync state
 * for the selection returned here (restoredThemeSync), so a never-picked restore is applied for the Auto fingerprint and the
 * deck-theme effect has nothing to send. `null` when nothing usable is stored (Auto, nothing committed), as before.
 */
export function restoredAdoptedSelection(payload: ThemeRestorePayload): BuildThemeSelection | null {
  const stored = restoredThemeSelection(payload.theme)
  if (!stored) return null
  return isNeverPickedRestore(payload) ? { mode: 'auto' } : stored
}

/**
 * The theme-sync state the restore describes, committed so the deck-theme effect treats the adopted theme as current.
 * `null` (commit nothing) without a presentation or a request id, or for any other status.
 *
 * The settling rule: a restore is committed SETTLED. Director acknowledges an apply only on the socket that asked for it,
 * so a restore that says `desired_status: "syncing"` with `applied: false` (another tab's apply is in flight) can never
 * be acknowledged to this tab: waiting on it would only run into the 20 s timeout and a "Theme application timed out"
 * banner for a theme nobody on this socket asked for. The tab did not request that apply, so it commits `applied` for
 * this presentation and theme (no timer, no banner), and element generation proceeds at once. Director's `failed` is
 * kept (the stored theme could not be applied; the banner is right), and `applied` is unchanged.
 */
export function restoredThemeSync(payload: ThemeRestorePayload, selection: BuildThemeSelection): ThemeSyncState | null {
  if (!nonEmptyString(payload.presentation_id) || !nonEmptyString(payload.request_id)) return null
  const status = settledRestoreStatus(payload)
  if (!status) return null
  return {
    status,
    requestId: payload.request_id,
    presentationId: payload.presentation_id,
    themeFingerprint: themeSelectionFingerprint(selection),
    error: status === 'failed' ? 'Director could not apply this theme.' : null,
  }
}

/** `applied` or `failed` (never `syncing`, see restoredThemeSync) from Director's `applied` and `desired_status`; null for neither. */
function settledRestoreStatus(payload: ThemeRestorePayload): 'applied' | 'failed' | null {
  if (payload.applied === true) return 'applied'
  if (payload.desired_status === 'failed') return 'failed'
  // 'syncing' is another tab's apply in flight: settled (see restoredThemeSync).
  return payload.desired_status === 'syncing' || payload.desired_status === 'applied' ? 'applied' : null
}

// ------------------------------------------------------------------------------------------------------------- the gate

/** Per socket and session: still waiting for Director's restore, the restore arrived, or no restore is coming. */
export type ThemeRestorePhase = 'waiting' | 'restored' | 'fallback'

export interface ThemeRestoreGate {
  readonly sessionId: string | null
  readonly phase: ThemeRestorePhase
  /** A sync_response arrived on this socket (a reconnect): the next non-theme_sync frame is the fallback signal. */
  readonly syncSeen: boolean
}

/** A fresh gate (waiting) for this session: every new socket and every session change starts here. */
export function themeRestoreGateFor(sessionId: string | null): ThemeRestoreGate {
  return { sessionId, phase: 'waiting', syncSeen: false }
}

export function isFreshThemeRestoreGate(gate: ThemeRestoreGate, sessionId: string | null): boolean {
  return gate.sessionId === sessionId && gate.phase === 'waiting' && !gate.syncSeen
}

export interface ThemeRestoreStep {
  gate: ThemeRestoreGate
  /** The restore to adopt (first `restored` frame of this socket, for this session); otherwise null. */
  restore: ThemeRestorePayload | null
  /** The frame is a `restored` theme_sync: the page's ordinary theme_sync handling must not see it. */
  consumed: boolean
}

export function isThemeRestoreFrame(frame: ThemeRestoreFrame): boolean {
  return frame.type === 'theme_sync' && isRecord(frame.payload) && frame.payload.status === THEME_RESTORED_STATUS
}

/**
 * Advance the gate by one frame from the current socket (the hook drops frames of retired sockets). `sessionId` is the
 * session the page shows. A frame naming another session changes nothing; a frame with no session id counts as this
 * socket's own for the fallback, but only a frame naming this session can restore a theme.
 */
export function advanceThemeRestoreGate(
  gate: ThemeRestoreGate,
  sessionId: string | null,
  frame: ThemeRestoreFrame,
): ThemeRestoreStep {
  const restoreFrame = isThemeRestoreFrame(frame)
  const frameSession = nonEmptyString(frame.session_id) ? frame.session_id : null
  if (!sessionId || (frameSession !== null && frameSession !== sessionId)) {
    return { gate, restore: null, consumed: restoreFrame }
  }
  const current = gate.sessionId === sessionId ? gate : themeRestoreGateFor(sessionId)

  if (frame.type === 'sync_response') {
    return {
      gate: current.phase === 'waiting' && !current.syncSeen ? { ...current, syncSeen: true } : current,
      restore: null,
      consumed: false,
    }
  }
  if (frame.type === 'theme_sync') {
    if (!restoreFrame) return { gate: current, restore: null, consumed: false }
    // Exactly one restore per socket counts; a late one (after the fallback) or a repeat is a no-op.
    if (current.phase !== 'waiting' || frameSession !== sessionId) return { gate: current, restore: null, consumed: true }
    return { gate: { ...current, phase: 'restored' }, restore: frame.payload as ThemeRestorePayload, consumed: true }
  }
  if (current.phase === 'waiting' && (current.syncSeen || frame.type === 'chat_message')) {
    return { gate: { ...current, phase: 'fallback' }, restore: null, consumed: false }
  }
  return { gate: current, restore: null, consumed: false }
}

/**
 * Whether the deck-theme effect must hold its socket-ready `set_theme`: yes until this session's gate fell back to
 * today's behaviour (no restore coming). After a restore the effect has nothing to send (the restored theme is current,
 * or nothing is stored); a user pick always goes through.
 */
export function themeRestoreHoldsSocketSync(gate: ThemeRestoreGate, sessionId: string | null, userPicked: boolean): boolean {
  if (userPicked) return false
  return !(gate.sessionId === sessionId && gate.phase === 'fallback')
}
export * from './studio-theme-own-choice' // THEME-OWN-CHOICE: the own-choice rule (NEXT_PUBLIC_STUDIO_THEME_OWN_CHOICE) rides on the restore's public surface, which the restore harness spreads into the page's scope
