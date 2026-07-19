export const DIRECTOR_HEARTBEAT_INTERVAL_MS = 15_000
export const DIRECTOR_PONG_TIMEOUT_MS = 10_000

export type DirectorReconnectPlan =
  | { kind: 'skip'; reason: 'disabled' | 'manual' | 'not_desired' | 'exhausted' }
  | { kind: 'pause'; reason: 'offline' }
  | { kind: 'schedule'; attempt: number; delayMs: number }

export interface ResolveDirectorReconnectPlanOptions {
  reconnectEnabled: boolean
  manualDisconnect: boolean
  connectionDesired: boolean
  online: boolean
  attempts: number
  maxAttempts: number
  baseDelayMs: number
}

/**
 * Keep retry accounting deterministic and independent from browser events.
 * `attempts` counts reconnects that actually started, never timers that were
 * cancelled because the browser went offline.
 */
export function resolveDirectorReconnectPlan({
  reconnectEnabled,
  manualDisconnect,
  connectionDesired,
  online,
  attempts,
  maxAttempts,
  baseDelayMs,
}: ResolveDirectorReconnectPlanOptions): DirectorReconnectPlan {
  if (!reconnectEnabled) return { kind: 'skip', reason: 'disabled' }
  if (manualDisconnect) return { kind: 'skip', reason: 'manual' }
  if (!connectionDesired) return { kind: 'skip', reason: 'not_desired' }
  if (!online) return { kind: 'pause', reason: 'offline' }
  if (attempts >= maxAttempts) return { kind: 'skip', reason: 'exhausted' }

  const attempt = attempts + 1
  const safeBaseDelay = Math.max(0, baseDelayMs)
  return {
    kind: 'schedule',
    attempt,
    delayMs: safeBaseDelay * Math.pow(2, attempt - 1),
  }
}

export interface ShouldReconnectDirectorOnOnlineOptions {
  reconnectEnabled: boolean
  manualDisconnect: boolean
  connectionDesired: boolean
  resumingFromOffline: boolean
  socketReadyState: number | null
}

/**
 * A socket that crossed a confirmed browser-offline boundary is stale even if
 * the browser still reports CONNECTING/OPEN. Outside that transition,
 * CONNECTING (0) and OPEN (1) are already live attempts and must not be
 * duplicated.
 */
export function shouldReconnectDirectorOnOnline({
  reconnectEnabled,
  manualDisconnect,
  connectionDesired,
  resumingFromOffline,
  socketReadyState,
}: ShouldReconnectDirectorOnOnlineOptions): boolean {
  if (!reconnectEnabled || manualDisconnect || !connectionDesired) return false
  if (resumingFromOffline) return true
  return socketReadyState !== 0 && socketReadyState !== 1
}
