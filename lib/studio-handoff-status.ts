import type {
  DirectorHandoffRequestIdentity,
  DirectorHandoffRequestOwner,
  DirectorHandoffRequestStatus,
} from '@/hooks/use-deckster-websocket-v2'
import { hasValidPendingHandoffMetadata, type PendingHandoffSubmission } from '@/lib/manual-deck-workflow'

export interface StudioHandoffAccountSession {
  userId: string | null | undefined
  sessionId: string | null | undefined
}

function isCurrentRecord(pending: PendingHandoffSubmission | null, current: StudioHandoffAccountSession): pending is PendingHandoffSubmission {
  return Boolean(pending && hasValidPendingHandoffMetadata(pending)
    && typeof current.userId === 'string' && current.userId.trim()
    && typeof current.sessionId === 'string' && current.sessionId.trim()
    && pending.new_session_id === current.sessionId
    && typeof pending.idempotency_key === 'string' && pending.idempotency_key.trim()
    && (pending.owner_user_id === undefined || pending.owner_user_id === current.userId))
}

/** Pre-connect identity needs a persisted account binding, not just a route/key. */
export function getExpectedStudioHandoffRequest(
  pending: PendingHandoffSubmission | null,
  current: StudioHandoffAccountSession,
): DirectorHandoffRequestIdentity | null {
  if (!isCurrentRecord(pending, current) || typeof pending.owner_user_id !== 'string' || pending.owner_user_id !== current.userId) return null
  return { sessionId: pending.new_session_id, userId: pending.owner_user_id, idempotencyKey: pending.idempotency_key }
}

/** Only unsent staged records are eligible for the existing automatic submission. */
export function canAutomaticallySubmitStudioHandoff(
  pending: PendingHandoffSubmission | null,
  current: StudioHandoffAccountSession,
): boolean {
  return isCurrentRecord(pending, current)
    && (pending.submission_state === undefined || pending.submission_state === 'staged')
    && pending.handoff_status === undefined
}

/** Local send success is not a server acknowledgement; retain the whole request. */
export function markStudioHandoffSubmitted(
  pending: PendingHandoffSubmission | null,
  current: StudioHandoffAccountSession,
  sent: boolean,
): PendingHandoffSubmission | null {
  if (!sent || !canAutomaticallySubmitStudioHandoff(pending, current) || !pending) return pending
  return { ...pending, submission_state: 'submitted' }
}

export interface StudioHandoffStatusResult {
  accepted: boolean
  pending: PendingHandoffSubmission | null
}

/** Exact owned request metadata; none of these statuses proves canvas readiness. */
export function absorbStudioHandoffStatus(
  pending: PendingHandoffSubmission | null,
  current: StudioHandoffAccountSession,
  status: DirectorHandoffRequestStatus,
  owner: DirectorHandoffRequestOwner,
): StudioHandoffStatusResult {
  const rejected = { accepted: false, pending }
  const expected = getExpectedStudioHandoffRequest(pending, current)
  if (!expected || !pending || !status || !owner
    || status.sessionId !== expected.sessionId || status.idempotencyKey !== expected.idempotencyKey
    || owner.sessionId !== expected.sessionId || owner.userId !== expected.userId || owner.idempotencyKey !== expected.idempotencyKey
    || !['processing', 'already_processing', 'already_completed', 'failed'].includes(status.status)
    || (status.error !== undefined && typeof status.error !== 'string')
    || typeof owner.isCurrent !== 'function') return rejected
  try { if (!owner.isCurrent()) return rejected } catch { return rejected }
  const { handoff_error: _previousError, ...retained } = pending
  return {
    accepted: true,
    pending: {
      ...retained,
      submission_state: status.status === 'failed' ? 'failed' : 'acknowledged',
      handoff_status: status.status,
      ...(status.error !== undefined ? { handoff_error: status.error } : {}),
    },
  }
}
