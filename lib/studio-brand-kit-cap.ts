// BRAND-KIT-CALLER (FRONTEND-1, Brand Kit, Studio caller half; BK-Q6, BK-C9): the per-person daily cap on the paid extraction, counted in the existing fe_api_rate_events table (no new table). Server-only: it reaches the database, so only
// the extract route imports it (the theme proxies' signing lives in lib/studio-brand-kit-server.ts and reaches no database).

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
 * One more extraction for this person today? Counts today's attempts (UTC day) in fe_api_rate_events, then records this one BEFORE the paid call goes out: a 422, 502 or 504 may still have reached the model, so every attempt counts.
 * Fails CLOSED: when the count cannot be read the call is not made (a paid call that cannot be counted is not made).
 */
export async function takeBrandExtractSlot(userId: string, now: Date = new Date()): Promise<'ok' | 'cap' | 'unavailable'> {
  try {
    const used = await countRateEvents({ bucket: BRAND_EXTRACT_CAP_BUCKET, subject: userId, since: startOfUtcDay(now) })
    if (used >= brandExtractDailyCap()) return 'cap'
    await recordRateEvent(BRAND_EXTRACT_CAP_BUCKET, 'user', userId)
    return 'ok'
  } catch {
    return 'unavailable'
  }
}
