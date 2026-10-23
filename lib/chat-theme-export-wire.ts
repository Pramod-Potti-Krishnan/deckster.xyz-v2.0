/**
 * FRONTEND-2 Pass 3: change the theme and export the deck from chat, the WIRE half. Two flags, each on only for the exact value "true",
 * default off, read at build time, each independent of the other (they mirror Director's DIRECTOR_MDC_THEME_CHANGE_ENABLED and
 * DIRECTOR_MDC_EXPORT_ENABLED):
 *   NEXT_PUBLIC_CHAT_THEME_CHANGE  -> client cap `theme1`,  Director's `theme_directive`
 *   NEXT_PUBLIC_CHAT_EXPORT        -> client cap `export1`, Director's `export_directive`
 * What the Director socket hook needs and nothing else, with no imports, so the hook gains no dependency. The runners are in
 * lib/chat-theme-export.ts.
 *
 * Contract: streams/director2/theme-export/CONTRACT.md (Director !513).
 */

export const CHAT_THEME_CHANGE_ENABLED = process.env.NEXT_PUBLIC_CHAT_THEME_CHANGE === 'true'
export const CHAT_EXPORT_ENABLED = process.env.NEXT_PUBLIC_CHAT_EXPORT === 'true'

/** The capabilities Director checks before it sends either directive (contract §2): exact, case-sensitive. */
export const THEME_CLIENT_CAP = 'theme1'
export const EXPORT_CLIENT_CAP = 'export1'
export const THEME_DIRECTIVE_TYPE = 'theme_directive'
export const EXPORT_DIRECTIVE_TYPE = 'export_directive'

/** The caps this build sends after `mdc1` (empty with both flags off, and then nothing is added to a send). */
export const CHAT_THEME_EXPORT_CAPS: readonly string[] = [
  ...(CHAT_THEME_CHANGE_ENABLED ? [THEME_CLIENT_CAP] : []),
  ...(CHAT_EXPORT_ENABLED ? [EXPORT_CLIENT_CAP] : []),
]

/** Which directive frame types this build takes out of band (each only with its own flag on). */
export function chatThemeExportDirectiveKind(type: unknown): 'theme' | 'export' | null {
  if (CHAT_THEME_CHANGE_ENABLED && type === THEME_DIRECTIVE_TYPE) return 'theme'
  if (CHAT_EXPORT_ENABLED && type === EXPORT_DIRECTIVE_TYPE) return 'export'
  return null
}

/** Contract §4: the success word of each kind; any other status reads as failed on Director's side. */
export type ThemeDirectiveStatus = 'applied' | 'failed' | 'dismissed'
export type ExportDirectiveStatus = 'done' | 'failed' | 'dismissed'
/** Contract §4's error codes (logged by Director, never shown). */
export type ThemeExportErrorCode =
  | 'not_owner' | 'theme_locked' | 'theme_failed' | 'export_failed' | 'export_blocked' | 'download_blocked' | 'viewer_unavailable' | 'timeout'

/** Outbound `element_directive_result.data` for a theme or export directive (contract §4). */
export interface ThemeExportResultData {
  directive_id: string
  status: ThemeDirectiveStatus | ExportDirectiveStatus
  error_code: ThemeExportErrorCode | null
}

export interface ThemeDirectiveSelection {
  mode: 'preset' | 'custom'
  preset_id?: string
  primary_hex?: string
}

export interface ThemeDirectiveMessage {
  type: 'theme_directive'
  message_id?: string
  session_id?: string
  timestamp?: string
  payload: { directive_id: string; presentation_id: string; selection: ThemeDirectiveSelection; label?: string }
}

export interface ExportDirectiveMessage {
  type: 'export_directive'
  message_id?: string
  session_id?: string
  timestamp?: string
  payload: { directive_id: string; presentation_id: string; format: 'pdf' | 'pptx' }
}

export type ThemeExportDirectiveMessage = ThemeDirectiveMessage | ExportDirectiveMessage

/** Who delivered a directive: the socket's session, and whether that socket is still the live one (the answer goes back on it). */
export interface ThemeExportDirectiveOwner {
  sessionId: string | null
  isCurrent: () => boolean
}

/** The directive's id when it has a usable one (an answer needs it), else null: such a frame is dropped unanswered. */
export function themeExportDirectiveId(message: unknown): string | null {
  const payload = (message as { payload?: unknown } | null)?.payload as { directive_id?: unknown } | null | undefined
  const id = payload && typeof payload === 'object' ? payload.directive_id : null
  return typeof id === 'string' && id.trim() ? id : null
}
