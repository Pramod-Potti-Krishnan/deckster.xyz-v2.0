// Build Narration control helpers.
//
// IMPORT-FREE BY DESIGN: scripts/test-build-narration.mjs transpiles this file
// into a bare VM. Keep these helpers deterministic and browser/Node compatible.

export type BuildControlActionName = 'pause' | 'resume' | 'stop'

export type BuildControlRequestState =
  | 'running'
  | 'pause_requested'
  | 'paused'
  | 'resume_requested'
  | 'stop_requested'
  | 'stopped'

export const RETIRED_CONTROL_REQUEST_ID_CAP = 32

export interface BuildControlTransportSnapshot {
  sessionId: string | null | undefined
  userId: string | null | undefined
  controlToken: string | null | undefined
  socket: unknown
}

export function isCurrentBuildControlTransportSnapshot(
  request: BuildControlTransportSnapshot,
  current: BuildControlTransportSnapshot,
): boolean {
  return request.sessionId === current.sessionId &&
    request.userId === current.userId &&
    request.controlToken === current.controlToken &&
    request.socket === current.socket
}

export function expectedBuildControlAckPhase(action: BuildControlActionName): string {
  if (action === 'pause') return 'paused'
  if (action === 'stop') return 'stopped'
  return 'building'
}

export function isMatchingBuildControlBuild(
  requestedBuildId: string | null | undefined,
  ackBuildId: string | null | undefined,
): boolean {
  return !requestedBuildId || ackBuildId === requestedBuildId
}

export function isMatchingBuildControlAck(
  action: BuildControlActionName,
  requestedBuildId: string | null | undefined,
  ackPhase: string | null | undefined,
  ackBuildId: string | null | undefined,
  requestedRequestId?: string | null,
  ackRequestId?: string | null,
): boolean {
  if (ackPhase !== expectedBuildControlAckPhase(action)) return false
  // A request tied to a known build can only be acknowledged by that build.
  // If the request predates typed build identity, phase matching is the best
  // backward-compatible signal available.
  if (!isMatchingBuildControlBuild(requestedBuildId, ackBuildId)) return false
  // A missing key is the round-2/legacy Director shape and remains compatible.
  // Once the Director emits the key, however, null and mismatches are not an
  // acknowledgement of this request.
  if (requestedRequestId && ackRequestId !== undefined && ackRequestId !== requestedRequestId) return false
  return true
}

export function retireBuildControlRequestId(
  retired: string[],
  requestId: string | null | undefined,
  cap: number = RETIRED_CONTROL_REQUEST_ID_CAP,
): string[] {
  if (!requestId) return retired
  const next = retired.filter((value) => value !== requestId)
  next.push(requestId)
  return next.slice(-Math.max(1, cap))
}

export function isRetiredBuildControlRequestId(
  retired: string[],
  requestId: string | null | undefined,
): boolean {
  return Boolean(requestId && retired.includes(requestId))
}

export function shouldIgnoreBuildControlPhaseCorrelation(
  retired: string[],
  pendingRequestId: string | null | undefined,
  hasRequestId: boolean,
  ackRequestId: unknown,
): boolean {
  if (!hasRequestId) return false
  // Pydantic's ordinary build_phase frames currently serialize the optional
  // field as null. Null is not an acknowledgement, but the phase itself still
  // carries state and must not be discarded.
  if (typeof ackRequestId !== 'string' || ackRequestId.length === 0) return false
  if (isRetiredBuildControlRequestId(retired, ackRequestId)) return true
  return Boolean(pendingRequestId && ackRequestId !== pendingRequestId)
}

export function scrubBuildControlCapabilityMessages<T extends { type?: string }>(
  messages: T[] | null | undefined,
): T[] {
  if (!Array.isArray(messages)) return []
  return messages.filter((message) => message?.type !== 'build_control_capability')
}

export function isBuildControlRequestPending(control: BuildControlRequestState): boolean {
  return control === 'pause_requested' || control === 'resume_requested' || control === 'stop_requested'
}

export function shouldRetirePendingControl(
  pendingBuildId: string | null | undefined,
  currentBuildId: string | null | undefined,
  retiredBuildIds: string[],
  incomingBuildId: string | null | undefined,
): boolean {
  if (!incomingBuildId) return false
  const ownedBuildId = pendingBuildId ?? currentBuildId
  if (!ownedBuildId || ownedBuildId === incomingBuildId) return false
  // A delayed frame from an already-retired build is ignored by the reducer;
  // it must not cancel the current build's pending timer.
  if (retiredBuildIds.includes(incomingBuildId)) return false
  return true
}

export function createBuildControlRequestId(
  randomUuid?: (() => string) | null,
  now: number = Date.now(),
  random: number = Math.random(),
): string {
  if (typeof randomUuid === 'function') {
    try {
      const value = randomUuid()
      if (value) return value
    } catch {
      // Older/insecure browser contexts can expose crypto without randomUUID.
    }
  }
  return `bctl_${now.toString(36)}_${Math.floor(random * Number.MAX_SAFE_INTEGER).toString(36)}`
}

export function buildControlEndpointFromWsUrl(wsUrl: string): string | null {
  try {
    const url = new URL(wsUrl)
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') return null
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = url.pathname.replace(/\/ws\/?$/, '')
    url.search = ''
    url.hash = ''
    return `${url.toString().replace(/\/$/, '')}/api/v1/build-control`
  } catch {
    return null
  }
}
