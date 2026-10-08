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
 *    shown to the user in plain words (see textBoxResponseNotices).
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

const positiveInteger = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null

/**
 * Plain-words notices for the `warnings` Text Labs returns on POST /api/chat/message, shown
 * with the success toast. Facts come from the request (what the user chose) and the response
 * (how many elements came back); a number that is not known is left out of the sentence
 * rather than guessed. Warnings that are not about text box counts are not the panel's to
 * explain and are ignored. Returns sentences, deduplicated, in the order Text Labs sent them.
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
): string[] {
  if (!Array.isArray(warnings)) return []
  const cards = facts.componentType === 'METRICS' || typedTextBoxCardLimit(facts.structure) !== null
  const noun = (amount: number) => (cards ? (amount === 1 ? 'card' : 'cards') : (amount === 1 ? 'box' : 'boxes'))
  const chosen = facts.countAuto ? null : positiveInteger(facts.count)
  const returned = positiveInteger(facts.elementsReturned)
  const used = returned !== null && returned > 1 ? returned : null
  const notices: string[] = []
  for (const warning of warnings) {
    if (typeof warning !== 'string') continue
    const code = warning.trim().match(/^[a-z0-9_]+/i)?.[0].toLowerCase()
    if (!code) continue
    let notice: string | null = null
    if (code === COUNT_OVERRIDDEN_WARNING) {
      notice = chosen !== null && used !== null && chosen !== used
        ? `Used ${used} ${noun(used)} from your prompt instead of ${chosen}`
        : chosen !== null
          ? `Used the number of ${noun(2)} named in your prompt instead of the ${chosen} you picked`
          : `Used the number of ${noun(2)} named in your prompt`
    } else if (code === COUNT_NOT_OVERRIDDEN_WARNING) {
      notice = chosen !== null
        ? `Your prompt names a different number of ${noun(2)}, but the ${chosen} you picked was kept`
        : `Your prompt names a different number of ${noun(2)}, but the number picked in the panel was kept`
    } else if (code.startsWith('text_box_')) {
      const words = code.slice('text_box_'.length).replace(/_/g, ' ')
      notice = `Note: ${words}`
    }
    if (notice && !notices.includes(notice + '.')) notices.push(notice + '.')
  }
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
