// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-Q6, BK-C9): the per-person daily cap on the paid extraction, counted in the existing fe_api_rate_events table (no new table). Server-only: it reaches the database, so only
// the extract route imports it (the theme proxies' signing lives in lib/studio-brand-kit-server.ts and reaches no database).

import { randomUUID } from 'crypto'
import { countRateEvents, recordRateEvent } from '@/lib/api-hardening'
import { BRAND_EXTRACT_CAP_BUCKET, BRAND_EXTRACT_DAILY_CAP } from '@/lib/studio-brand-kit'

/** Today's cap: STUDIO_BRAND_EXTRACT_DAILY_CAP (server, a whole number from 1 to 100) or the default. Anything else is the default. */
export function brandExtractDailyCap(env: Record<string, string | undefined> = process.env): number {
  const raw = env.STUDIO_BRAND_EXTRACT_DAILY_CAP
  if (typeof raw !== 'string' || !/^\d{1,3}$/.test(raw.trim())) return BRAND_EXTRACT_DAILY_CAP
  const value = Number(raw.trim())
  return value >= 1 && value <= 100 ? value : BRAND_EXTRACT_DAILY_CAP
}

const startOfUtcDay = (now: Date): Date => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))

/**
 * One more extraction for this person today? RECORDS this attempt first, then counts today's attempts (UTC day) INCLUDING this one, and only then lets the paid call go: a 422, 502 or 504 may still have reached the model, so every attempt counts.
 * Counting after recording is what bounds a burst: of any number of parallel calls, the one whose row was written last counts every other call's row, so at most `cap` calls pass (count-then-record let every parallel call read the same count).
 * Fails CLOSED on read and on write: recordRateEvent swallows its own error, so the row is looked up again by its own one-off scope, and a row that is not there (the insert failed) is 'unavailable', never a free call (a count that never grows is no cap).
 * An attempt over the cap leaves its row too (the count stays over for the rest of the UTC day, which is when it is meant to be over).
 */
export async function takeBrandExtractSlot(userId: string, now: Date = new Date()): Promise<'ok' | 'cap' | 'unavailable'> {
  try {
    const attempt = randomUUID()
    await recordRateEvent(BRAND_EXTRACT_CAP_BUCKET, attempt, userId)
    // this attempt's own row: its scope is a one-off, so no day bound is needed (and a clock a little behind the database's cannot lose it at midnight)
    const own = await countRateEvents({ bucket: BRAND_EXTRACT_CAP_BUCKET, scope: attempt, subject: userId, since: new Date(0) })
    if (own < 1) return 'unavailable'
    const used = await countRateEvents({ bucket: BRAND_EXTRACT_CAP_BUCKET, subject: userId, since: startOfUtcDay(now) })
    return used > brandExtractDailyCap() ? 'cap' : 'ok'
  } catch {
    return 'unavailable'
  }
}
