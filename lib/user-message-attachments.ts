export interface UserMessageAttachment {
  id: string
  name: string
  size: number
  type: string
}

export interface UserChatMessage {
  id: string
  text: string
  timestamp: number
  attachments?: UserMessageAttachment[]
}

interface UploadAttachmentCandidate {
  id?: unknown
  name?: unknown
  size?: unknown
  type?: unknown
  status?: unknown
}

function normalizeAttachment(value: unknown): UserMessageAttachment | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as UploadAttachmentCandidate
  if (typeof candidate.id !== 'string' || !candidate.id) return null
  if (typeof candidate.name !== 'string' || !candidate.name) return null

  return {
    id: candidate.id,
    name: candidate.name,
    size: typeof candidate.size === 'number' && Number.isFinite(candidate.size)
      ? Math.max(0, candidate.size)
      : 0,
    type: typeof candidate.type === 'string' && candidate.type
      ? candidate.type
      : 'application/octet-stream',
  }
}

/**
 * Freeze the send-eligible composer uploads onto the sent chat message.
 *
 * Only display metadata is retained. Storage paths and provider identifiers
 * deliberately stay out of the transcript.
 */
export function snapshotAttachedUploads(
  files: UploadAttachmentCandidate[],
): UserMessageAttachment[] {
  return files
    .filter(file => (
      file.status === 'processing'
      || file.status === 'success'
      || file.status === 'degraded'
    ))
    .map(normalizeAttachment)
    .filter((attachment): attachment is UserMessageAttachment => attachment !== null)
}

/** Recover persisted attachments defensively across old and malformed rows. */
export function attachmentsFromPayload(payload: unknown): UserMessageAttachment[] {
  if (!payload || typeof payload !== 'object') return []
  const attachments = (payload as { attachments?: unknown }).attachments
  if (!Array.isArray(attachments)) return []

  return attachments
    .map(normalizeAttachment)
    .filter((attachment): attachment is UserMessageAttachment => attachment !== null)
}
