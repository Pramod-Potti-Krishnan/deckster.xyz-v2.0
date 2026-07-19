export const DIRECTOR_HEARTBEAT_INTERVAL_MS = 15_000
export const DIRECTOR_PONG_TIMEOUT_MS = 10_000
export const DIRECTOR_RECONNECT_STABILITY_MS = 30_000

export type DirectorReconnectStatus =
  | 'idle'
  | 'scheduled'
  | 'paused_offline'
  | 'exhausted'
  | 'manual'

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
  reconnectStatus: DirectorReconnectStatus
  socketReadyState: number | null
}

/**
 * Only a connection lifecycle that the hook explicitly paused on a confirmed
 * offline event may resume on `online`. Generic/spurious online events cannot
 * create another retry path or clear durable exhaustion.
 */
export function shouldReconnectDirectorOnOnline({
  reconnectEnabled,
  manualDisconnect,
  connectionDesired,
  resumingFromOffline,
  reconnectStatus,
}: ShouldReconnectDirectorOnOnlineOptions): boolean {
  if (!reconnectEnabled || manualDisconnect || !connectionDesired) return false
  if (reconnectStatus === 'exhausted' || reconnectStatus === 'manual') return false
  if (resumingFromOffline) return true
  return false
}

export interface ShouldRequestBuilderSessionConnectionOptions {
  sessionKey: string | null
  lastRequestedSessionKey: string | null
  loading: boolean
  connected: boolean
  connecting: boolean
  reconnectStatus: DirectorReconnectStatus
}

/**
 * The Builder session layer owns one initial connection request per adopted
 * session. Once that request is handed to the WebSocket hook, transport close,
 * backoff, offline recovery, and exhaustion belong exclusively to that hook.
 */
export function shouldRequestBuilderSessionConnection({
  sessionKey,
  lastRequestedSessionKey,
  loading,
  connected,
  connecting,
  reconnectStatus,
}: ShouldRequestBuilderSessionConnectionOptions): boolean {
  if (!sessionKey || loading) return false
  if (sessionKey === lastRequestedSessionKey) return false
  if (connected || connecting) return false
  return reconnectStatus === 'idle'
}
