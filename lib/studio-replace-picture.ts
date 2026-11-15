// REPLACE-PICTURE (FRONTEND-1; PK mandate M10 of 15 Nov 2026, "after return, decks stay editable, especially the pictures on title, section and closing slides"). Flag
// NEXT_PUBLIC_STUDIO_REPLACE_SLIDE_PICTURE (exact "true", default off, build-time); it acts only in the Studio shell (NEXT_PUBLIC_STUDIO_V4_SHELL). Off, components/presentation-viewer.tsx is byte for byte what it was.
//
// WHAT IT IS. A "Replace picture" action on the slide on screen. It sends Layout's viewer command setSlideBackgroundPicture (SLIDE-4, Layout Draft !294, flag LAYOUT_SLIDE_BACKGROUND_PICTURE_ENABLED; contract
// docs/api/SLIDE_BACKGROUND_PICTURE.md on branch slide4/background-picture-slot of the Layout repo). The new picture goes into the slide's own background slot, the slot every title / section / closing hero paints,
// and a whole-slide free picture Studio's older hero refine put over the slot is HIDDEN by Layout (never deleted); the reply lists what it hid.
//
// THE COMMAND. sendCommand(iframe, 'setSlideBackgroundPicture', { slide_index, slide_id?, url, alt? }, { timeoutMs: 20000 }): slide_index is the 0-based index of the slide in the stored deck; slide_id (the viewer's
// composeGetState read) makes Layout refuse the write when the slide at that index is not it (SLIDE_CHANGED); url is https, at most 2048 characters, printable ASCII, none of " ' ` \ < > ( ) [ ] { }, a host, no user info,
// a valid port; alt is at most 500 characters. The viewer may first wait for a pending autosave (up to 10 s), then writes and re-renders that one slide, so the reply takes up to about 20 s.
// Every failure carries a stable `code` (listed below); the viewer's own view-only guard answers error "view-only" with no code, which is VIEW_ONLY_PAGE; with Layout's flag off the viewer answers "Unknown action".
//
// WORDS. Nothing a person reads is a raw message: every code is mapped to plain words (REPLACE_PICTURE_WORDS). REPAINT_FAILED means the picture IS stored and only the redraw failed: the words say so and offer Reload deck.
// A timeout is the one answer that cannot say whether the picture was stored, and its words say that.
//
// WHEN IT IS OFF (the button is greyed with the reason): a build or a regenerate runs (Layout has no notion of a build, writes only queue behind each other, so Studio, which knows, disables the action), another
// slide change or an open element panel is busy, the tab is paused, Template Mode is on, the deck is read-only (a view-only frame, the outline preview, or a deck Layout just refused as read-only), or the slide is not a
// title / section / closing slide (a hero: Layout canvas_type H1s, H2, H3). A slide whose kind cannot be read stays available and Layout answers NO_BACKGROUND_PICTURE if it has no slot.
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-replace-picture.mjs transpiles this file into a bare vm context.

export const REPLACE_PICTURE_COMMAND = 'setSlideBackgroundPicture'
/** The reply budget: the command's own pending-save wait (10 s) plus the write and the re-render. */
export const REPLACE_PICTURE_TIMEOUT_MS = 20_000
export const REPLACE_PICTURE_URL_MAX = 2048
export const REPLACE_PICTURE_ALT_MAX = 500
/** The viewer read that says what kind of slide is on screen (the Add Element panel reads it too). */
export const REPLACE_PICTURE_KIND_COMMAND = 'getTemplateSlotCatalog'
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
  NO_BACKGROUND_PICTURE: 'This slide comes from a saved template, which has no background picture to replace.',
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

/** Carried on the Error the viewer bridge rejects with: only primitives, so no raw text leaks into the screen by accident. */
export interface PictureReplyDetail { code: string | null; stage: string | null; status: number | null; saved: boolean }

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/** What the viewer bridge rejects with for a failed setSlideBackgroundPicture reply: an Error (its message is for the console only) that carries the reply's code, stage, status and saved flag. */
export function replacePictureReplyError(reply: unknown): Error {
  const value = record(reply) ?? {}
  const error = new Error(typeof value.error === 'string' && value.error ? value.error : 'Command failed')
  const detail: PictureReplyDetail = {
    code: typeof value.code === 'string' && value.code ? value.code : null,
    stage: typeof value.stage === 'string' ? value.stage : null,
    status: typeof value.status === 'number' ? value.status : null,
    saved: value.saved === true,
  }
  ;(error as Error & { pictureReply?: PictureReplyDetail }).pictureReply = detail
  return error
}

/** The code a failure maps to: the reply's own code first; then the answers that carry none (the view-only guard, an unknown action, a timeout, no frame). */
export function readReplacePictureFailure(failure: unknown): { code: ReplacePictureCode; stored: boolean } {
  const reply = record(failure)
  const detail = (failure as { pictureReply?: PictureReplyDetail } | null)?.pictureReply ?? null
  const code = detail?.code ?? (reply && typeof reply.code === 'string' ? reply.code : null)
  const saved = detail?.saved === true || (reply !== null && reply.saved === true)
  if (isLayoutPictureCode(code)) return { code, stored: code === 'REPAINT_FAILED' || saved }
  const message = failure instanceof Error ? failure.message : typeof reply?.error === 'string' ? reply.error : typeof failure === 'string' ? failure : ''
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
  const { code, stored } = readReplacePictureFailure(value)
  return failureOutcome(code, stored)
}

export interface ReplacePictureDeps {
  /** The viewer bridge: sends one command and resolves with its reply or rejects with the failure. */
  send(action: string, params: Record<string, unknown>, options: { timeoutMs: number }): Promise<unknown>
}

/** Checks the inputs, sends the command once, and turns whatever came back into an outcome in plain words. Never throws. */
export async function runReplacePicture(deps: ReplacePictureDeps, input: { slideIndex: unknown; slideId?: unknown; url: unknown; alt?: unknown }): Promise<ReplacePictureOutcome> {
  const built = buildReplacePictureParams(input)
  if (!built.ok) return failureOutcome(built.code)
  try {
    return outcomeFromReply(await deps.send(REPLACE_PICTURE_COMMAND, { ...built.params }, { timeoutMs: REPLACE_PICTURE_TIMEOUT_MS }))
  } catch (failure) {
    const { code, stored } = readReplacePictureFailure(failure)
    return failureOutcome(code, stored)
  }
}

// ---------------------------------------------------------------- which slide, and when the action is off

/** A hero (title, section, closing) is any canvas_type that starts H and a digit: H1, H1s, H2, H3 and their long names. */
export function replacePictureSlideKind(canvasType: unknown): 'hero' | 'other' | 'unknown' {
  if (typeof canvasType !== 'string' || canvasType.trim() === '') return 'unknown'
  return /^H\d/i.test(canvasType.trim()) ? 'hero' : 'other'
}

/** The canvas_type in the viewer's slot-catalog reply, wherever the reply keeps it (the Add Element panel reads the same three places). */
export function canvasTypeFromCatalogReply(reply: unknown): string | null {
  const source = record(reply)
  if (!source) return null
  const payload = record(source.catalog ?? source.data) ?? source
  const found = payload.canvas_type ?? payload.canvasType
  return typeof found === 'string' && found.trim() !== '' ? found.trim() : null
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
  notHero: 'Replace picture works on title, section and closing slides. Select one of those.',
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
  slideKind: 'loading' | 'hero' | 'other' | 'unknown'
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
  if (a.slideKind === 'other') return REPLACE_PICTURE_REASONS.notHero
  if (a.slideKind === 'loading') return REPLACE_PICTURE_REASONS.checking
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
