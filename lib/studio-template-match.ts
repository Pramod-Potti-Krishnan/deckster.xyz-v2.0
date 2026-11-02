// FRONTEND-2 (PK's W2 P4-7/8 rulings, 2 Nov; flag NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH, the string "true", default off, build-time): Studio shows the template Director applied.
// Pure decisions only, IMPORT-FREE by design (scripts/test-studio-template-match.mjs transpiles this file into a bare function scope with a fake `process`): no React, no DOM, no clock, no network, no storage of its own
// (the preference's storage is handed in). The page's pieces hold the state and do the I/O; every decision is here.
//
// The contract (DIRECTOR-2, streams/director2/p4-7-template-match/out/README.md; COMPOSER-2's shape, composer/pass4/p4-7/MATCHER-DESIGN.md §5 and §11):
//   - Studio advertises the cap `template_match1` (last in client_caps) only with the flag on; Director then sends the frame `template_match` { payload } after Director's plan card and after EVERY toggle, switch, Undo and chat intent,
//     reusing the last match result. Studio renders from the LATEST frame and keeps no state of its own besides the preference.
//   - Studio sends `template_auto_apply` { data: { enabled, client_caps } } on every connect (before the first user_message) and on each toggle, and `template_switch` { data: { template_id | null, client_caps } } for a picker action or an Undo.
//     Director says the words in the chat; Studio shows only the frame. A picker action gets no chat line.
//   - PK's rulings: auto-apply is ON by default with a user switch (off = no template at all); a built slide keeps its template and a switch changes only the slides not built yet; switching from chat is allowed.
// Fields that a frame may lack (COMPOSER-2's §11: deck[].covered / total / slides) are optional here: without them the v0 fallbacks below apply, so a v0 recording and a final frame both work.

// ---------------------------------------------------------------------------
// Flag and wire names (a literal process.env read so Next inlines it at build time)
// ---------------------------------------------------------------------------

export function templateMatchFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

export const STUDIO_TEMPLATE_MATCH_ENABLED = templateMatchFlagOn(process.env.NEXT_PUBLIC_STUDIO_TEMPLATE_MATCH)

/** The capability Director checks before it sends `template_match` (exact, case-sensitive). Added LAST in client_caps. */
export const TEMPLATE_MATCH_CAP = 'template_match1'
export const TEMPLATE_MATCH_FRAME_TYPE = 'template_match'
export const TEMPLATE_AUTO_APPLY_TYPE = 'template_auto_apply'
export const TEMPLATE_SWITCH_TYPE = 'template_switch'
/** The one frame version this build reads (COMPOSER-2's `version`); any other is ignored. */
export const TEMPLATE_MATCH_VERSION = 1
/** Why Director sent a frame (the contract's list); a value outside it is read as "no reason" (no Undo). */
export const TEMPLATE_MATCH_REASONS = ['match', 'auto_apply_off', 'switch', 'chat_switch', 'no_template', 'undo'] as const
export type TemplateMatchReason = (typeof TEMPLATE_MATCH_REASONS)[number]
/** The reasons after which Undo is offered (the frame's previous_template_id is what Undo goes back to). */
export const TEMPLATE_UNDO_REASONS: readonly string[] = ['switch', 'chat_switch', 'undo']

// ---------------------------------------------------------------------------
// Words (the approved mock's, word for word)
// ---------------------------------------------------------------------------

export const TEMPLATE_MATCH_WORDS = {
  badgeChange: 'Change',
  badgeUndo: 'Undo',
  chipNew: 'New in your theme',
  groupTitle: 'Use with this deck',
  groupHelp: "Keeps your outline, words and theme; the slides take the template's layouts.",
  sheetHelp: 'Keeps your outline, words and theme. Built slides keep their template.',
  startHeading: 'Start a new presentation',
  switchNote: 'Applies to the slides not built yet; built slides keep their template. You can Undo.',
  cancel: 'Cancel',
  none: 'No template',
  noneWhy: 'Your theme only.',
  startFromTemplateInSheet: 'Start a new presentation from a template',
  checkLabel: 'Use my best-matching template',
  checkHelpOn: 'Director picks the template that fits your outline best. Untick to build with your theme only.',
  checkHelpOff: 'Off: no template is applied. Your theme only.',
  inUse: 'In use',
  yours: 'Yours',
  library: 'Library',
} as const

/** "Switch to <name>" (the picker's and the sheet's primary button); the no-template row reads "Switch to no template". */
export function switchButtonLabel(name: string | null): string {
  return `Switch to ${name ?? 'no template'}`
}

// ---------------------------------------------------------------------------
// The frame: parse and validate (anything else is ignored safely)
// ---------------------------------------------------------------------------

export interface TemplateMatchSlideMatch {
  template_id: string
  chip: string | null
}
export interface TemplateMatchSlide {
  slide_id: string
  /** The best match across all candidates; null: the matcher found nothing for this slide. */
  match: TemplateMatchSlideMatch | null
  /** P4-7b (optional): the APPLIED template's own match for this slide; null: it has none (or the template is outside the top 3, or nothing is applied). undefined: the frame has no such key (v0). */
  applied_match?: TemplateMatchSlideMatch | null
}
export interface TemplateMatchDeckItem {
  template_id: string
  name: string
  owner: 'user' | 'library' | null
  decision: 'deck' | 'slides' | null
  reason: string | null
  /** §11 (optional): explicit counts, preferred over the reason's words. */
  covered: number | null
  total: number | null
  /** §11 (optional): THIS template's own per-slide matches, in plan order. null when the frame has none (v0). */
  slides: TemplateMatchSlide[] | null
}
export interface TemplateMatchApplied {
  template_id: string
  name: string
  decision: 'deck' | 'slides'
}
export interface TemplateMatchFrame {
  status: 'matched' | 'no_match'
  deck: TemplateMatchDeckItem[]
  /** The best per-slide match across all candidates, in plan order. */
  slides: TemplateMatchSlide[]
  auto_apply: boolean
  applied: boolean
  applied_template: TemplateMatchApplied | null
  /** undefined: the frame has no such key (no Undo). null: Undo restores "no template". */
  previous_template_id: string | null | undefined
  built_slide_ids: string[]
  reason: TemplateMatchReason | null
  plan_id: string | null
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown, max = 160): string | null => (typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, max) : null)
const count = (value: unknown): number | null => (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 100000 ? value : null)
/** A frame is bounded: Director sends the top 3 candidates and one row per planned slide. */
const MAX_DECK = 3
const MAX_SLIDES = 200

function parseSlideMatch(value: unknown): TemplateMatchSlideMatch | null {
  return isRecord(value) && text(value.template_id, 120) ? { template_id: text(value.template_id, 120) as string, chip: text(value.chip, 120) } : null
}

function parseSlides(value: unknown): TemplateMatchSlide[] | null {
  if (!Array.isArray(value)) return null
  const out: TemplateMatchSlide[] = []
  for (const item of value.slice(0, MAX_SLIDES)) {
    if (!isRecord(item)) continue
    const slideId = text(item.slide_id, 80)
    if (!slideId) continue
    out.push({ slide_id: slideId, match: parseSlideMatch(item.match), ...('applied_match' in item ? { applied_match: parseSlideMatch(item.applied_match) } : {}) })
  }
  return out
}

function parseDeckItem(value: unknown): TemplateMatchDeckItem | null {
  if (!isRecord(value)) return null
  const templateId = text(value.template_id, 120), name = text(value.name)
  if (!templateId || !name) return null
  return {
    template_id: templateId, name,
    owner: value.owner === 'user' || value.owner === 'library' ? value.owner : null,
    decision: value.decision === 'deck' || value.decision === 'slides' ? value.decision : null,
    reason: text(value.reason, 240),
    covered: count(value.covered), total: count(value.total),
    slides: parseSlides(value.slides),
  }
}

/**
 * The frame's payload (or the whole envelope `{ type: "template_match", payload }`) as a validated frame, or null: not an object, an unknown version, a status that is neither matched nor no_match, the booleans
 * Studio renders from missing, or an applied template that is not well formed. Extra keys are ignored. A candidate or a slide row that is not well formed is dropped on its own; the frame is not.
 */
export function parseTemplateMatchFrame(raw: unknown): TemplateMatchFrame | null {
  const envelope = isRecord(raw) && isRecord(raw.payload) ? raw : null
  if (envelope && typeof envelope.type === 'string' && envelope.type !== TEMPLATE_MATCH_FRAME_TYPE) return null
  const p = envelope ? envelope.payload : raw
  if (!isRecord(p)) return null
  if (p.version !== TEMPLATE_MATCH_VERSION) return null
  if (p.status !== 'matched' && p.status !== 'no_match') return null
  if (typeof p.auto_apply !== 'boolean' || typeof p.applied !== 'boolean') return null
  let applied: TemplateMatchApplied | null = null
  if (p.applied_template !== null && p.applied_template !== undefined) {
    if (!isRecord(p.applied_template)) return null
    const id = text(p.applied_template.template_id, 120), name = text(p.applied_template.name)
    if (!id || !name || (p.applied_template.decision !== 'deck' && p.applied_template.decision !== 'slides')) return null
    applied = { template_id: id, name, decision: p.applied_template.decision }
  }
  // A template named while nothing is applied cannot be drawn truthfully. (Applied with no template named is a slide-level result: the slides carry their own matches.)
  if (p.applied === false && applied !== null) return null
  const previous = !('previous_template_id' in p) ? undefined : p.previous_template_id === null ? null : text(p.previous_template_id, 120) ?? undefined
  const built = Array.isArray(p.built_slide_ids) ? p.built_slide_ids.filter((id): id is string => typeof id === 'string' && id !== '').slice(0, MAX_SLIDES) : []
  return {
    status: p.status,
    deck: (Array.isArray(p.deck) ? p.deck.slice(0, MAX_DECK * 4) : []).map(parseDeckItem).filter((item): item is TemplateMatchDeckItem => item !== null).slice(0, MAX_DECK),
    slides: parseSlides(p.slides) ?? [],
    auto_apply: p.auto_apply, applied: p.applied, applied_template: applied,
    previous_template_id: previous,
    built_slide_ids: built,
    reason: (TEMPLATE_MATCH_REASONS as readonly unknown[]).includes(p.reason) ? (p.reason as TemplateMatchReason) : null,
    plan_id: text(p.plan_id, 120),
  }
}

/** Whether a socket message is Director's template_match (what the socket hook routes to the store, ahead of the allowlist). */
export function isTemplateMatchMessage(message: unknown): boolean {
  return isRecord(message) && message.type === TEMPLATE_MATCH_FRAME_TYPE
}

// ---------------------------------------------------------------------------
// Counts and positions
// ---------------------------------------------------------------------------

/** "Covers 7 of 8 slides: ..." -> { covered: 7, total: 8 } (the v0 fallback; §11's explicit integers are preferred). */
export function coverageFromReason(reason: string | null | undefined): { covered: number; total: number } | null {
  const found = typeof reason === 'string' ? /\bCovers (\d{1,4}) of (\d{1,4}) slides?\b/.exec(reason) : null
  if (!found) return null
  const covered = Number(found[1]), total = Number(found[2])
  return total > 0 && covered <= total ? { covered, total } : null
}

/** A candidate's "n of m" : the frame's own integers first, then the reason's words, else none. */
export function coverageOf(item: TemplateMatchDeckItem): { covered: number; total: number } | null {
  if (item.covered !== null && item.total !== null && item.total > 0 && item.covered <= item.total) return { covered: item.covered, total: item.total }
  return coverageFromReason(item.reason)
}

/** "7 of 8 slides" (the picker's right-hand value); one slide is "1 of 1 slide". */
export function coverageText(coverage: { covered: number; total: number } | null): string | null {
  return coverage ? `${coverage.covered} of ${coverage.total} slide${coverage.total === 1 ? '' : 's'}` : null
}

/** The rail position (1-based) of a plan row. Director's slide ids are the plan position ("s1".."s10"); an id that is not of that form (a stable id, from the build on) is read by its place in the list. */
export function slidePosition(slideId: string, index: number): number {
  const found = /^s(\d{1,4})$/.exec(slideId)
  return found && Number(found[1]) >= 1 ? Number(found[1]) : index + 1
}

// ---------------------------------------------------------------------------
// The badge
// ---------------------------------------------------------------------------

export type TemplateBadgeKind = 'deck' | 'slides' | 'built'
export interface TemplateBadge {
  kind: TemplateBadgeKind
  /** The whole line (the badge's words before Change / Undo). */
  text: string
  /** The applied template; null for slide-level matches with no single template named. */
  name: string | null
  templateId: string | null
  /** Undo goes back to this template (null: back to "no template"); absent: no Undo. */
  undo: { to: string | null } | null
}

/** Undo: only when the frame has a previous_template_id (null counts) and the reason is a switch, a chat switch or an Undo. */
export function undoFor(frame: TemplateMatchFrame | null): { to: string | null } | null {
  if (!frame || frame.previous_template_id === undefined || frame.reason === null || !TEMPLATE_UNDO_REASONS.includes(frame.reason)) return null
  return { to: frame.previous_template_id }
}

/** Whether the frame is one that shows a template at all: a match, auto-apply on, and something applied (a named template, or slide-level matches with none named). */
export function templateInUse(frame: TemplateMatchFrame | null): frame is TemplateMatchFrame {
  return Boolean(frame && frame.status === 'matched' && frame.auto_apply && frame.applied)
}

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many)

/**
 * The slides that take a template's layout, for the slide-level badge ("<n> slides use your templates"): with a template applied, that template's OWN matches (the rows' `applied_match`, else its candidate row's `slides`),
 * which is what a switch to it applies; v0 frames have neither, and the best match per slide across the candidates is what the slide-level decision applies.
 */
export function matchedSlideCount(frame: TemplateMatchFrame): number {
  if (frame.applied_template) {
    if (frame.slides.some(row => row.applied_match !== undefined)) return frame.slides.filter(row => row.applied_match).length
    const own = appliedDeckItem(frame)?.slides
    if (own) return own.filter(row => row.match !== null).length
  }
  return frame.slides.filter(row => row.match !== null).length
}

/** The candidate row of the applied template, if the frame lists it. */
export function appliedDeckItem(frame: TemplateMatchFrame): TemplateMatchDeckItem | null {
  const id = frame.applied_template?.template_id
  return id ? frame.deck.find(item => item.template_id === id) ?? null : null
}

/**
 * The line above the slide. None for auto-apply off, no_match, no template applied, or a slide-level decision with no slide matched.
 *   built slides present : "Using <name> for the slides not built yet"
 *   deck                 : "Using your template <name> · <n> of <m> slides"
 *   slides               : "<n> slides use your templates"
 */
export function templateBadge(frame: TemplateMatchFrame | null): TemplateBadge | null {
  if (!templateInUse(frame)) return null
  const applied = frame.applied_template
  const undo = undoFor(frame)
  if (applied && frame.built_slide_ids.length > 0) return { kind: 'built', text: `Using ${applied.name} for the slides not built yet`, name: applied.name, templateId: applied.template_id, undo }
  if (!applied || applied.decision === 'slides') {
    const n = matchedSlideCount(frame)
    return n > 0 ? { kind: 'slides', text: `${n} ${plural(n, 'slide uses your template', 'slides use your templates')}`, name: applied?.name ?? null, templateId: applied?.template_id ?? null, undo } : null
  }
  const item = appliedDeckItem(frame)
  const coverage = item ? coverageOf(item) : null
  return { kind: 'deck', text: `Using your template ${applied.name}${coverage ? ` \u00b7 ${coverageText(coverage)}` : ''}`, name: applied.name, templateId: applied.template_id, undo }
}

// ---------------------------------------------------------------------------
// The chips (inside each rail thumbnail, bottom-left)
// ---------------------------------------------------------------------------

export interface TemplateChip {
  /** "template": a slide that takes a template's layout; "theme": "New in your theme". */
  tone: 'template' | 'theme'
  text: string
}

const themeChip = (): TemplateChip => ({ tone: 'theme', text: TEMPLATE_MATCH_WORDS.chipNew })
const fromChip = (name: string): TemplateChip => ({ tone: 'template', text: `From ${name}` })
const matchChip = (match: TemplateMatchSlideMatch, fallbackName: string): TemplateChip => ({ tone: 'template', text: match.chip ?? `From ${fallbackName}` })

/**
 * One chip per plan slide, keyed by rail position (1-based). None at all unless something is applied (auto-apply off, no_match and "no template" draw no chips).
 *  - A BUILT slide keeps the chip the frame recorded for it, from the best-per-slide rows ("New in your theme" when it matched nothing): it keeps its template, whatever was switched since.
 *  - With no template named (a slide-level result), every slide shows the best-per-slide chips as given.
 *  - A slide NOT built yet, with a template applied, the first of these that applies:
 *      1. the applied template is not among the listed candidates (a chat switch to one outside the top 3): no chip;
 *      2. any slide row carries `applied_match` (P4-7b): that match's chip, "New in your theme" when it is null;
 *      3. the applied candidate has its own per-slide matches (section 11, deck[k].slides): its chips, "New in your theme" where its match is null;
 *      4. v0 frames (neither): a slide-level decision shows the best-per-slide chips as given; a deck-level decision shows a chip as given only where the frame's match is for the applied template itself
 *         (that match IS the applied template's own for the slide) or the matches are all the applied template's own (a fresh match, or an Undo back to it: "New in your theme" where nothing matched);
 *         after a switch the frame still carries the first match's chips, so the slide reads "From <applied name>" and never another template's name.
 */
export function templateChips(frame: TemplateMatchFrame | null): Map<number, TemplateChip> {
  const chips = new Map<number, TemplateChip>()
  if (!templateInUse(frame)) return chips
  const applied = frame.applied_template
  const name = applied?.name ?? ''
  const built = new Set(frame.built_slide_ids)
  const recorded = (row: TemplateMatchSlide): TemplateChip => (row.match ? matchChip(row.match, name) : themeChip())
  if (!applied) {
    frame.slides.forEach((row, index) => chips.set(slidePosition(row.slide_id, index), recorded(row)))
    return chips
  }
  frame.slides.forEach((row, index) => {
    if (built.has(row.slide_id)) chips.set(slidePosition(row.slide_id, index), recorded(row))
  })
  const item = appliedDeckItem(frame)
  if (!item) return chips // 1.
  if (frame.slides.some(row => row.applied_match !== undefined)) { // 2.
    frame.slides.forEach((row, index) => {
      if (!built.has(row.slide_id)) chips.set(slidePosition(row.slide_id, index), row.applied_match ? matchChip(row.applied_match, name) : themeChip())
    })
    return chips
  }
  if (item.slides) { // 3.
    item.slides.forEach((row, index) => {
      if (!built.has(row.slide_id)) chips.set(slidePosition(row.slide_id, index), recorded(row))
    })
    return chips
  }
  // 4. v0: are the best-per-slide rows the applied template's? (a fresh match, or every match of theirs is for it)
  const matches = frame.slides.filter(row => row.match !== null)
  const forApplied = frame.reason === 'match' || (matches.length > 0 && matches.every(row => row.match?.template_id === applied.template_id))
  frame.slides.forEach((row, index) => {
    if (built.has(row.slide_id)) return
    let chip: TemplateChip
    if (applied.decision === 'slides') chip = recorded(row)
    else if (row.match && row.match.template_id === applied.template_id) chip = matchChip(row.match, name)
    else chip = forApplied && row.match === null ? themeChip() : fromChip(name)
    chips.set(slidePosition(row.slide_id, index), chip)
  })
  return chips
}

// ---------------------------------------------------------------------------
// The picker's rows ("Use with this deck")
// ---------------------------------------------------------------------------

export interface TemplatePickerRow {
  /** null: the "No template" row. */
  templateId: string | null
  name: string
  /** "Yours" / "Library" (never a score or a Fit %). */
  owner: string | null
  /** The matcher's reason, word for word; for "No template", its own line. */
  why: string | null
  /** "7 of 8 slides". */
  coverage: string | null
  inUse: boolean
}

/** Whether the group is drawn: a match with candidates and auto-apply ON (off means no template at all, PK). */
export function pickerAvailable(frame: TemplateMatchFrame | null): frame is TemplateMatchFrame {
  return Boolean(frame && frame.status === 'matched' && frame.auto_apply && frame.deck.length > 0)
}

/** The candidates (top 3, best first) and a last "No template" row. The one in use says so. */
export function pickerRows(frame: TemplateMatchFrame | null): TemplatePickerRow[] {
  if (!pickerAvailable(frame)) return []
  const inUseId = frame.applied && frame.applied_template ? frame.applied_template.template_id : null
  const rows: TemplatePickerRow[] = frame.deck.map(item => ({
    templateId: item.template_id, name: item.name,
    owner: item.owner === 'user' ? TEMPLATE_MATCH_WORDS.yours : item.owner === 'library' ? TEMPLATE_MATCH_WORDS.library : null,
    why: item.reason, coverage: coverageText(coverageOf(item)),
    inUse: inUseId === item.template_id,
  }))
  rows.push({ templateId: null, name: TEMPLATE_MATCH_WORDS.none, owner: null, why: TEMPLATE_MATCH_WORDS.noneWhy, coverage: null, inUse: inUseId === null })
  return rows
}

/** The row a fresh group has picked: the first one that is not in use (the button is then useful at once), else none. */
export function defaultPickerChoice(rows: readonly TemplatePickerRow[]): string | null | undefined {
  const row = rows.find(candidate => !candidate.inUse)
  return row ? row.templateId : undefined
}

// ---------------------------------------------------------------------------
// The wire: capabilities and the two outbound messages
// ---------------------------------------------------------------------------

/** `caps` (a user_message's client_caps) with template_match1 last, once. Anything that is not a string is dropped. */
export function withTemplateMatchCap(caps: unknown): string[] {
  const list = Array.isArray(caps) ? caps.filter((cap): cap is string => typeof cap === 'string') : []
  return [...list.filter(cap => cap !== TEMPLATE_MATCH_CAP), TEMPLATE_MATCH_CAP]
}

/** { type: "template_auto_apply", data: { enabled, client_caps } } : the same shape as user_message (`data`, not `payload`). */
export function templateAutoApplyMessage(enabled: boolean, caps: unknown): { type: 'template_auto_apply'; data: { enabled: boolean; client_caps: string[] } } {
  return { type: TEMPLATE_AUTO_APPLY_TYPE, data: { enabled: enabled === true, client_caps: withTemplateMatchCap(caps) } }
}

/** { type: "template_switch", data: { template_id: string | null, client_caps } } : null = no template for the slides not built yet (the auto-apply preference is untouched). */
export function templateSwitchMessage(templateId: string | null, caps: unknown): { type: 'template_switch'; data: { template_id: string | null; client_caps: string[] } } {
  return { type: TEMPLATE_SWITCH_TYPE, data: { template_id: typeof templateId === 'string' && templateId !== '' ? templateId : null, client_caps: withTemplateMatchCap(caps) } }
}

// ---------------------------------------------------------------------------
// The preference: auto-apply, per user on this device
// ---------------------------------------------------------------------------

export const TEMPLATE_AUTO_APPLY_STORAGE_KEY = 'studio.templateAutoApply.v1'
/** The key of the one JSON object { "<user>": boolean } under TEMPLATE_AUTO_APPLY_STORAGE_KEY, for a visitor with no user id. */
export const TEMPLATE_AUTO_APPLY_ANONYMOUS = '_'

/** The part of window.localStorage this needs; every call may throw (private mode, blocked storage, a full disk) and is wrapped. */
export interface TemplatePreferenceStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

const userKeyOf = (user: unknown): string => (typeof user === 'string' && user.trim() !== '' ? user.trim().slice(0, 200) : TEMPLATE_AUTO_APPLY_ANONYMOUS)

function readMap(storage: TemplatePreferenceStorage): Record<string, boolean> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(TEMPLATE_AUTO_APPLY_STORAGE_KEY) ?? 'null')
    if (!isRecord(parsed)) return {}
    const out: Record<string, boolean> = {}
    for (const [key, value] of Object.entries(parsed)) if (typeof value === 'boolean') out[key] = value
    return out
  } catch {
    return {}
  }
}

/** The user's preference: ON unless they switched it off here. Every failure (no storage, a throwing getItem, bad JSON, a wrong shape) reads as ON. */
export function readAutoApplyPreference(storage: TemplatePreferenceStorage | null | undefined, user: unknown): boolean {
  if (!storage) return true
  try {
    const map = readMap(storage)
    const key = userKeyOf(user)
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] === true : true
  } catch {
    return true
  }
}

/** Saves the preference for the user and leaves other users' as they are. Returns whether it was saved; it never throws. */
export function writeAutoApplyPreference(storage: TemplatePreferenceStorage | null | undefined, user: unknown, enabled: boolean): boolean {
  if (!storage) return false
  try {
    storage.setItem(TEMPLATE_AUTO_APPLY_STORAGE_KEY, JSON.stringify({ ...readMap(storage), [userKeyOf(user)]: enabled === true }))
    return true
  } catch {
    return false
  }
}
