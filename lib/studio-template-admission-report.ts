// Template "What changed" admission report, Studio half (FRONTEND, 16 Oct 2026). Flag NEXT_PUBLIC_STUDIO_TEMPLATE_ADMISSION_REPORT (build-time, exact "true", default off).
//
// An uploaded deck is changed a little on its way to a template (a dashed outline drawn solid, text that cannot be kept left out, a slide rebuilt over one
// picture). Composer writes what it did in plain words (COMPOSER_UPLOAD_ADMISSION_REPORT_ENABLED, composer MR !99) and Director (DIRECTOR_TEMPLATE_ADMISSION_REPORT_ENABLED,
// director MR !502) validates it, stores it with the template and serves it (streams/composer/ADMISSION-REPORT-CONTRACT.md section 2):
//
//   - GET /api/template-ingest/stage/jobs/{job_id}   -> `admission_report`: the whole report (with `slides`), or null until Composer has sent one. With Director's flag
//     off the key is absent. It arrives with the early as-is template, before locking ends;
//   - GET /api/template-ingest/stage/templates       -> each row's `admission_report` WITHOUT `slides`; a row with no stored report has no key.
//
// With the flag on, the Template library draws the report under the template's row: the headline, the changes in rank order (the four that need a look,
// text left out / slide floor / left out / kept as a picture, are emphasised), "and N more small changes", and, when the report has `slides` (the job read), a
// slide-by-slide strip. No report (absent, null, or anything that does not read as one) shows nothing.
//
// This module is pure and has no imports (no React, no network, no environment): scripts/test-studio-template-admission-report.mjs runs it on the answers of
// Director's own routes (scripts/fixtures/template-admission-report/). Its rules:
//   - `text` and `headline` are shown as they are, never rebuilt from `key` or `kind` (the contract: `key` is for analytics and tests). They are plain
//     sentences: letters, digits, spaces and , . ; : ( ) ' % / + & - only, at most 240 characters. One that is not (or any other malformed piece of the
//     changes) drops the whole report, as Director drops a report that does not validate;
//   - `version` must be composer-admission-report-v1: another version shows nothing;
//   - an outcome this list does not know (a later Composer) is shown plainly and not emphasised;
//   - the slide strip is secondary: rows that do not read as slide rows leave the strip out and keep the report.

export const ADMISSION_REPORT_VERSION = 'composer-admission-report-v1'

/** The closed list of the contract (section 1.1), most serious first; its index + 1 is the rank. */
export const ADMISSION_OUTCOMES = ['text_left_out', 'floor', 'dropped', 'picture', 'check', 'rebuilt', 'simplified', 'text_split'] as const
export type AdmissionOutcome = typeof ADMISSION_OUTCOMES[number]
/** The ones the card emphasises (contract section 3). */
export const ADMISSION_EMPHASISED: readonly AdmissionOutcome[] = ['text_left_out', 'floor', 'dropped', 'picture']

/** Director's limits (src/services/composer_admission_report.py): the report is read inside the same bounds. */
const MAX_TEXT = 240
const MAX_CHANGES = 40
const MAX_CHANGE_SLIDES = 12
const MAX_SLIDE_NUMBER = 500
const MAX_SLIDE_ROWS = 500
const SENTENCE = /^[A-Za-z0-9 ,.;:()'%/+&-]{1,240}$/

/** At most this many slides get a chip in the strip; a deck longer than STRIP_ALL shows only the slides with something to say. */
export const STRIP_ALL = 60
export const STRIP_MAX = 120

export type AdmissionOutcomeOrOther = AdmissionOutcome | 'other'

export interface AdmissionChange {
  outcome: AdmissionOutcomeOrOther
  rank: number
  text: string
  slides: number[]
  count: number
}
export interface AdmissionSlide {
  slide: number
  elements: number
  editable: number
  picture: number
  dropped: number
  changed: number
  textListed: number
  floor: boolean
  changes: number
}
export interface AdmissionReport {
  headline: string
  changes: AdmissionChange[]
  changesMore: number
  /** Every slide row the report carries (the job read), or null (the library list leaves them out; a row that does not read as one drops them all). */
  slides: AdmissionSlide[] | null
  /** `totals.slides`: the slides of the deck (the rows above may leave out quiet slides on a very large deck), or null. */
  slideCount: number | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value)
const whole = (value: unknown, low: number, high: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= low && value <= high
const sentence = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_TEXT && SENTENCE.test(value)
const outcomeOf = (value: unknown): AdmissionOutcomeOrOther => (ADMISSION_OUTCOMES as readonly unknown[]).includes(value) ? value as AdmissionOutcome : 'other'

function parseChange(value: unknown): AdmissionChange | null {
  if (!isRecord(value) || !sentence(value.text)) return null
  const outcome = outcomeOf(value.outcome)
  const rank = whole(value.rank, 1, 8) ? value.rank : outcome === 'other' ? 9 : ADMISSION_OUTCOMES.indexOf(outcome) + 1
  const slides = value.slides
  if (!Array.isArray(slides) || slides.length > MAX_CHANGE_SLIDES || !slides.every(number => whole(number, 1, MAX_SLIDE_NUMBER))) return null
  if (!whole(value.count, 0, 1e9)) return null
  return { outcome, rank, text: value.text, slides: [...slides], count: value.count }
}

function parseSlide(value: unknown): AdmissionSlide | null {
  if (!isRecord(value) || !whole(value.slide, 1, MAX_SLIDE_NUMBER) || typeof value.floor !== 'boolean') return null
  const counts = ['elements', 'editable', 'picture', 'dropped', 'changed', 'text_listed', 'changes']
  if (!counts.every(name => whole(value[name], 0, 1e9))) return null
  return {
    slide: value.slide, elements: value.elements as number, editable: value.editable as number, picture: value.picture as number, dropped: value.dropped as number,
    changed: value.changed as number, textListed: value.text_listed as number, floor: value.floor, changes: value.changes as number,
  }
}

/** The report as a new, checked object, or null (nothing to show). `raw` is whatever Director sent: absent, null, an object, or garbage. */
export function parseAdmissionReport(raw: unknown): AdmissionReport | null {
  if (!isRecord(raw) || raw.version !== ADMISSION_REPORT_VERSION || !sentence(raw.headline)) return null
  if (!Array.isArray(raw.changes) || raw.changes.length > MAX_CHANGES || !whole(raw.changes_more, 0, 1e9)) return null
  const changes: AdmissionChange[] = []
  for (const item of raw.changes) {
    const change = parseChange(item)
    if (!change) return null
    changes.push(change)
  }
  let slides: AdmissionSlide[] | null = null
  if (Array.isArray(raw.slides) && raw.slides.length <= MAX_SLIDE_ROWS) {
    const rows = raw.slides.map(parseSlide)
    if (rows.every((row): row is AdmissionSlide => row !== null)) slides = rows
  }
  const totals = isRecord(raw.totals) ? raw.totals : null
  return { headline: raw.headline, changes, changesMore: raw.changes_more, slides, slideCount: totals && whole(totals.slides, 0, MAX_SLIDE_NUMBER) ? totals.slides : null }
}

// ---- the view --------------------------------------------------------------------------------------------------------------------------

/** The strip's chip: floor (built by the slide floor), attention (something left out), picture, changed (a small change), quiet. */
export type AdmissionChipKind = 'floor' | 'attention' | 'picture' | 'changed' | 'quiet'
export interface AdmissionChip { slide: number; kind: AdmissionChipKind; label: string }
export interface AdmissionRowView { outcome: AdmissionOutcomeOrOther; emphasised: boolean; text: string; slides: number[] }
export interface AdmissionReportView {
  headline: string
  rows: AdmissionRowView[]
  /** "and 3 more small changes" for `changes_more` > 0, else null. */
  moreLine: string | null
  /** Some row is emphasised: the list opens by default. */
  open: boolean
  /** The slide strip, or null (no slide rows in this answer). */
  strip: AdmissionChip[] | null
  /** "12 slides with nothing to report are not shown", or null. */
  stripNote: string | null
}

export const ADMISSION_OUTCOME_WORDS: Record<AdmissionOutcomeOrOther, string> = {
  text_left_out: 'Text left out', floor: 'Slide rebuilt over a picture', dropped: 'Left out', picture: 'Kept as a picture', check: 'Please check',
  rebuilt: 'Rebuilt', simplified: 'Simplified', text_split: 'Text box separated', other: 'Changed',
}

const plural = (n: number, one: string, many: string) => n === 1 ? one : many

function chipFor(row: AdmissionSlide): AdmissionChip {
  const kind: AdmissionChipKind = row.floor ? 'floor' : row.dropped > 0 || row.textListed > 0 ? 'attention' : row.picture > 0 ? 'picture'
    : row.changed > 0 || row.changes > 0 ? 'changed' : 'quiet'
  const parts = [`${row.editable} editable`]
  if (row.picture > 0) parts.push(`${row.picture} kept as ${plural(row.picture, 'a picture', 'pictures')}`)
  if (row.dropped > 0) parts.push(`${row.dropped} ${plural(row.dropped, 'element', 'elements')} left out`)
  if (row.textListed > 0) parts.push(`${row.textListed} ${plural(row.textListed, 'piece', 'pieces')} of text left out`)
  if (row.floor) parts.push('built over one picture')
  return { slide: row.slide, kind, label: `Slide ${row.slide}: ${parts.join(', ')}` }
}

function stripFor(report: AdmissionReport): { strip: AdmissionChip[] | null; stripNote: string | null } {
  if (!report.slides) return { strip: null, stripNote: null }
  const chips = [...report.slides].sort((a, b) => a.slide - b.slide).map(chipFor)
  const shown = chips.length <= STRIP_ALL ? chips : chips.filter(chip => chip.kind !== 'quiet')
  const kept = shown.slice(0, STRIP_MAX)
  // Slides with no chip: quiet slides left out of a long deck, and quiet slides the report itself left out (a very large deck: `totals.slides` still counts them).
  const quiet = Math.max(report.slideCount ?? chips.length, chips.length) - shown.length
  const cut = shown.length - kept.length
  const notes = [
    quiet > 0 ? `${quiet} ${plural(quiet, 'slide', 'slides')} with nothing to report ${plural(quiet, 'is', 'are')} not shown.` : '',
    cut > 0 ? `${cut} more ${plural(cut, 'slide', 'slides')} with changes ${plural(cut, 'is', 'are')} not shown.` : '',
  ].filter(Boolean)
  return { strip: kept, stripNote: notes.length ? notes.join(' ') : null }
}

/** What the library draws for one report, or null for none. */
export function admissionReportView(raw: unknown): AdmissionReportView | null {
  const report = parseAdmissionReport(raw)
  if (!report) return null
  const rows: AdmissionRowView[] = report.changes
    .map((change, index) => ({ change, index }))
    .sort((a, b) => a.change.rank - b.change.rank || a.index - b.index)
    .map(({ change }) => ({ outcome: change.outcome, emphasised: change.outcome !== 'other' && ADMISSION_EMPHASISED.includes(change.outcome), text: change.text, slides: change.slides }))
  const { strip, stripNote } = stripFor(report)
  return {
    headline: report.headline, rows,
    moreLine: report.changesMore > 0 ? `and ${report.changesMore} more small ${plural(report.changesMore, 'change', 'changes')}` : null,
    open: rows.some(row => row.emphasised), strip, stripNote,
  }
}

/**
 * The report to draw for a library row: the tracked job's (the job read, with its slides) when it reads as a report, else the row's own (the list, without
 * slides). Either may be absent, null or garbage.
 */
export function admissionReportFor(jobReport: unknown, rowReport: unknown): AdmissionReportView | null {
  return admissionReportView(jobReport) ?? admissionReportView(rowReport)
}
