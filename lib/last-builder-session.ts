/** Per-account localStorage key for the most recently opened Builder deck. */
export function lastBuilderSessionKey(userId: string): string {
  return `deckster:last_session_id:${userId}`
}

/** Per-account sessionStorage key for a Builder deck that is not in Prisma yet. */
export function unsavedBuilderSessionKey(userId: string, sessionId: string): string {
  return `deckster_unsaved_v2_${encodeURIComponent(userId)}_${sessionId}`
}
