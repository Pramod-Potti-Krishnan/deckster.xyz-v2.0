/**
 * Add Element text box / metrics request fidelity (UAT J3-F1 / J3-F4).
 *
 * Build-time flag NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED (literal "true" = on,
 * default off). With the flag off the forms never call into this module's
 * transformations, so request bodies are byte-identical to the pre-flag build.
 *
 * Rules (the panel must send what the user chose, and only that):
 *  - A count the user never picked ("Auto") is not sent. Text Labs resolves
 *    `count = request.count or <count extracted from the prompt> or 1`, so a
 *    hard default of 1 silently beat "four KPIs" / "five rollout steps".
 *  - `list_style` travels in the Text Service vocabulary (bullets | numbers | none).
 *    The panel's labels use numbered | plain, which Text Service silently ignored.
 *  - State behind controls that are hidden for the selected role / structure /
 *    surface does not leak onto the wire (e.g. Surface or Title choices made on a
 *    Body role must not restyle a Slide title after the role changes).
 *  - A typed family (Sequential, Compare, Sections, Callout, Bullets, Bullet Box,
 *    Numbered) with a Boxes/Cards choice above 1 is ONE element of that many cards
 *    (Text Labs MR !84, TL_TEXTBOX_COUNT_ALL_TYPES_ENABLED): the choice is capped at
 *    what the family holds, and the request keeps `count`, `compose` and
 *    `elements[].grid_position` because Text Labs reads the card count and the
 *    arrangement (row / column / N-column grid) off them.
 *  - Text Labs reads `multi_box_color_mode` only in its COMPOSE branch, so a typed family
 *    (one element of cards) neither shows nor sends the Multi-box colour style.
 *  - The `warnings` of a text box / metrics response that explain a count decision are
 *    shown to the user in plain words (see textBoxResponseNotices). With real numbers when
 *    Text Labs sends `warning_details` (TL_TEXTBOX_COUNT_ALL_TYPES_ENABLED) or when the
 *    warning text itself carries them; otherwise in generic words.
 *
 * Import-free on purpose: the node contract test compiles this file alone.
 */

export const TEXTBOX_REQUEST_FIDELITY_ENABLED =
  process.env.NEXT_PUBLIC_TEXTBOX_REQUEST_FIDELITY_ENABLED === 'true'

/**
 * Cards one typed element holds: Text Labs !84 `TYPED[family].cards_max`, which mirrors the
 * Text Service endpoints (SEQUENTIAL 1-6, COMPARISON 1-4, SECTIONS 1-5, CALLOUT 1-2,
 * TEXT_BULLETS / BULLET_BOX / NUMBERED_LIST 1-4). Every other structure is a plain box
 * (Auto, Classic, Vertical, Mixed: several boxes are separate COMPOSE boxes, 1-6).
 */
const TYPED_CARD_LIMITS: Record<string, number> = {
  SEQUENTIAL: 6,
  COMPARISON: 4,
  SECTIONS: 5,
  CALLOUT: 2,
  TEXT_BULLETS: 4,
  BULLET_BOX: 4,
  NUMBERED_LIST: 4,
}

/** What a card of each typed family is called in the panel copy. */
const TYPED_CARD_NOUNS: Record<string, string> = {
  SEQUENTIAL: 'steps',
  COMPARISON: 'columns',
  SECTIONS: 'sections',
  CALLOUT: 'callouts',
  TEXT_BULLETS: 'boxes',
  BULLET_BOX: 'boxes',
  NUMBERED_LIST: 'lists',
}

/** Most cards one element of this structure holds, or null for a plain (non-typed) structure. */
export function typedTextBoxCardLimit(structure: string | null | undefined): number | null {
  return typeof structure === 'string' && Object.prototype.hasOwnProperty.call(TYPED_CARD_LIMITS, structure)
    ? TYPED_CARD_LIMITS[structure]
    : null
}

export function typedTextBoxCardNoun(structure: string | null | undefined): string {
  return typeof structure === 'string' && Object.prototype.hasOwnProperty.call(TYPED_CARD_NOUNS, structure)
    ? TYPED_CARD_NOUNS[structure]
    : 'boxes'
}

/** The `warnings` codes Text Labs uses to say which count it honoured (prompt or panel). */
const COUNT_OVERRIDDEN_WARNING = 'text_box_count_overridden'
const COUNT_NOT_OVERRIDDEN_WARNING = 'text_box_count_not_overridden'
const COUNT_CLAMPED_WARNING = 'text_box_count_clamped'
const ITEMS_UNSATISFIED_WARNING = 'stated_item_count_unsatisfied'
/** Codes that say how many items a box or card kept of the number asked for. */
const ITEM_COUNT_WARNINGS = ['stated_item_count_clamped', 'stated_item_count_unmet', 'item_count_reduced']

const positiveInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null

/** One count warning with the numbers it carries (null = not known). `box` is the box index the Text Service named (0-based). */
interface CountWarning {
  code: string
  requested: number | null
  used: number | null
  panel: number | null
  box: number | null
}

/** An entry of Text Labs' `warning_details`: `{code, requested, used, panel, box?}`. Null for anything else. */
function readWarningDetail(entry: unknown): CountWarning | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as Record<string, unknown>
  const code = typeof raw.code === 'string' ? raw.code.trim().match(/^[a-z0-9_]+/i)?.[0].toLowerCase() : undefined
  if (!code) return null
  const box = typeof raw.box === 'number' && Number.isInteger(raw.box) && raw.box >= 0 ? raw.box : null
  return { code, requested: positiveInteger(raw.requested), used: positiveInteger(raw.used), panel: positiveInteger(raw.panel), box }
}

/**
 * A `warnings` string read as "code: detail". The code is the text before the first ':'. The
 * numbers are read from the detail: requested = the first integer after "asks for" / "asked",
 * used = the integer before "used" (else "kept" / "rendered"). A detail that does not give
 * both leaves every number null, so the caller says it in generic words.
 */
function readWarningText(warning: string): CountWarning | null {
  const text = warning.trim()
  const colon = text.indexOf(':')
  const code = (colon === -1 ? text : text.slice(0, colon)).trim().match(/^[a-z0-9_]+/i)?.[0].toLowerCase()
  if (!code) return null
  const detail = colon === -1 ? '' : text.slice(colon + 1)
  const number = (pattern: RegExp): number | null => positiveInteger(Number(pattern.exec(detail)?.[1]))
  const requested = number(/\b(?:asks for|asked)\b\D*(\d+)/i)
  const used = number(/(\d+)\s+used\b/i) ?? number(/(\d+)\s+(?:kept|rendered)\b/i)
  if (requested === null || (used === null && code !== ITEMS_UNSATISFIED_WARNING)) {
    return { code, requested: null, used: null, panel: null, box: null }
  }
  const panel = number(/panel['\u2019]?s count of\s+(\d+)/i)
  const box = /\bbox\s+(\d+)\s+asked\b/i.exec(detail)?.[1]
  return { code, requested, used, panel, box: box === undefined ? null : Number(box) }
}

/**
 * Plain-words notices for the `warnings` Text Labs returns on POST /api/chat/message, shown
 * with the success toast. Facts come from the request (what the user chose) and the response
 * (how many elements came back); a number that is not known is left out of the sentence
 * rather than guessed. Warnings that are not about text box counts are not the panel's to
 * explain and are ignored. Returns sentences, deduplicated, in the order Text Labs sent them.
 *
 * `warningDetails` is the response's `warning_details` (present only when Text Labs has
 * TL_TEXTBOX_COUNT_ALL_TYPES_ENABLED on and a count warning fired). It is read first: an entry
 * gives the sentence its real numbers and takes the place of the `warnings` string of the same
 * code. A string with no entry is read for its own numbers; one that gives none is said in the
 * generic words below.
 */
export function textBoxResponseNotices(
  warnings: unknown,
  facts: {
    componentType: string
    structure?: string | null
    /** The count the panel sent. */
    count?: number | null
    /** The panel's Count was Auto: nothing was chosen. */
    countAuto?: boolean
    /** Elements in the response; one element of several cards says nothing about the card count. */
    elementsReturned?: number | null
  },
  warningDetails?: unknown,
): string[] {
  const listed = Array.isArray(warnings) ? warnings : []
  const entries = Array.isArray(warningDetails)
    ? warningDetails.map(readWarningDetail).filter((entry): entry is CountWarning => entry !== null)
    : []
  if (listed.length === 0 && entries.length === 0) return []
  const cards = facts.componentType === 'METRICS' || typedTextBoxCardLimit(facts.structure) !== null
  const noun = (amount: number) => (cards ? (amount === 1 ? 'card' : 'cards') : (amount === 1 ? 'box' : 'boxes'))
  const were = (amount: number) => (amount === 1 ? 'was' : 'were')
  const chosen = facts.countAuto ? null : positiveInteger(facts.count)
  const returned = positiveInteger(facts.elementsReturned)
  const used = returned !== null && returned > 1 ? returned : null

  // The sentence for a warning that has its real numbers, or null when it does not.
  const withNumbers = (w: CountWarning): string | null => {
    if (w.code === COUNT_OVERRIDDEN_WARNING && w.used !== null) {
      const picked = w.panel ?? chosen
      return picked !== null && picked !== w.used
        ? `Used ${w.used} ${noun(w.used)} from your prompt instead of the ${picked} you picked`
        : `Used ${w.used} ${noun(w.used)} from your prompt`
    }
    if (w.code === COUNT_NOT_OVERRIDDEN_WARNING && w.requested !== null && w.used !== null) {
      const kept = w.panel ?? w.used
      return `The area fits ${w.used} ${noun(w.used)}, so your ${kept} ${were(kept)} kept instead of ${w.requested}`
    }
    if (w.code === COUNT_CLAMPED_WARNING && w.requested !== null && w.used !== null) {
      return `Used ${w.used} ${noun(w.used)} instead of the ${w.requested} in your prompt, the most that fit`
    }
    // Text Labs passes the Text Service's box index through; its tests show it counting from 0. The user counts from 1.
    const whose = w.box !== null ? `Box ${w.box + 1}` : (cards ? 'The card' : 'The box')
    if (ITEM_COUNT_WARNINGS.includes(w.code) && w.requested !== null && w.used !== null) {
      return `${whose} fits ${w.used} ${w.used === 1 ? 'item' : 'items'}, so ${w.used} ${were(w.used)} used instead of ${w.requested}`
    }
    if (w.code === ITEMS_UNSATISFIED_WARNING && w.requested !== null) {
      return `${whose} could not hold ${w.requested} ${w.requested === 1 ? 'item' : 'items'}, so it was made without that count`
    }
    return null
  }
  // The generic sentence for a code, from the request alone (no numbers of the warning's own).
  const generic = (code: string): string | null => {
    if (code === COUNT_OVERRIDDEN_WARNING) {
      return chosen !== null && used !== null && chosen !== used
        ? `Used ${used} ${noun(used)} from your prompt instead of ${chosen}`
        : chosen !== null
          ? `Used the number of ${noun(2)} named in your prompt instead of the ${chosen} you picked`
          : `Used the number of ${noun(2)} named in your prompt`
    }
    if (code === COUNT_NOT_OVERRIDDEN_WARNING) {
      return chosen !== null
        ? `Your prompt names a different number of ${noun(2)}, but the ${chosen} you picked was kept`
        : `Your prompt names a different number of ${noun(2)}, but the number picked in the panel was kept`
    }
    if (code.startsWith('text_box_')) return `Note: ${code.slice('text_box_'.length).replace(/_/g, ' ')}`
    return null
  }

  const notices: string[] = []
  const add = (warning: CountWarning) => {
    const notice = withNumbers(warning) ?? generic(warning.code)
    if (notice && !notices.includes(notice + '.')) notices.push(notice + '.')
  }
  const unmatched = [...entries]
  for (const warning of listed) {
    if (typeof warning !== 'string') continue
    const read = readWarningText(warning)
    if (!read) continue
    const at = unmatched.findIndex(entry => entry.code === read.code)
    add(at >= 0 ? unmatched.splice(at, 1)[0] : read)
  }
  unmatched.forEach(add)
  return notices
}

/** Panel list-style labels -> the values Text Service renders. */
const LIST_STYLE_WIRE: Record<string, string> = {
  numbered: 'numbers',
  plain: 'none',
}

/** Template Text (non-body roles) only exposes the content font controls. */
const STRUCTURAL_TEXTBOX_CONFIG_KEYS: readonly string[] = [
  'content_font_color',
  'content_font_family',
  'content_font_size',
  'content_bold',
  'content_italic',
  'content_underline',
]

/** Template Text exposes Max chars, Max lines and the content font size. */
const STRUCTURAL_MANUAL_GEOMETRY_KEYS: readonly string[] = [
  'max_chars',
  'max_lines',
  'content_font_size_px',
]

export function textBoxListStyleWire<T>(value: T): T | string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LIST_STYLE_WIRE, value)
    ? LIST_STYLE_WIRE[value]
    : value
}

/**
 * The sparse `textbox_config` that should reach Text Labs for the selected
 * role/structure. Returns a new object; UI state is never mutated.
 */
export function textBoxConfigForRequest<T extends object>(
  config: T,
  context: { isBodyText: boolean; structure: string },
): Partial<T> {
  const next: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(config)) {
    if (value === undefined) continue
    if (!context.isBodyText && !STRUCTURAL_TEXTBOX_CONFIG_KEYS.includes(key)) continue
    next[key] = value
  }
  if (!context.isBodyText) return next as Partial<T>

  // Simple-box controls only exist while Body structure is Simple.
  if (context.structure !== 'simple') {
    delete next.simple_subtype
    delete next.target_char_count
  }
  // Colour and Opacity are only offered (and only meaningful) on a coloured box.
  if (next.background !== 'colored') {
    delete next.color_variant
    delete next.opacity
  }
  if ('list_style' in next) next.list_style = textBoxListStyleWire(next.list_style)
  return next as Partial<T>
}

/** Manual geometry overrides that belong to controls visible for the role. */
export function textBoxManualGeometryForRequest<T extends object>(
  overrides: T,
  context: { isBodyText: boolean },
): Partial<T> {
  if (context.isBodyText) return overrides
  const source = overrides as Record<string, unknown>
  const next: Record<string, unknown> = {}
  for (const key of STRUCTURAL_MANUAL_GEOMETRY_KEYS) {
    if (source[key] !== undefined) next[key] = source[key]
  }
  return next as Partial<T>
}
