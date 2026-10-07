import { timingSafeEqual } from 'node:crypto'

/**
 * Session API hardening (server only).
 *
 * One runtime flag, SESSION_API_HARDENING_ENABLED, default OFF (exact string
 * 'true' enables). It is read at call time, never at import time, so it can be
 * flipped by an environment change without a code change. With the flag off
 * every route that uses these helpers behaves exactly as it did before.
 *
 * With the flag on:
 *   - GET /api/admin/cleanup-sessions requires the same `Authorization: Bearer
 *     <CRON_SECRET>` header the deleting POST already requires (Vercel cron sends
 *     that header on its GET when CRON_SECRET is set in the project).
 *   - POST /api/sessions answers 409 for an id owned by someone else without the
 *     row; the row is only echoed back to its owner.
 *   - PATCH /api/sessions/[id] updates only the fields in SESSION_PATCH_ALLOWED_FIELDS.
 */

export function isSessionApiHardeningEnabled(): boolean {
  return process.env.SESSION_API_HARDENING_ENABLED === 'true'
}

/**
 * Columns of ChatSession a client may change through PATCH /api/sessions/[id].
 *
 * Every field the frontend sends today (hooks/use-session-persistence.ts
 * updateMetadata, app/builder/page.tsx, hooks/use-builder-session.ts):
 *   title, currentStage, slideCount, lastMessageAt,
 *   blankPresentationUrl / blankPresentationId,
 *   strawmanPreviewUrl / strawmanPresentationId,
 *   finalPresentationUrl / finalPresentationId.
 * (`stateCache` is handled separately by the route, as a scoped nested upsert.)
 *
 * `status` and `isFavorite` are not sent by any caller in this repo but are part
 * of the route's documented contract and only touch the owner's own row, so they
 * stay writable.
 *
 * Deliberately NOT writable: id, userId, createdAt, updatedAt, firstMessageAt,
 * geminiStoreName, geminiStoreId, and the relation fields (user, messages,
 * stateCache, uploadedFiles, publishedDeck) that Prisma accepts as nested writes.
 */
export const SESSION_PATCH_ALLOWED_FIELDS = [
  'title',
  'currentStage',
  'blankPresentationUrl',
  'strawmanPreviewUrl',
  'finalPresentationUrl',
  'blankPresentationId',
  'strawmanPresentationId',
  'finalPresentationId',
  'slideCount',
  'lastMessageAt',
  'status',
  'isFavorite',
] as const

/** Copy only the allow-listed own properties of `updates`, values untouched. */
export function pickAllowedSessionUpdates(
  updates: Record<string, unknown>
): Record<string, unknown> {
  const picked: Record<string, unknown> = {}
  for (const key of SESSION_PATCH_ALLOWED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      picked[key] = updates[key]
    }
  }
  return picked
}

export type CronBearerResult = 'ok' | 'unauthorized' | 'misconfigured'

/**
 * Same rule as the cleanup POST: no CRON_SECRET configured is a server
 * misconfiguration (never "open"); otherwise the header must be exactly
 * `Bearer <CRON_SECRET>`. Compared in constant time.
 */
export function checkCronBearer(
  authHeader: string | null,
  expectedSecret: string | undefined
): CronBearerResult {
  if (!expectedSecret) return 'misconfigured'
  if (typeof authHeader !== 'string') return 'unauthorized'
  const expected = Buffer.from(`Bearer ${expectedSecret}`)
  const received = Buffer.from(authHeader)
  if (expected.length !== received.length) return 'unauthorized'
  return timingSafeEqual(expected, received) ? 'ok' : 'unauthorized'
}
