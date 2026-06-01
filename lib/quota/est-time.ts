/**
 * DST-correct US-Eastern period boundaries, with zero npm dependencies.
 *
 * Quota windows reset on the Eastern-time wall clock:
 *   - daily   -> 00:00 ET each day
 *   - weekly  -> Saturday 24:00 ET (i.e. Sunday 00:00 ET)
 *   - monthly -> the 1st at 00:00 ET
 *
 * All helpers return a UTC `Date` representing the instant of an Eastern wall
 * clock so they can be fed straight into Prisma `createdAt: { gte }` filters.
 */

const TIME_ZONE = "America/New_York"

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

interface EastParts {
  year: number
  month: number // 1-12
  day: number
  hour: number
  minute: number
  second: number
  weekday: number // 0 = Sun .. 6 = Sat
}

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
})

/** Decompose an instant into its Eastern wall-clock parts. */
function getEastParts(date: Date): EastParts {
  const map: Record<string, string> = {}
  for (const p of partsFormatter.formatToParts(date)) {
    if (p.type !== "literal") map[p.type] = p.value
  }
  let hour = parseInt(map.hour, 10)
  if (hour === 24) hour = 0 // some engines emit "24" for midnight
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: WEEKDAY_INDEX[map.weekday] ?? 0,
  }
}

/**
 * Offset in ms such that (eastern-wall-clock-as-if-UTC) - (real UTC) = offset.
 * EST is -5h, EDT is -4h.
 */
function easternOffsetMs(date: Date): number {
  const p = getEastParts(date)
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
  return asUtc - date.getTime()
}

/** UTC instant whose Eastern wall clock is the given Y/M/D 00:00:00. */
function easternMidnightToUtc(year: number, month1to12: number, day: number): Date {
  const naiveUtc = Date.UTC(year, month1to12 - 1, day, 0, 0, 0)
  // Offset depends on the instant; resolve in two passes to settle DST edges.
  let offset = easternOffsetMs(new Date(naiveUtc))
  let utc = naiveUtc - offset
  offset = easternOffsetMs(new Date(utc))
  utc = naiveUtc - offset
  return new Date(utc)
}

/** Start of the Eastern calendar day containing `now`. */
export function startOfDayEastUtc(now: Date = new Date()): Date {
  const p = getEastParts(now)
  return easternMidnightToUtc(p.year, p.month, p.day)
}

/** Start of the next Eastern calendar day after `now` (daily reset instant). */
export function nextDayResetEastUtc(now: Date = new Date()): Date {
  const p = getEastParts(now)
  // Use UTC calendar math purely to roll the date over month/year boundaries.
  const rolled = new Date(Date.UTC(p.year, p.month - 1, p.day + 1))
  return easternMidnightToUtc(
    rolled.getUTCFullYear(),
    rolled.getUTCMonth() + 1,
    rolled.getUTCDate(),
  )
}

/**
 * Start of the current quota week = most recent Sunday 00:00 ET.
 * (The weekly reset is Saturday 24:00 ET, which is Sunday 00:00 ET.)
 */
export function startOfWeekEastUtc(now: Date = new Date()): Date {
  const p = getEastParts(now)
  const sunday = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday))
  return easternMidnightToUtc(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate(),
  )
}

/** Next weekly reset = upcoming Sunday 00:00 ET. */
export function nextWeekResetEastUtc(now: Date = new Date()): Date {
  const p = getEastParts(now)
  const nextSunday = new Date(Date.UTC(p.year, p.month - 1, p.day - p.weekday + 7))
  return easternMidnightToUtc(
    nextSunday.getUTCFullYear(),
    nextSunday.getUTCMonth() + 1,
    nextSunday.getUTCDate(),
  )
}

/** Start of the current Eastern calendar month (monthly reset / $ expiry). */
export function startOfMonthEastUtc(now: Date = new Date()): Date {
  const p = getEastParts(now)
  return easternMidnightToUtc(p.year, p.month, 1)
}
