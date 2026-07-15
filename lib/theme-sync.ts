export type ThemeSyncStatus = 'idle' | 'syncing' | 'applied' | 'failed'

export interface ThemeSyncState {
  status: ThemeSyncStatus
  requestId: string | null
  presentationId: string | null
  error: string | null
}

export const IDLE_THEME_SYNC: ThemeSyncState = {
  status: 'idle',
  requestId: null,
  presentationId: null,
  error: null,
}

export function syncingTheme(requestId: string, presentationId: string): ThemeSyncState {
  return { status: 'syncing', requestId, presentationId, error: null }
}

export function applyThemeSyncResponse(
  current: ThemeSyncState,
  payload: {
    request_id: string
    status: 'syncing' | 'applied' | 'failed'
    presentation_id?: string | null
    error?: string | null
  },
): ThemeSyncState {
  if (payload.request_id !== current.requestId) return current
  return {
    status: payload.status,
    requestId: payload.request_id,
    presentationId: payload.presentation_id ?? current.presentationId,
    error: payload.status === 'failed'
      ? payload.error || 'Director could not apply this theme.'
      : null,
  }
}

export function isThemeAppliedToPresentation(
  sync: ThemeSyncState,
  presentationId: string | null | undefined,
): boolean {
  return Boolean(
    presentationId &&
    sync.status === 'applied' &&
    sync.presentationId === presentationId,
  )
}

export function isThemeSyncTerminal(status: ThemeSyncStatus): boolean {
  return status === 'applied' || status === 'failed'
}
