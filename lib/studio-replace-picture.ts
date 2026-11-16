// REPLACE-PICTURE (FRONTEND-1; PK mandate M10 of 15 Nov 2026, "after return, decks stay editable, especially the pictures on title, section and closing slides"). Flag
// NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE (exact "true", default off, build-time); it acts only in the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). Off, components/presentation-viewer.tsx is byte for byte what it was.
//
// WHAT IT IS. A "Replace picture" action on the slide on screen. It sends Layout's viewer command setSlideBackgroundPicture (SLIDE-4, Layout Draft !294, flag LAYOUT_SLIDE_BACKGROUND_PICTURE_ENABLED; contract
// docs/api/SLIDE_BACKGROUND_PICTURE.md on branch slide4/background-picture-slot of the Layout repo; the follow-up below is Layout Draft !296, head 26283304). The new picture goes into the slide's own background slot, the slot every title / section / closing hero paints,
// and a whole-slide free picture Studio's older hero refine put over the slot is HIDDEN by Layout (never deleted); the reply lists what it hid.
//
// THE COMMAND. sendCommand(iframe, 'setSlideBackgroundPicture', { slide_index, slide_id?, url, alt? }, { timeoutMs: 20000 }): slide_index is the 0-based index of the slide in the stored deck; slide_id (the viewer's
// composeGetState read) makes Layout refuse the write when the slide at that index is not it (SLIDE_CHANGED); url is https, at most 2048 characters, printable ASCII, none of " ' ` \ < > ( ) [ ] { }, a host, no user info,
// a valid port; alt is at most 500 characters. The viewer may first wait for a pending autosave (at most 6 s since !296, past it SAVE_PENDING at once and nothing written), then writes and re-renders that one slide,
// so the reply normally comes within 6 s plus the write and the repaint; the 20 s budget stays as the outer bound (a write held up that long, for example behind a build's writes to the same deck).
// Every failure carries a stable `code` (listed below); the viewer's own view-only guard answers error "view-only" with no code, which is VIEW_ONLY_PAGE; with Layout's flag off the viewer answers "Unknown action".
// The viewer bridge (sendCommand) rejects with a plain Error and drops the reply's fields, and it is left exactly as it is: the hook watches the viewer's reply message for this one command and reads the code from it.
//
// WORDS. Nothing a person reads is a raw message: every code is mapped to plain words (REPLACE_PICTURE_WORDS). REPAINT_FAILED means the picture IS stored and only the redraw failed: the words say so and offer Reload deck.
// A timeout is the one answer that cannot say whether the picture was stored, and its words say that.
//
// WHEN IT IS OFF (the button is greyed with the reason): a build or a regenerate runs (Layout has no notion of a build, writes only queue behind each other, so Studio, which knows, disables the action), another
// slide change or an open element panel is busy, the tab is paused, Template Mode is on, the deck is read-only (a view-only frame, the outline preview, or a deck Layout just refused as read-only), or LAYOUT SAYS THE SLIDE
// CANNOT TAKE A PICTURE (below). A slide Layout does not list, or a read that failed, stays available: the route still decides at click time (SLIDE_CHANGED and the others stay mapped).
//
// LAYOUT !296 FOLLOW-UP (eligibility up front, progress). getTemplateSlotCatalog, the read this hook already makes for each slide, now answers (only on an edit page with Layout's flag on) backgroundPicture { enabled: true,
// slides: [{ slide_index, slide_id, eligible, reason: null | NO_BACKGROUND_PICTURE | PICTURE_DECLINED | VIEW_ONLY_PAGE, target: hero_slot | slide_background }] }, one entry per slide, by the route's own rules. Per slide: eligible, the
// button is on; not eligible, it is greyed with the reason's plain words (the code table below, minus its closing "Nothing changed.", since nothing was tried). NO backgroundPicture key (Layout's flag off, or an older Layout) greys
// every slide: "Replacing a picture is not turned on for this server yet." Layout's answer REPLACES the old title / section / closing guess (/^H\d/ on the canvas type): `target: slide_background` says a content slide can take a
// picture too (it becomes the slide's background), so Layout decides, and the hero guess is gone (with no key the button is greyed whatever the slide is, so it could never be reached). The viewer also posts
// {type: setSlideBackgroundPictureProgress, command, progress: true, stage: saving | writing | repainting, slide_index, commandRequestId} as each stage starts, with NO action and NO requestId key, so the bridge (which settles
// on the first message whose action matches) never takes one for the reply. The hook watches them (same trusted-origin check as the reply watch) and the dialog shows the stage in words. The id the bridge sends with the
// command is not visible to the hook, so a run is bound to the commandRequestId of its first "saving" event (the first thing a run that passes Layout's input checks posts) and later events must carry the same id.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-replace-picture.mjs transpiles this file into a bare vm context.

export const REPLACE_PICTURE_COMMAND = 'setSlideBackgroundPicture'
/** The reply budget: the command's own pending-save wait (capped at 6 s by Layout !296) plus the write and the re-render; unchanged, it stays the outer bound. */
export const REPLACE_PICTURE_TIMEOUT_MS = 20_000
export const REPLACE_PICTURE_URL_MAX = 2048
export const REPLACE_PICTURE_ALT_MAX = 500
/** The viewer read that also says which slides can take a picture (its backgroundPicture, Layout !296; the Add Element panel makes the same read). */
export const REPLACE_PICTURE_CATALOG_COMMAND = 'getTemplateSlotCatalog'
/** The viewer read that says which slide ids sit where (the same one the slide mutations read). */
export const REPLACE_PICTURE_ORDER_COMMAND = 'composeGetState'

export function replacePictureFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

/** The flag (a literal process.env read, so Next inlines it at build time). */
export const STUDIO_REPLACE_SLIDE_PICTURE_ENABLED = replacePictureFlagOn(process.env.NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE)

// ---------------------------------------------------------------- the codes

/** Every code Layout's contract lists: the viewer command's own and the route's, passed through (INVALID_BODY is the route's too). */
export const LAYOUT_PICTURE_CODES = [
  'INVALID_SLIDE_INDEX', 'INVALID_URL', 'INVALID_ALT', 'INVALID_SLIDE_ID', 'INVALID_BODY',
  'VIEW_ONLY_PAGE', 'PRESENTATION_NOT_FOUND', 'SLIDE_NOT_FOUND', 'VIEWER_UNAVAILABLE', 'SAVE_PENDING', 'NETWORK_ERROR',
  'READ_ONLY_SNAPSHOT', 'NOT_AUTHORIZED', 'ROUTE_UNAVAILABLE', 'WRITE_FAILED', 'REPAINT_FAILED',
  'SLIDE_CHANGED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'SLIDE_INDEX_OUT_OF_RANGE',
] as const
export type LayoutPictureCode = typeof LAYOUT_PICTURE_CODES[number]

/** What Studio itself can say when no Layout code came back. */
export const STUDIO_PICTURE_CODES = ['TIMED_OUT', 'LAYOUT_SWITCH_OFF', 'BUSY', 'UNKNOWN'] as const
export type StudioPictureCode = typeof STUDIO_PICTURE_CODES[number]
export type ReplacePictureCode = LayoutPictureCode | StudioPictureCode

/** Plain Studio words for every code. Nobody reads a raw message, a status or a stage. */
export const REPLACE_PICTURE_WORDS: Record<ReplacePictureCode, string> = {
  INVALID_SLIDE_INDEX: 'Studio could not tell which slide to change. Click the slide in the list and try again.',
  INVALID_URL: 'That link cannot be used. Use a full https:// link to a picture, with no spaces.',
  INVALID_ALT: 'The description is too long. Keep it to 500 characters or fewer.',
  INVALID_SLIDE_ID: 'Studio could not tell which slide to change. Click the slide in the list and try again.',
  INVALID_BODY: 'The change could not be read. Try again, and reload the deck if it keeps happening.',
  VIEW_ONLY_PAGE: 'This deck is open to view only, so its picture cannot be changed here.',
  PRESENTATION_NOT_FOUND: 'Studio could not find this deck. Reload the page and try again.',
  SLIDE_NOT_FOUND: 'That slide is not in the deck any more. Pick a slide and try again.',
  VIEWER_UNAVAILABLE: 'The slide view is not ready for this change. Reload the deck and try again.',
  SAVE_PENDING: 'Your recent edits are still saving. Press Save, wait for it to finish, then try again.',
  NETWORK_ERROR: 'The connection dropped before the picture was saved. Nothing changed. Check your connection and try again.',
  READ_ONLY_SNAPSHOT: 'This is a published copy, which cannot be changed. Open the editable deck to replace its picture.',
  NOT_AUTHORIZED: 'You do not have permission to change this deck. Sign in with the account that owns it.',
  ROUTE_UNAVAILABLE: 'Replacing a picture is not available on this server right now. Nothing changed.',
  WRITE_FAILED: 'The picture could not be saved. Nothing changed. Try again in a moment.',
  REPAINT_FAILED: 'The new picture is saved, but the slide could not redraw it. Reload the deck to see it.',
  SLIDE_CHANGED: 'This slide changed while you were working (it moved or was rebuilt). Select it again and try again.',
  NO_BACKGROUND_PICTURE: 'This slide comes from a saved template, which has no background picture to replace. Nothing changed.',
  PICTURE_DECLINED: 'This slide was designed without a picture, so a new one would not show. Choose another design for it to use a picture.',
  SLIDE_INDEX_OUT_OF_RANGE: 'That slide is not in the saved deck yet. Wait for the deck to finish saving, then try again.',
  TIMED_OUT: 'The slide view did not answer in 20 seconds. The picture may or may not have been saved. Reload the deck to check, then try again if it is not there.',
  LAYOUT_SWITCH_OFF: 'Replacing a picture is not turned on for this server yet. Nothing changed.',
  BUSY: 'Studio is finishing another change. Try again in a moment.',
  UNKNOWN: 'The picture could not be replaced. Try again in a moment, and reload the deck if it keeps happening.',
}

/** Codes after which "Reload deck" is the useful next step: the deck or the viewer is not in the state this change expected, or the picture is stored and only the redraw failed. */
const RELOAD_CODES: ReadonlySet<ReplacePictureCode> = new Set<ReplacePictureCode>([
  'REPAINT_FAILED', 'TIMED_OUT', 'VIEWER_UNAVAILABLE', 'PRESENTATION_NOT_FOUND', 'SLIDE_NOT_FOUND', 'SLIDE_INDEX_OUT_OF_RANGE', 'SLIDE_CHANGED', 'INVALID_BODY',
])
/** Codes after which writing the same picture again cannot help: it is stored already, or this deck / slide / server will refuse it again. */
const NO_RETRY_CODES: ReadonlySet<ReplacePictureCode> = new Set<ReplacePictureCode>([
  'REPAINT_FAILED', 'READ_ONLY_SNAPSHOT', 'VIEW_ONLY_PAGE', 'NOT_AUTHORIZED', 'NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'LAYOUT_SWITCH_OFF', 'ROUTE_UNAVAILABLE',
])
/** Codes that say this deck cannot be edited at all: the button then stays off for this deck. */
const READ_ONLY_CODES: ReadonlySet<ReplacePictureCode> = new Set<ReplacePictureCode>(['VIEW_ONLY_PAGE', 'READ_ONLY_SNAPSHOT'])

export function isLayoutPictureCode(value: unknown): value is LayoutPictureCode {
  return typeof value === 'string' && (LAYOUT_PICTURE_CODES as readonly string[]).includes(value)
}
export function isReadOnlyPictureCode(code: unknown): boolean {
  return typeof code === 'string' && READ_ONLY_CODES.has(code as ReplacePictureCode)
}

// ---------------------------------------------------------------- the inputs

const URL_UNSAFE = /[^\x21-\x7e]|["'`\\<>()[\]{}]/

export type PictureUrlProblem = 'empty' | 'not-https' | 'too-long' | 'characters' | 'no-host' | 'unusable'

/** What the person is told about a link Layout would refuse: one plain sentence per way a link can be wrong. */
export const PICTURE_URL_PROBLEM_WORDS: Record<PictureUrlProblem, string> = {
  empty: 'Paste the link to a picture.',
  'not-https': 'The link must start with https://',
  'too-long': 'The link is too long (2048 characters at most).',
  characters: 'The link has a space or a character that is not allowed (quotes, brackets, a backslash). Use the picture\'s plain web address.',
  'no-host': 'That does not look like a picture\'s web address. It needs a site name after https://, and no user name.',
  unusable: 'That does not look like a picture\'s web address.',
}

/** Layout's URL rule, the same one its route and its viewer command apply (slide_background_picture.valid_url): https, 2048 characters at most, printable ASCII without quotes or brackets, a host, no user info, a valid port. */
export function checkPictureUrl(raw: unknown): { ok: true; url: string } | { ok: false; problem: PictureUrlProblem } {
  const url = typeof raw === 'string' ? raw.trim() : ''
  if (url === '') return { ok: false, problem: 'empty' }
  if (url.length > REPLACE_PICTURE_URL_MAX) return { ok: false, problem: 'too-long' }
  if (url.slice(0, 8).toLowerCase() !== 'https://') return { ok: false, problem: 'not-https' }
  if (URL_UNSAFE.test(url)) return { ok: false, problem: 'characters' }
  const authority = url.slice(8).split(/[/?#]/)[0]
  if (!authority || authority.includes('@')) return { ok: false, problem: 'no-host' }
  if (typeof URL === 'function') {
    try {
      const parsed = new URL(url)
      if (parsed.protocol !== 'https:' || !parsed.hostname) return { ok: false, problem: 'no-host' }
    } catch {
      return { ok: false, problem: 'unusable' }
    }
  }
  return { ok: true, url }
}

export function checkPictureAlt(raw: unknown): { ok: true; alt: string | null } | { ok: false } {
  if (raw === undefined || raw === null) return { ok: true, alt: null }
  if (typeof raw !== 'string') return { ok: false }
  const alt = raw.trim()
  if (alt.length > REPLACE_PICTURE_ALT_MAX) return { ok: false }
  return { ok: true, alt: alt === '' ? null : alt }
}

export interface ReplacePictureParams {
  slide_index: number
  slide_id?: string
  url: string
  alt?: string
}

export type ReplacePictureParamsResult =
  | { ok: true; params: ReplacePictureParams }
  | { ok: false; code: 'INVALID_SLIDE_INDEX' | 'INVALID_URL' | 'INVALID_ALT' | 'INVALID_SLIDE_ID'; problem?: PictureUrlProblem }

/** The command's params, checked by Layout's own rules before anything is sent. The keys are the contract's: slide_index, slide_id (when known), url, alt (when given). */
export function buildReplacePictureParams(input: { slideIndex: unknown; slideId?: unknown; url: unknown; alt?: unknown }): ReplacePictureParamsResult {
  const index = input.slideIndex
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) return { ok: false, code: 'INVALID_SLIDE_INDEX' }
  const id = input.slideId
  if (id !== undefined && id !== null && (typeof id !== 'string' || id === '')) return { ok: false, code: 'INVALID_SLIDE_ID' }
  const url = checkPictureUrl(input.url)
  if (!url.ok) return { ok: false, code: 'INVALID_URL', problem: url.problem }
  const alt = checkPictureAlt(input.alt)
  if (!alt.ok) return { ok: false, code: 'INVALID_ALT' }
  return { ok: true, params: { slide_index: index, ...(typeof id === 'string' ? { slide_id: id } : {}), url: url.url, ...(alt.alt !== null ? { alt: alt.alt } : {}) } }
}

// ---------------------------------------------------------------- the answers

export type ReplacePictureOutcome =
  | { ok: true; hiddenCount: number; words: string; note: string | null }
  | { ok: false; code: ReplacePictureCode; words: string; stored: boolean; reload: boolean; retry: boolean }

export const REPLACE_PICTURE_DONE_WORDS = 'Picture replaced.'

export function hiddenPictureNote(count: number): string | null {
  if (!Number.isInteger(count) || count < 1) return null
  const what = count === 1 ? 'A picture that covered the whole slide was' : `${count} pictures that covered the whole slide were`
  return `${what} hidden, not deleted. Restoring an earlier version of the deck brings it back.`
}

export function failureOutcome(code: ReplacePictureCode, stored = code === 'REPAINT_FAILED'): ReplacePictureOutcome {
  return { ok: false, code, words: REPLACE_PICTURE_WORDS[code], stored, reload: RELOAD_CODES.has(code), retry: !NO_RETRY_CODES.has(code) }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/**
 * The code a failure maps to. The viewer bridge rejects with a plain Error (its message is for the console only, and it carries no code), so the hook also watches the viewer's own reply message and hands it
 * here as `reply`: its code first (and its `saved` flag), then what carries no code (the view-only guard's "view-only", an "Unknown action", a timeout, no frame).
 */
export function readReplacePictureFailure(failure: unknown, reply: unknown = null): { code: ReplacePictureCode; stored: boolean } {
  const own = record(failure)
  const seen = record(reply) ?? (own !== null && typeof own.message !== 'string' ? own : null)
  const code = seen && typeof seen.code === 'string' ? seen.code : null
  const saved = seen !== null && seen.saved === true
  if (isLayoutPictureCode(code)) return { code, stored: code === 'REPAINT_FAILED' || saved }
  const message = typeof seen?.error === 'string' ? seen.error : typeof own?.message === 'string' ? own.message : typeof failure === 'string' ? failure : ''
  if (/^view-only$/i.test(message.trim())) return { code: 'VIEW_ONLY_PAGE', stored: false }
  if (/^unknown action/i.test(message.trim())) return { code: 'LAYOUT_SWITCH_OFF', stored: false }
  if (/command timeout/i.test(message)) return { code: 'TIMED_OUT', stored: false }
  if (/iframe not ready|no configured viewer origin|layout service/i.test(message)) return { code: 'VIEWER_UNAVAILABLE', stored: false }
  return { code: 'UNKNOWN', stored: saved }
}

/** A reply that came back (resolved) as an outcome. */
export function outcomeFromReply(reply: unknown): ReplacePictureOutcome {
  const value = record(reply)
  if (value && value.success === true) {
    const hidden = Array.isArray(value.hidden_image_ids) ? value.hidden_image_ids.length : 0
    return { ok: true, hiddenCount: hidden, words: REPLACE_PICTURE_DONE_WORDS, note: hiddenPictureNote(hidden) }
  }
  const { code, stored } = readReplacePictureFailure(null, value)
  return failureOutcome(code, stored)
}

export interface ReplacePictureDeps {
  /** The viewer bridge: sends one command and resolves with its reply or rejects with the failure. */
  send(action: string, params: Record<string, unknown>, options: { timeoutMs: number }): Promise<unknown>
  /** The viewer's own reply message for this command, as the hook saw it arrive (the bridge's rejection carries only text): its code is what the words come from. null when none came. */
  observed?(): unknown
}

/** Checks the inputs, sends the command once, and turns whatever came back into an outcome in plain words. Never throws. */
export async function runReplacePicture(deps: ReplacePictureDeps, input: { slideIndex: unknown; slideId?: unknown; url: unknown; alt?: unknown }): Promise<ReplacePictureOutcome> {
  const built = buildReplacePictureParams(input)
  if (!built.ok) return failureOutcome(built.code)
  try {
    return outcomeFromReply(await deps.send(REPLACE_PICTURE_COMMAND, { ...built.params }, { timeoutMs: REPLACE_PICTURE_TIMEOUT_MS }))
  } catch (failure) {
    const { code, stored } = readReplacePictureFailure(failure, deps.observed?.() ?? null)
    return failureOutcome(code, stored)
  }
}

// ---------------------------------------------------------------- which slide, and when the action is off

// ---------------------------------------------------------------- up front: which slides can take a picture (Layout !296)

/** The refusals Layout reports up front: the route's own (slide_refusal), and VIEW_ONLY_PAGE for every slide of a view-only page. */
export const PICTURE_ELIGIBILITY_REASONS = ['NO_BACKGROUND_PICTURE', 'PICTURE_DECLINED', 'VIEW_ONLY_PAGE'] as const
export type PictureEligibilityReason = typeof PICTURE_ELIGIBILITY_REASONS[number]
/** Where the picture goes: a title / section / closing slide's own picture slot, or any other slide's background. */
export type PictureTarget = 'hero_slot' | 'slide_background'

export type SlideEligibility =
  /** Not read yet for this slide. */
  | { state: 'loading' }
  /** Layout's answer has no usable backgroundPicture: its flag is off or it is an older Layout. The button is greyed. */
  | { state: 'absent' }
  /** The read failed, or Layout's report does not list this slide: nothing is known, the button stays available and the route decides at click time. */
  | { state: 'unknown' }
  | { state: 'known'; eligible: boolean; reason: PictureEligibilityReason | null; target: PictureTarget | null }

/** A refusal's words for a button greyed BEFORE any click: the code table's sentence without its closing "Nothing changed." (nothing has been tried yet). */
export function upfrontWords(code: ReplacePictureCode): string {
  return REPLACE_PICTURE_WORDS[code].replace(/\s*Nothing changed\.$/, '')
}

/** What the dialog says about where the picture goes, by target (the hide sentence belongs to a title / section / closing slide only; a slide whose target is not known gets the plain one). */
export const REPLACE_PICTURE_TARGET_WORDS: Record<PictureTarget | 'unknown', string> = {
  hero_slot: 'The new picture goes into the slide\'s own picture area. A picture that covers the whole slide is hidden, never deleted.',
  slide_background: 'The new picture becomes this slide\'s background. Pictures already on the slide stay as they are.',
  unknown: 'The new picture goes into the slide\'s own picture area.',
}

/** The slide-catalog reply's report for the slide at `slideIndex`. Only the top-level `backgroundPicture` key counts (the contract's place for it). */
export function readSlideEligibility(reply: unknown, slideIndex: number): SlideEligibility {
  const source = record(reply)
  if (!source) return { state: 'unknown' }
  const report = record(source.backgroundPicture)
  if (!report || report.enabled !== true || !Array.isArray(report.slides)) return { state: 'absent' }
  const entry = report.slides.map(record).find(item => item !== null && item.slide_index === slideIndex)
  if (!entry || typeof entry.eligible !== 'boolean') return { state: 'unknown' }
  const target = entry.target === 'hero_slot' || entry.target === 'slide_background' ? entry.target : null
  const reason = (PICTURE_ELIGIBILITY_REASONS as readonly unknown[]).includes(entry.reason) ? entry.reason as PictureEligibilityReason : null
  return { state: 'known', eligible: entry.eligible, reason: entry.eligible ? null : reason, target }
}

// ---------------------------------------------------------------- progress (Layout !296)

/** The interim event's type, and its stages in the order a run enters them. */
export const REPLACE_PICTURE_PROGRESS_TYPE = 'setSlideBackgroundPictureProgress'
export const REPLACE_PICTURE_STAGES = ['saving', 'writing', 'repainting'] as const
export type ReplacePictureStage = typeof REPLACE_PICTURE_STAGES[number]

/** What the dialog says while each stage runs. The stage name itself is never shown. */
export const REPLACE_PICTURE_STAGE_WORDS: Record<ReplacePictureStage, string> = {
  saving: 'Saving your edits\u2026',
  writing: 'Saving the picture\u2026',
  repainting: 'Redrawing the slide\u2026',
}

export interface ReplacePictureProgressTracker {
  /** The stage a message announces for THIS run, or null when it is not one of this run's progress events. */
  accept(data: unknown): ReplacePictureStage | null
}

/**
 * Reads one run's progress events. An event counts only when it is the contract's: type setSlideBackgroundPictureProgress, command setSlideBackgroundPicture, progress true, a known stage, this slide's index,
 * and NO action and NO requestId key (those mark a reply, which the bridge settles on, never a progress event). The id the bridge sent is not visible here, so the run is bound to the commandRequestId of its
 * first "saving" event (the first event of any run that gets past Layout's input checks, posted before the run can do anything else) and every later event must carry that id: an event of an earlier run that
 * outlived its dialog (a different id), or one that arrives before the run has begun, is ignored. A stage never goes backwards (a repeated or late event is ignored).
 */
export function createProgressTracker(slideIndex: number): ReplacePictureProgressTracker {
  let runId: string | null = null
  let last = -1
  return {
    accept(data: unknown) {
      const event = record(data)
      if (!event || event.type !== REPLACE_PICTURE_PROGRESS_TYPE || event.command !== REPLACE_PICTURE_COMMAND || event.progress !== true) return null
      if ('action' in event || 'requestId' in event) return null
      const at = (REPLACE_PICTURE_STAGES as readonly unknown[]).indexOf(event.stage)
      if (at < 0 || event.slide_index !== slideIndex) return null
      const id = event.commandRequestId
      if (typeof id !== 'string' || id === '') return null
      if (runId === null) { if (at !== 0) return null; runId = id } else if (id !== runId) return null
      if (at <= last) return null
      last = at
      return REPLACE_PICTURE_STAGES[at]
    },
  }
}

/** The id of the slide at `index` and whether the viewer is on it, read from a composeGetState reply (the strict reading the slide mutations use is not needed: only the ids and the current index are). */
export function slideIdentityFromOrder(reply: unknown, index: number): { slideId: string | null; onSlide: boolean | null } {
  const value = record(reply)
  const slides = value && value.success === true && Array.isArray(value.slides) ? value.slides : null
  if (!slides) return { slideId: null, onSlide: null }
  const entry = record(slides[index])
  const slideId = entry && typeof entry.slide_id === 'string' && entry.slide_id !== '' ? entry.slide_id : null
  const current = value && Number.isInteger(value.current_visual_index) ? value.current_visual_index as number : null
  return { slideId, onSlide: current === null ? null : current === index }
}

export const REPLACE_PICTURE_REASONS = {
  viewOnly: 'This deck is open to view only, so its picture cannot be replaced.',
  preview: 'This is the outline preview. Replace picture works on the built deck.',
  paused: 'This tab is paused because the deck is open in another tab.',
  template: 'Turn off Template Mode to replace a picture.',
  building: 'A build is running. Replace picture is available when it finishes.',
  regenerating: 'This slide is being regenerated. Replace picture is available when it finishes.',
  busy: 'Studio is busy with another change. Replace picture is available when it finishes.',
  mutating: 'Another slide change is in progress. Replace picture is available when it finishes.',
  loading: 'The slide is still loading.',
  checking: 'Checking this slide.',
  notEligible: 'Replace picture is not available for this slide.',
  // Layout reports nothing about which slides can take a picture (its flag is off, or it is an older Layout): the table's LAYOUT_SWITCH_OFF sentence, as said before any click
  notOnYet: upfrontWords('LAYOUT_SWITCH_OFF'),
} as const

export interface ReplacePictureAvailability {
  /** The deck on screen is a built deck with a viewer frame. */
  deckOpen: boolean
  viewerReady: boolean
  /** The viewer's view-only frame URL, an outline preview, or a deck Layout just refused as read-only. */
  readOnly: 'view-only' | 'preview' | null
  /** The paused-tab sentence (ONE_LIVE_TAB), when this tab is paused. */
  tabPausedHint?: string | null
  templateMode: boolean
  /** A build fills the deck, or the generation overlay is up. */
  building: boolean
  /** A refine job runs on the slide on screen. */
  regeneratingThisSlide: boolean
  /** Any other Studio change in flight: another compose job, the open element panel, the viewer not safe. */
  studioBusy: boolean
  /** A native slide change (add, duplicate, delete, reorder, layout, or this one) is in flight. */
  mutationPending: boolean
  /** What Layout says about the slide on screen (readSlideEligibility): not read yet, no report at all, a report that does not list it, or its answer. */
  eligibility: SlideEligibility
}

/** Why Replace picture is off right now, in plain words; null when it is available. The order is the order of what the person can do about it first. */
export function replacePictureDisabledReason(a: ReplacePictureAvailability): string | null {
  if (a.readOnly === 'view-only') return REPLACE_PICTURE_REASONS.viewOnly
  if (a.readOnly === 'preview') return REPLACE_PICTURE_REASONS.preview
  if (typeof a.tabPausedHint === 'string' && a.tabPausedHint !== '') return a.tabPausedHint
  if (a.templateMode) return REPLACE_PICTURE_REASONS.template
  if (a.building) return REPLACE_PICTURE_REASONS.building
  if (a.regeneratingThisSlide) return REPLACE_PICTURE_REASONS.regenerating
  if (a.studioBusy) return REPLACE_PICTURE_REASONS.busy
  if (a.mutationPending) return REPLACE_PICTURE_REASONS.mutating
  if (!a.deckOpen || !a.viewerReady) return REPLACE_PICTURE_REASONS.loading
  if (a.eligibility.state === 'absent') return REPLACE_PICTURE_REASONS.notOnYet
  if (a.eligibility.state === 'known' && !a.eligibility.eligible) return a.eligibility.reason === null ? REPLACE_PICTURE_REASONS.notEligible : upfrontWords(a.eligibility.reason)
  if (a.eligibility.state === 'loading') return REPLACE_PICTURE_REASONS.checking
  return null
}

/** A refine job of this deck that is still building and targets the slide at `slideIndex` (by id when both sides have one, else by position): the same match the rail uses for its busy card. */
export function refineBuildingOnSlide(
  jobs: ReadonlyArray<{ kind?: string; status?: string; targetSlideId?: string | null; targetIndex?: number; targetLayoutIndex?: number }> | null | undefined,
  slide: { slideId: string | null; slideIndex: number },
): boolean {
  return (jobs ?? []).some(job => {
    if (job.kind !== 'refine' || job.status !== 'building') return false
    if (slide.slideId && job.targetSlideId) return slide.slideId === job.targetSlideId
    return job.targetLayoutIndex === slide.slideIndex || job.targetIndex === slide.slideIndex
  })
}

/** A viewer URL that opens the deck view-only. */
export function urlIsViewOnly(url: unknown): boolean {
  return typeof url === 'string' && /[?&]viewOnly=true(?:&|#|$)/i.test(url)
}
