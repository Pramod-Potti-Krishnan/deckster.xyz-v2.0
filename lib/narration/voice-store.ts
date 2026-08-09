/**
 * Reading and writing a deck's narration voice.
 *
 * Deliberately raw SQL rather than a Prisma model field, and that choice is the
 * whole safety story for this change.
 *
 * `chat_sessions.narration_voice_id` is added by
 * `prisma/sql/20260810_narration_voice.sql`, which a human applies to Supabase
 * by hand — we never run `prisma migrate` against that database. If the column
 * were declared on the Prisma model, the generated client would name it in the
 * SELECT of every `chatSession.findUnique` in the app, and deploying before the
 * migration ran would 500 every session read. That is not a narration outage,
 * it is the whole builder down.
 *
 * So: no generated query ever references the column, both paths catch the
 * "column does not exist" case, and the feature degrades to "no voice stored,
 * use the default" until the migration lands. Applying the SQL then switches
 * persistence on with no redeploy and no coordination.
 */

import { prisma } from '@/lib/prisma'
import { DEFAULT_VOICE_ID, isKnownVoiceId } from './voices'

/** Postgres 42703 — undefined_column. The one error that means "not migrated
 *  yet" rather than "something is wrong". */
function isMissingColumn(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return (
    message.includes('42703') ||
    (message.includes('narration_voice_id') && message.toLowerCase().includes('does not exist'))
  )
}

/**
 * The stored voice id, or null if the owner has never chosen one.
 *
 * Null and DEFAULT_VOICE_ID are kept distinct on purpose: "never chose" and
 * "chose the default" want different UI, and collapsing them would make the
 * picker unable to prompt a first-time publisher.
 */
export async function getSessionVoiceId(
  sessionId: string,
  userId: string
): Promise<{ voiceId: string | null; persisted: boolean }> {
  try {
    const rows = await prisma.$queryRaw<{ narration_voice_id: string | null }[]>`
      SELECT narration_voice_id
        FROM chat_sessions
       WHERE id = ${sessionId} AND user_id = ${userId}
       LIMIT 1
    `
    if (rows.length === 0) return { voiceId: null, persisted: true }
    const stored = rows[0].narration_voice_id
    // An id we no longer ship — a voice retired because its vendor was dropped
    // — reads as "not chosen" rather than erroring. The publisher gets the
    // default and can pick again.
    return { voiceId: isKnownVoiceId(stored) ? stored : null, persisted: true }
  } catch (error) {
    if (isMissingColumn(error)) return { voiceId: null, persisted: false }
    throw error
  }
}

/**
 * Store the choice. Returns false when the column does not exist yet, so the
 * caller can tell the publisher their pick will not survive a reload rather
 * than silently pretending it saved.
 */
export async function setSessionVoiceId(
  sessionId: string,
  userId: string,
  voiceId: string
): Promise<{ persisted: boolean; found: boolean }> {
  const id = isKnownVoiceId(voiceId) ? voiceId : DEFAULT_VOICE_ID
  try {
    // Scoped by user_id as well as id: this is the authorisation check, not
    // just a filter. A caller who guesses a session id must not be able to
    // write to it.
    const count = await prisma.$executeRaw`
      UPDATE chat_sessions
         SET narration_voice_id = ${id}
       WHERE id = ${sessionId} AND user_id = ${userId}
    `
    return { persisted: true, found: count > 0 }
  } catch (error) {
    if (isMissingColumn(error)) return { persisted: false, found: true }
    throw error
  }
}
