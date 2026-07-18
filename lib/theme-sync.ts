export type ThemeSyncStatus = 'idle' | 'syncing' | 'applied' | 'failed'

export interface ThemeSyncState {
  status: ThemeSyncStatus
  requestId: string | null
  presentationId: string | null
  themeFingerprint: string | null
  error: string | null
}

export type ThemeReadinessFailureCode =
  | 'disconnected'
  | 'failed'
  | 'timeout'
  | 'presentation_changed'
  | 'request_superseded'

export type ThemeSyncRequestResult =
  | { ok: true; requestId: string; themeFingerprint: string | null }
  | { ok: false; code: 'disconnected' | 'failed' | 'presentation_changed'; error: string }

export type ThemeReadinessResult =
  | { ready: true; sync: ThemeSyncState }
  | { ready: false; code: ThemeReadinessFailureCode; error: string }

interface WaitForAuthoritativeThemeOptions {
  presentationId: string
  themeFingerprint?: string | null
  getSyncState: () => ThemeSyncState
  isConnected: () => boolean
  requestSync: (presentationId: string) => ThemeSyncRequestResult
  timeoutMs?: number
  pollIntervalMs?: number
  now?: () => number
  delay?: (milliseconds: number) => Promise<void>
}

export const IDLE_THEME_SYNC: ThemeSyncState = {
  status: 'idle',
  requestId: null,
  presentationId: null,
  themeFingerprint: null,
  error: null,
}

export function syncingTheme(
  requestId: string,
  presentationId: string,
  themeFingerprint: string | null = null,
): ThemeSyncState {
  return { status: 'syncing', requestId, presentationId, themeFingerprint, error: null }
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
  if (
    (current.status === 'applied' || current.status === 'failed') &&
    payload.status === 'syncing'
  ) {
    return current
  }
  return {
    status: payload.status,
    requestId: payload.request_id,
    presentationId: payload.presentation_id ?? current.presentationId,
    themeFingerprint: current.themeFingerprint,
    error: payload.status === 'failed'
      ? payload.error || 'Director could not apply this theme.'
      : null,
  }
}

export function isThemeAppliedToPresentation(
  sync: ThemeSyncState,
  presentationId: string | null | undefined,
  themeFingerprint?: string | null,
): boolean {
  return Boolean(
    presentationId &&
    sync.status === 'applied' &&
    sync.presentationId === presentationId &&
    (
      themeFingerprint === undefined ||
      sync.themeFingerprint === themeFingerprint
    ),
  )
}

/**
 * Theme authority is semantic, not transport-scoped. Director may acknowledge
 * the same presentation + selection under a replacement request ID after a
 * reconnect; that must not invalidate an element already using that theme.
 */
export function isSameAppliedThemeAuthority(
  expected: ThemeSyncState,
  current: ThemeSyncState,
): boolean {
  if (
    expected.status !== 'applied' ||
    current.status !== 'applied' ||
    expected.presentationId !== current.presentationId
  ) {
    return false
  }
  if (expected.themeFingerprint && current.themeFingerprint) {
    return expected.themeFingerprint === current.themeFingerprint
  }
  return expected.requestId === current.requestId
}

export function isThemeSyncTerminal(status: ThemeSyncStatus): boolean {
  return status === 'applied' || status === 'failed'
}

const wait = (milliseconds: number) => new Promise<void>(resolve => {
  setTimeout(resolve, milliseconds)
})

/**
 * Resolve the exact deck-theme acknowledgement required by one element
 * generation. Existing matching requests are shared; idle, failed, and stale
 * state starts one fresh request. Once waiting begins, both the presentation
 * and request IDs remain authoritative so a deck/theme transition can never
 * release generation with the wrong theme.
 */
export async function waitForAuthoritativeTheme({
  presentationId,
  themeFingerprint,
  getSyncState,
  isConnected,
  requestSync,
  timeoutMs = 20_000,
  pollIntervalMs = 50,
  now = Date.now,
  delay = wait,
}: WaitForAuthoritativeThemeOptions): Promise<ThemeReadinessResult> {
  const initial = getSyncState()
  if (
    isThemeAppliedToPresentation(initial, presentationId, themeFingerprint) &&
    initial.requestId
  ) {
    return { ready: true, sync: initial }
  }

  if (!isConnected()) {
    return {
      ready: false,
      code: 'disconnected',
      error: 'Director is disconnected. Reconnect, then generate this element again.',
    }
  }

  let expectedRequestId: string
  if (
    initial.status === 'syncing' &&
    initial.presentationId === presentationId &&
    initial.requestId &&
    (
      themeFingerprint === undefined ||
      initial.themeFingerprint === themeFingerprint
    )
  ) {
    expectedRequestId = initial.requestId
  } else {
    const requested = requestSync(presentationId)
    if (!requested.ok) return { ready: false, code: requested.code, error: requested.error }
    expectedRequestId = requested.requestId
    themeFingerprint = requested.themeFingerprint ?? themeFingerprint
  }

  const startedAt = now()
  while (true) {
    const current = getSyncState()
    if (
      (
        themeFingerprint !== undefined
          ? isThemeAppliedToPresentation(current, presentationId, themeFingerprint)
          : (
              current.requestId === expectedRequestId &&
              isThemeAppliedToPresentation(current, presentationId)
            )
      ) &&
      current.requestId
    ) {
      return { ready: true, sync: current }
    }
    if (!isConnected()) {
      return {
        ready: false,
        code: 'disconnected',
        error: 'Director disconnected while applying the deck theme. Reconnect, then generate this element again.',
      }
    }
    if (current.requestId !== expectedRequestId) {
      if (current.presentationId !== presentationId) {
        return {
          ready: false,
          code: 'presentation_changed',
          error: 'The active presentation changed while its deck theme was being prepared. Generate again in the current presentation.',
        }
      }
      return {
        ready: false,
        code: 'request_superseded',
        error: 'The deck theme changed while this element was waiting. Wait for Applied, then generate again.',
      }
    }

    if (current.presentationId !== presentationId) {
      return {
        ready: false,
        code: 'presentation_changed',
        error: 'The active presentation changed while its deck theme was being prepared. Generate again in the current presentation.',
      }
    }

    if (current.status === 'applied') {
      return {
        ready: false,
        code: 'request_superseded',
        error: 'The deck theme changed while this element was waiting. Wait for Applied, then generate again.',
      }
    }
    if (current.status === 'failed') {
      return {
        ready: false,
        code: 'failed',
        error: current.error || 'Director could not apply the selected deck theme. Reapply it, then generate again.',
      }
    }
    if (now() - startedAt >= timeoutMs) {
      return {
        ready: false,
        code: 'timeout',
        error: 'Theme application timed out. Reapply the deck theme or reconnect, then generate again.',
      }
    }

    await delay(Math.max(1, Math.min(pollIntervalMs, timeoutMs)))
  }
}
