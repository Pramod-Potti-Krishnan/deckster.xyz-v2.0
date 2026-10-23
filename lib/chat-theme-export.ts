/**
 * FRONTEND-2 Pass 3: change the theme and export the deck from chat (NEXT_PUBLIC_CHAT_THEME_CHANGE and NEXT_PUBLIC_CHAT_EXPORT, each exact
 * "true", default off, read at build time, independent of each other).
 *
 * Contract: streams/director2/theme-export/CONTRACT.md (Director !513, DIRECTOR_MDC_THEME_CHANGE_ENABLED / DIRECTOR_MDC_EXPORT_ENABLED).
 *
 * With a flag on, Studio adds its cap (`theme1` / `export1`) to `user_message.data.client_caps` and runs the matching directive:
 *  - `theme_directive {directive_id, presentation_id, selection, label}`: the selection goes through the theme picker's own apply (the
 *    page's handleBuildThemeChange body, without the build-selection lock: Director sends it only for a built deck, which the picker
 *    locks; PROGRAM-1's E4a ruling), the page's own deck-theme effect sends `set_theme` with Studio's own request id, and the answer is
 *    read from that request's terminal `theme_sync`. Answers `applied`, or `failed` + a code.
 *  - `export_directive {directive_id, presentation_id, format}`: the Download menu's own downloadPDF / downloadPPTX with its default
 *    quality and the menu's enable rule. Answers `done` when that call returns success (contract §4), or `failed` + a code.
 * Each is answered with `element_directive_result {directive_id, status, error_code}`. Studio shows no line of its own: Director closes
 * the turn with a fixed line. Flags off: none of this runs, and the sends, the socket handling and the page are exactly as before.
 */

import { isCanonicalThemePresetId, themeSelectionFingerprint, type BuildThemeSelection } from '@/lib/theme-builder'
import type { ThemeSyncState } from '@/lib/theme-sync'
import { studioExportBlockedReason } from '@/lib/studio-export-gate'
import { exportControlsAllowed } from '@/lib/build-narration-heuristics'
import type { DownloadQuality, DownloadResult } from '@/lib/api/download-service'
import type {
  ExportDirectiveMessage, ThemeDirectiveMessage, ThemeExportDirectiveOwner, ThemeExportErrorCode, ThemeExportResultData,
} from '@/lib/chat-theme-export-wire'

export {
  CHAT_EXPORT_ENABLED, CHAT_THEME_CHANGE_ENABLED, CHAT_THEME_EXPORT_CAPS, EXPORT_CLIENT_CAP, EXPORT_DIRECTIVE_TYPE, THEME_CLIENT_CAP,
  THEME_DIRECTIVE_TYPE, chatThemeExportDirectiveKind, themeExportDirectiveId,
} from '@/lib/chat-theme-export-wire'
export type {
  ExportDirectiveMessage, ThemeDirectiveMessage, ThemeExportDirectiveMessage, ThemeExportDirectiveOwner, ThemeExportErrorCode,
  ThemeExportResultData,
} from '@/lib/chat-theme-export-wire'

/** The Download menu's default quality (components/presentation-download-controls.tsx `useState<DownloadQuality>('high')`). */
export const CHAT_EXPORT_QUALITY: DownloadQuality = 'high'

/** The session and presentation on screen now (the page's K5 owner record, elementDirectiveGenerationOwnerRef). */
export interface DisplayedDeckOwner {
  sessionId?: string | null
  deckOwnerSessionId?: string | null
  presentationId?: string | null
  epoch?: number
}

type Result = ThemeExportResultData
const answer = (directiveId: string, status: Result['status'], errorCode: ThemeExportErrorCode | null = null): Result => ({
  directive_id: directiveId, status, error_code: status === 'failed' ? errorCode : null,
})

/** The owner check of the K5 add and refine runners: the directive belongs to the session and the presentation on screen, and stays so. */
function ownerCheck(message: { session_id?: string; payload?: { presentation_id?: unknown } }, owner: ThemeExportDirectiveOwner, displayed: () => DisplayedDeckOwner) {
  const start = displayed()
  const owns = () => {
    const now = displayed()
    return Boolean(start.sessionId && start.presentationId
      && now.sessionId === start.sessionId && now.deckOwnerSessionId === start.sessionId && now.presentationId === start.presentationId
      && now.epoch === start.epoch)
  }
  const ok = Boolean(owner.sessionId && owns() && start.sessionId === owner.sessionId
    && (typeof message.session_id !== 'string' || message.session_id === owner.sessionId)
    && message.payload?.presentation_id === start.presentationId)
  return { ok, owns, presentationId: start.presentationId ?? null }
}

// ---- theme ------------------------------------------------------------------------------------------------------------------------

/**
 * The selection exactly as the contract allows it (§3.1: `{mode:'preset', preset_id}` or `{mode:'custom', primary_hex}`, nothing else),
 * rebuilt from its two keys, or null. A preset must be one Studio's own picker offers (lib/theme-builder.ts CANONICAL_THEME_PRESET_IDS,
 * which follows NEXT_PUBLIC_THEME_PICKER_CANON_ENABLED); a colour must be `#rrggbb`.
 */
export function chatThemeSelection(selection: unknown): BuildThemeSelection | null {
  if (!selection || typeof selection !== 'object') return null
  const value = selection as { mode?: unknown; preset_id?: unknown; primary_hex?: unknown }
  if (value.mode === 'preset') {
    return typeof value.preset_id === 'string' && isCanonicalThemePresetId(value.preset_id) ? { mode: 'preset', preset_id: value.preset_id } : null
  }
  if (value.mode === 'custom') {
    return typeof value.primary_hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.primary_hex)
      ? { mode: 'custom', primary_hex: value.primary_hex.toLowerCase() } : null
  }
  return null
}

export interface ThemeDirectiveRunnerDeps {
  displayed: () => DisplayedDeckOwner
  /** The page's theme guards at arrival (themeSyncTargetRef plus the build flags behind generationSelectionsLocked, minus the built-deck lock). */
  locks: () => { composerBlocked: boolean; composerFrozen: boolean; templateMode: boolean; generating: boolean }
  /** The page's applyChatThemeSelection (handleBuildThemeChange's body without the lock); returns the selection it set. */
  apply: (selection: BuildThemeSelection) => BuildThemeSelection
  /** The page's theme sync state now (themeSyncRef.current), which its theme_sync handler commits. */
  themeSync: () => ThemeSyncState
  /** One wait between looks at the theme sync state. */
  wait: () => Promise<void>
  now: () => number
  /** Longer than the page's own THEME_SYNC_TIMEOUT_MS, whose timer commits `failed` first; this only ends a wait that nothing ends. */
  timeoutMs: number
}

/** Runs one `theme_directive`; returns the `element_directive_result.data` to send. Every exit is a known status. */
export async function runThemeDirective(message: ThemeDirectiveMessage, owner: ThemeExportDirectiveOwner, deps: ThemeDirectiveRunnerDeps): Promise<Result> {
  const directiveId = String(message?.payload?.directive_id)
  try {
    const check = ownerCheck(message, owner, deps.displayed)
    if (!check.ok || !check.presentationId) return answer(directiveId, 'failed', 'not_owner')
    const selection = chatThemeSelection(message.payload?.selection)
    if (!selection) return answer(directiveId, 'failed', 'theme_failed')
    const locks = deps.locks()
    // Contract §6.2 and the page's own refusals in requestThemeSyncForPresentation; a build, an outline or a template reuse running is the
    // reason the picker is locked (generationSelectionsLocked), so it is theme_locked too.
    if (locks.composerBlocked && locks.composerFrozen) return answer(directiveId, 'failed', 'theme_locked')
    if (locks.templateMode) return answer(directiveId, 'failed', 'theme_locked')
    if (locks.composerBlocked) return answer(directiveId, 'failed', 'theme_failed')
    if (locks.generating) return answer(directiveId, 'failed', 'theme_locked')

    const start = deps.themeSync()
    const fingerprint = themeSelectionFingerprint(deps.apply(selection))
    const deadline = deps.now() + deps.timeoutMs
    for (;;) {
      if (!check.owns()) return answer(directiveId, 'failed', 'not_owner')
      const sync = deps.themeSync()
      if (sync.presentationId === check.presentationId && sync.themeFingerprint === fingerprint) {
        // Applied for this deck and this theme: the request the deck-theme effect minted, or the deck already had it.
        if (sync.status === 'applied') return answer(directiveId, 'applied')
        // A failure committed after the apply (Director's failed theme_sync, the page's own timeout, a refused or unsent set_theme).
        if (sync.status === 'failed' && sync !== start) return answer(directiveId, 'failed', 'theme_failed')
      }
      if (deps.now() >= deadline) return answer(directiveId, 'failed', 'timeout')
      await deps.wait()
    }
  } catch {
    return answer(directiveId, 'failed', 'theme_failed')
  }
}

// ---- export -----------------------------------------------------------------------------------------------------------------------

/** What the Download menu is rendered and enabled with (components/builder/presentation-area.tsx, components/presentation-download-controls.tsx). */
export interface ChatExportState {
  presentationUrl: string | null
  slideCount: number | null
  stage: number
  hasFinalDeck: boolean
  /** STUDIO shell && NEXT_PUBLIC_STUDIO_EXPORT_AFTER_BUILD (the controls' exportAfterBuild). */
  exportAfterBuild: boolean
  /** The area's studioPartialArtifact and build narration (its exportsAllowed: the menu is not rendered otherwise). */
  partialArtifact: boolean
  narrationActive: boolean
  narrationPhase: string
}

/** The Download menu's own rule: rendered (exportsAllowed) and enabled (isDownloadEnabled). */
export function chatExportAllowed(state: ChatExportState): boolean {
  const exportsAllowed = !state.partialArtifact && exportControlsAllowed(state.narrationActive, state.narrationPhase as Parameters<typeof exportControlsAllowed>[1])
  const exportBlockedReason = studioExportBlockedReason({ enabled: state.exportAfterBuild, stage: state.stage, hasFinalDeck: state.hasFinalDeck })
  return exportsAllowed && state.presentationUrl !== null && state.stage >= 4 && exportBlockedReason === null
}

export interface ExportDirectiveRunnerDeps {
  displayed: () => DisplayedDeckOwner
  exportState: () => ChatExportState
  downloadPDF: (presentationUrl: string, quality: DownloadQuality) => Promise<DownloadResult>
  downloadPPTX: (presentationUrl: string, slideCount: number, quality: DownloadQuality) => Promise<DownloadResult>
}

/** Runs one `export_directive`; returns the `element_directive_result.data` to send. Every exit is a known status. */
export async function runExportDirective(message: ExportDirectiveMessage, owner: ThemeExportDirectiveOwner, deps: ExportDirectiveRunnerDeps): Promise<Result> {
  const directiveId = String(message?.payload?.directive_id)
  try {
    const check = ownerCheck(message, owner, deps.displayed)
    if (!check.ok) return answer(directiveId, 'failed', 'not_owner')
    const format = message.payload?.format
    if (format !== 'pdf' && format !== 'pptx') return answer(directiveId, 'failed', 'export_failed')
    const state = deps.exportState()
    if (!chatExportAllowed(state) || !state.presentationUrl) return answer(directiveId, 'failed', 'export_blocked')
    // The same calls as handleDownloadPDF / handleDownloadPPTX, with the same slide-count fallback.
    const result = format === 'pdf'
      ? await deps.downloadPDF(state.presentationUrl, CHAT_EXPORT_QUALITY)
      : await deps.downloadPPTX(state.presentationUrl, state.slideCount && state.slideCount > 0 ? state.slideCount : 1, CHAT_EXPORT_QUALITY)
    // `done` = the browser download was started (contract §4); a download the browser then blocks cannot be seen from here.
    return result?.success === true ? answer(directiveId, 'done') : answer(directiveId, 'failed', 'export_failed')
  } catch {
    return answer(directiveId, 'failed', 'export_failed')
  }
}
