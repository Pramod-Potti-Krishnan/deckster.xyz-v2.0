// R14 (P1-ELEM-FIDELITY), Studio half: the stage-name caption row under a Creative infographic.
// Contract: workspace streams/element/contracts/R14-caption-row.md. Text Labs (TL_INFOGRAPHIC_CAPTION_ROW_ENABLED) adds an
// additive `element.caption_row`; this file reads it and plans the two sibling elements. Flag
// NEXT_PUBLIC_INFOGRAPHIC_CAPTION_ROW_ENABLED: the literal "true" is on, anything else (default) is off, and with it off the
// generation hook never calls anything here. Import-free on purpose: the node test loads it on its own.

export const INFOGRAPHIC_CAPTION_ROW_ENABLED =
  process.env.NEXT_PUBLIC_INFOGRAPHIC_CAPTION_ROW_ENABLED === 'true'

/** Layout grid units, the same keys TextLabsPositionConfig uses. */
export interface CaptionRowBox {
  start_col: number
  start_row: number
  position_width: number
  position_height: number
}

export interface CaptionRowPlan {
  /** Where the picture goes now (inside `area`, shrunk to its own aspect). */
  imagePosition: CaptionRowBox
  /** Where the caption row goes: directly under the picture, inside `area`. */
  captionPosition: CaptionRowBox
  /** The area the user asked for; also what a variation must be asked for again. */
  area: CaptionRowBox
  /** The caption row as one self-contained element. */
  html: string
  /** `caption_row` without `html` and `columns`: what is persisted with the picture. */
  summary: Record<string, unknown>
}

export type CaptionRowRead =
  | { kind: 'applied'; plan: CaptionRowPlan }
  | { kind: 'skipped'; reason: string | null; detail: string | null }

/** What a refine of an already captioned picture needs to know, read from the picture's persisted generationConfig. */
export interface CaptionRowRefineState {
  operation: 'edit' | 'variation'
  captionElementId: string | null
  /** `generationConfig.infographic.caption_row` as persisted. */
  summary: Record<string, unknown> | null
  /** The ORIGINAL area, applied rows only. A variation is asked for this, not for the picture's now smaller box. */
  area: CaptionRowBox | null
}

/** The caption row is an ordinary text element: no padding of its own (its cells carry theirs). */
export const CAPTION_ROW_PADDING = { top: 0, right: 0, bottom: 0, left: 0 } as const

export const CAPTION_ROW_SKIP_WARNING_PREFIX = 'infographic_caption_row_skipped:'
export const CAPTION_ROW_INCOMPLETE_DETAIL = 'the stage-name row in the response was incomplete'

const EPSILON = 1e-6
const GRID_END_COL = 33
const GRID_END_ROW = 19

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readBox(value: unknown): CaptionRowBox | null {
  if (!isRecord(value)) return null
  const { start_col, start_row, width, height } = value
  if (
    typeof start_col !== 'number' || typeof start_row !== 'number'
    || typeof width !== 'number' || typeof height !== 'number'
    || ![start_col, start_row, width, height].every(Number.isFinite)
  ) return null
  if (
    start_col < 1 - EPSILON || start_row < 1 - EPSILON
    || width < 0.2 - EPSILON || height < 0.2 - EPSILON
    || start_col + width > GRID_END_COL + EPSILON
    || start_row + height > GRID_END_ROW + EPSILON
  ) return null
  return { start_col, start_row, position_width: width, position_height: height }
}

function inside(inner: CaptionRowBox, outer: CaptionRowBox): boolean {
  return inner.start_col >= outer.start_col - EPSILON
    && inner.start_row >= outer.start_row - EPSILON
    && inner.start_col + inner.position_width <= outer.start_col + outer.position_width + EPSILON
    && inner.start_row + inner.position_height <= outer.start_row + outer.position_height + EPSILON
}

function summaryOf(row: Record<string, unknown>): Record<string, unknown> {
  const { html: _html, columns: _columns, ...summary } = row
  return clone(summary)
}

/**
 * Read `element.caption_row`. `null` = nothing to do (absent, not an object, an unknown status or version): the picture is
 * inserted exactly as today. A row that says `applied` but cannot be trusted (missing html, positions off the grid or outside
 * the area) reads as skipped, so the picture keeps its own box and no caption is inserted.
 */
export function readCaptionRow(element: unknown): CaptionRowRead | null {
  const row = isRecord(element) ? element.caption_row : null
  if (!isRecord(row)) return null
  if (row.status === 'skipped') {
    return { kind: 'skipped', reason: text(row.reason), detail: text(row.detail) }
  }
  if (row.status !== 'applied' || row.version !== 1) return null
  const incomplete: CaptionRowRead = { kind: 'skipped', reason: 'incomplete_response', detail: CAPTION_ROW_INCOMPLETE_DETAIL }
  const html = typeof row.html === 'string' && row.html.trim() ? row.html : null
  const area = readBox(row.area)
  const imagePosition = readBox(row.image_position)
  const captionPosition = readBox(row.caption_position)
  if (
    !html || row.component_type !== 'TEXT_BOX'
    || !area || !imagePosition || !captionPosition
    || !inside(imagePosition, area) || !inside(captionPosition, area)
    || Math.abs(imagePosition.position_width - captionPosition.position_width) > EPSILON
  ) return incomplete
  return { kind: 'applied', plan: { imagePosition, captionPosition, area, html, summary: summaryOf(row) } }
}

/** The text element for the caption row, shaped for buildInsertionParams('TEXT_BOX', ...): an ordinary body-text element. */
export function captionRowElementForInsertion(plan: CaptionRowPlan) {
  return {
    html: plan.html,
    semantic_role: 'BODY_TEXT' as const,
    grid_position: { ...plan.captionPosition },
  }
}

/** A copy of the picture's generationConfig that carries the link to its caption row (and the row's own summary when it is missing). */
export function withCaptionLink(
  config: unknown,
  captionElementId: string,
  summary: Record<string, unknown> | null,
): Record<string, unknown> {
  const base = isRecord(config) ? clone(config) : {}
  const infographic = isRecord(base.infographic) ? base.infographic : {}
  const persisted = isRecord(infographic.caption_row) ? infographic.caption_row : summary
  return {
    ...base,
    captionElementId,
    infographic: { ...infographic, ...(persisted ? { caption_row: persisted } : {}) },
  }
}

/**
 * What the picture's persisted generationConfig says about its caption row. `null` when it was never captioned.
 * Only an `applied` summary has an `area`; a skipped one never does.
 */
export function captionRowRefineState(
  operation: unknown,
  config: unknown,
): CaptionRowRefineState | null {
  if (operation !== 'edit' && operation !== 'variation') return null
  if (!isRecord(config)) return null
  const infographic = isRecord(config.infographic) ? config.infographic : null
  const summary = infographic && isRecord(infographic.caption_row) ? clone(infographic.caption_row) : null
  const captionElementId = text(config.captionElementId)
  if (!captionElementId && !summary) return null
  const area = summary?.status === 'applied' ? readBox(summary.area) : null
  return { operation, captionElementId, summary, area }
}

/** Keep the link on the replacement picture of an `edit`: the caption row stays, so the picture must still point at it. */
export function carryCaptionLink(config: unknown, state: CaptionRowRefineState | null): unknown {
  if (!state || state.operation !== 'edit' || !state.captionElementId) return config
  return withCaptionLink(config, state.captionElementId, state.summary)
}

/** The plain-words notice for a caption row that was recognised but not added. Empty for anything else. */
export function captionRowSkipNotice(read: CaptionRowRead | null, warnings: unknown): string {
  if (!read || read.kind !== 'skipped') return ''
  const listed = Array.isArray(warnings)
    ? warnings.filter((item): item is string => typeof item === 'string' && item.startsWith(CAPTION_ROW_SKIP_WARNING_PREFIX))
    : []
  const sentences = listed.length > 0
    ? listed.map(item => item.slice(CAPTION_ROW_SKIP_WARNING_PREFIX.length).trim())
    : [`stage names were not added under the picture${read.detail ? ` (${read.detail})` : ''}.`]
  return sentences
    .filter(Boolean)
    .map(sentence => sentence.charAt(0).toUpperCase() + sentence.slice(1))
    .join(' ')
}
