// PASS2-PAGES publish flow + public viewer (E2E-1 read, streams/ops/PASS2-PAGES/publish.md; PROGRAM-1's rulings, ops/program/pass2-designs, table D, replace the
// "third option" column): the "move to mock" rows PUB-01 (one audience vocabulary), PUB-02 (masked passcode with a counter), PUB-06 (recording defaults off and
// shows an estimate before anything is charged), PUB-07 (no script request without a session length), PUB-10 (the done screen carries the link), VIEW-07 (the
// narrated run's Ask popover on the viewer tokens) and VIEW-04 (the viewer follows the visitor's system theme when nothing is stored), and the ruled "build" rows
// PUB-04 (one line on the Questions step), PUB-08 (on/off capability rows beside the real thumbnail), PUB-11 (question, waiting and narration facts, a badge on
// the Questions tab), PUB-15 (the Viewer page tab: first slide plus the same rows) and PUB-03 ("build, limited": the slide count only; see SUBTITLE below).
// PUB-16 (Unblock / Remove from FAQ) has its own flag, and so does the viewer-link origin (NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL).
// Flag NEXT_PUBLIC_STUDIO_P2_PUBLISH: exact "true", Studio shell only (NEXT_PUBLIC_STUDIO_V4_SHELL), default off. Off: every surface is exactly as before
// and nothing here is read.
// Import-free on purpose, so scripts/test-studio-p2-publish.mjs can run the real file in a bare vm.

export const STUDIO_P2_PUBLISH_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH === 'true'

// PUB-16 is its own flag (NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX, same rules): it adds a join to the owner's questions route and two actions on public
// FAQ text / a blocked asker, so it can be switched off without touching the wizard rows above.
export const STUDIO_P2_PUBLISH_INBOX_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX === 'true'

// The published link's base (lib/publish/serialize.ts getPublicAppUrl) falls back to https://deckster.xyz when NEXT_PUBLIC_APP_URL is unset, so on a dev or UAT
// deployment that has not set it every viewer link points at production. With this flag (same rules, its own switch) the base is the origin the owner is on: the
// request's on the server, window.location.origin in the browser. NEXT_PUBLIC_APP_URL, when set, still wins. OPS-1 can also just set NEXT_PUBLIC_APP_URL on Studio dev/UAT.
export const STUDIO_P2_PUBLISH_ORIGIN_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL === 'true'

// ---- PUB-01: one vocabulary for the same choice, in every step (the mock's words) -------------------------------------------------------

export type PublishAudienceValue = 'unlisted' | 'public' | 'restricted'

export const AUDIENCE_COPY: Record<PublishAudienceValue, { title: string; hint: string; stays: string }> = {
  unlisted: { title: 'Anyone with the link', hint: 'Not indexed. You choose who gets the address.', stays: 'link-only' },
  public: { title: 'Anyone — listed publicly', hint: 'Search engines may index it. There is no public gallery.', stays: 'public' },
  restricted: { title: 'Only people with a passcode', hint: 'Viewers see the title, then enter a passcode.', stays: 'locked' },
}

/** The copy for a saved or chosen visibility, or null for a value this build does not know (the caller then says "not confirmed"). */
export function audienceCopy(visibility: string | null | undefined): { title: string; hint: string; stays: string } | null {
  return visibility === 'unlisted' || visibility === 'public' || visibility === 'restricted' ? AUDIENCE_COPY[visibility] : null
}

// ---- PUB-02: the passcode the server accepts (lib/publish/passcode.ts MIN_PASSCODE_LENGTH, enforced at app/api/publish/route.ts:77) ------

export const PASSCODE_MIN_LENGTH = 6

/** How many characters short a TYPED passcode is; 0 for an empty field (empty is "unchanged" or "not set", which the callers already handle). */
export function passcodeShortBy(passcode: string): number {
  return passcode.length > 0 && passcode.length < PASSCODE_MIN_LENGTH ? PASSCODE_MIN_LENGTH - passcode.length : 0
}

/** The counter under the field, or null once the passcode is long enough (or empty). */
export function passcodeCounter(passcode: string): string | null {
  const short = passcodeShortBy(passcode)
  return short > 0 ? `${short} more character${short === 1 ? '' : 's'} needed` : null
}

// ---- PUB-06 / PUB-07: what the review step may send ----------------------------------------------------------------------------------

/** The most audio the recording can come to, in minutes, before the script exists. The full script is sized to the talking time, the shorter
 *  fallback to compressedMinutes (lib/narration/budget.ts), plus the closing line (the same CLOSING_MINUTES the voice picker prices with). */
export const CLOSING_MINUTES = 0.67

export interface RecordingBudget {
  narrationMinutes: number
  compressedMinutes: number
}

export interface RecordingEstimate {
  /** Audio the recording can come to, one decimal. */
  minutes: number
  /** Whole cents at the voice's measured rate, never below 1. */
  cents: number
  /** Audio segments (a full and a short version per slide, plus the closing), or null when the slide count is unknown. */
  segments: number | null
}

/** The estimate shown BEFORE publishing, when no script exists yet and the render route's own estimate (POST /api/narration/render with estimate:true,
 *  app/api/narration/render/route.ts) cannot answer. It is sized from the session length, so it is an upper bound on the script, labelled "up to" and
 *  checked again against the real script before anything is charged (recordingVerdict). Null when the session length or the voice rate is unknown. */
export function estimateRecording(
  budget: RecordingBudget | null | undefined,
  costPerMinuteUsd: number | null | undefined,
  slideCount: number | null | undefined
): RecordingEstimate | null {
  if (!budget || !(budget.narrationMinutes > 0) || !(budget.compressedMinutes >= 0)) return null
  if (typeof costPerMinuteUsd !== 'number' || !Number.isFinite(costPerMinuteUsd) || costPerMinuteUsd < 0) return null
  const minutes = budget.narrationMinutes + budget.compressedMinutes + CLOSING_MINUTES
  return {
    minutes: Math.round(minutes * 10) / 10,
    cents: Math.max(1, Math.ceil(minutes * costPerMinuteUsd * 100)),
    segments: typeof slideCount === 'number' && Number.isSafeInteger(slideCount) && slideCount > 0 ? slideCount * 2 + 1 : null,
  }
}

/** The voice the recording would use and its measured rate, from GET /api/narration/voice (the picker's own read). Null when the answer is unusable. */
export function voiceRateFrom(data: unknown): { name: string; costPerMinuteUsd: number } | null {
  const body = data as { voices?: unknown; effectiveVoiceId?: unknown } | null
  if (!body || typeof body !== 'object' || !Array.isArray(body.voices)) return null
  const voice = (body.voices as Array<Record<string, unknown>>).find(item => item && item.id === body.effectiveVoiceId)
  if (!voice || typeof voice.name !== 'string' || typeof voice.costPerMinuteUsd !== 'number' || !Number.isFinite(voice.costPerMinuteUsd)) return null
  return { name: voice.name, costPerMinuteUsd: voice.costPerMinuteUsd }
}

export interface PublishChoicesLike {
  narrationEnabled: boolean
  writeScript: boolean
  recordNarration: boolean
  recordConsentCents?: number | null
}

/** What the wizard hands to publish when the flag is on. No session length: no script request (the route answers 400 to it). Recording only
 *  with a script, a session length and the owner's tick on the estimate (recordConsentCents is the amount ticked, set by the estimate box and
 *  cleared when it goes away or its figure changes). Everything else is passed through untouched. */
export function publishChoicesFor<T extends PublishChoicesLike>(choices: T, hasBudget: boolean): T {
  const writeScript = choices.narrationEnabled && choices.writeScript && hasBudget
  const consented = typeof choices.recordConsentCents === 'number' && choices.recordConsentCents > 0
  return { ...choices, writeScript, recordNarration: choices.narrationEnabled && writeScript && choices.recordNarration && consented }
}

/** After the script is written, the render route's estimate (free) decides whether the recording may start: it must come back, and its figure must
 *  not be above what the owner ticked. Anything else leaves the recording for Voice, where the owner sees the real figure. */
export function recordingVerdict(consentCents: number | null | undefined, estimate: unknown): { proceed: boolean; detail?: string } {
  if (typeof consentCents !== 'number' || !(consentCents > 0)) return { proceed: false, detail: 'No estimate was confirmed, so nothing was recorded. Record it from Voice.' }
  const body = estimate as { estimatedCents?: unknown; error?: unknown } | null
  const exact = body && typeof body === 'object' ? body.estimatedCents : undefined
  if (typeof exact !== 'number' || !Number.isFinite(exact) || exact < 0) {
    return { proceed: false, detail: 'The price could not be checked, so nothing was recorded. Record it from Voice.' }
  }
  if (exact > consentCents) {
    return { proceed: false, detail: `The script came to ${exact}¢, above the ${consentCents}¢ you confirmed, so nothing was recorded. Confirm it from Voice.` }
  }
  return { proceed: true }
}

// ---- VIEW-04: which pages follow the visitor's system theme -----------------------------------------------------------------------------

/** The public viewer and its answer pages: /p/<slug> and /p/<slug>/q/<token>. */
export function isPublishedViewerPath(pathname: string | null | undefined): boolean {
  return typeof pathname === 'string' && /^\/p\/[^/]+/.test(pathname)
}

/** The default theme (what a visitor with nothing stored gets). Only the viewer pages change, and only with the flag on; a stored choice still wins
 *  because next-themes reads storage before it reads the default. */
export function viewerDefaultTheme(pathname: string | null | undefined, enabled: boolean, fallback: string | undefined): string | undefined {
  return enabled && isPublishedViewerPath(pathname) ? 'system' : fallback
}

// ---- PUB-16: which actions an owner's question row offers ---------------------------------------------------------------------------------

export interface InboxQuestionLike {
  status: string
  ownerAnswer?: string | null
  faqItemId?: unknown
}

/** The FAQ entry a question was promoted to, or null. Only a non-empty string counts. */
export function faqItemIdOf(item: InboxQuestionLike): string | null {
  return typeof item.faqItemId === 'string' && item.faqItemId.length > 0 ? item.faqItemId : null
}

/** A blocked row has no actions today; with the flag it can be unblocked. A row in the FAQ can be taken out of it. */
export function inboxRowActions(item: InboxQuestionLike): { unblock: boolean; removeFromFaq: boolean; publishToFaq: boolean; answer: boolean } {
  const blocked = item.status === 'blocked'
  const inFaq = faqItemIdOf(item) !== null
  return { unblock: blocked, removeFromFaq: !blocked && inFaq, publishToFaq: !blocked && !inFaq, answer: !blocked }
}

// ---- PUB-03 (build, limited): the dialog subtitle shows the slide count ---------------------------------------------------------------------
//
// SUBTITLE. PROGRAM-1's ruling: show the visible slide count, and add "hidden slides and notes stay private" ONLY after the code is checked to leave them out.
// Checked (Layout uat snapshot_presentation, server.py: a verbatim copy.deepcopy of the stored deck; models.py: script and speaker_notes "travel with publish
// snapshots because they live in the deck JSON"; Downloads writes speaker_notes into the PPTX notes pane): speaker notes ARE in the published copy, and a viewer
// who may download the PowerPoint receives them. A slide cannot be hidden in Studio at all, so there is no hidden-slide state to promise about. So the sentence is
// NOT added: it would be false. Making it true is a Layout / Downloads change (strip notes at snapshot, or at the published export), not a Studio one.

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

/** "12 slides", "1 slide", or null for anything that is not a positive whole number. */
export function slideCountPhrase(count: unknown): string | null {
  return typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? plural(count, 'slide') : null
}

/** The dialog's subtitle with the flag on. `live`: a published copy exists (its count is the frozen copy's); otherwise the count is the deck's own. */
export function dialogSubtitle(input: { live: boolean; title: string | null | undefined; slideCount: number | null | undefined }): string {
  const count = slideCountPhrase(input.slideCount)
  const title = input.title ? `“${input.title}”` : null
  if (input.live) {
    const tail = title ? 'Anyone with access can view its frozen published copy.' : 'Anyone with access can view a frozen copy of this deck.'
    return [title, count, tail].filter(Boolean).join(' · ')
  }
  return `Share a view-only copy of ${title ?? 'this deck'} at a Deckster link.${count ? ` Viewers will see ${count}.` : ''}`
}

// ---- PUB-04: the Questions step stays short ----------------------------------------------------------------------------------------------------

export const QUESTIONS_AFTER_PUBLISH_NOTE = 'Style, limits and sources are set in Questions after you publish.'

// ---- PUB-08 / PUB-15: what the viewer page offers, one on/off row per choice ------------------------------------------------------------------

export type CapabilityId = 'lock' | 'index' | 'present' | 'ask' | 'pdf' | 'pptx' | 'narration'

export interface CapabilityRow {
  id: CapabilityId
  label: string
  on: boolean
  note: string
}

export interface CapabilityInput {
  visibility?: unknown
  allowPdf?: unknown
  allowPptx?: unknown
  qaEnabled?: unknown
  qaAutoAnswer?: unknown
  narrationEnabled?: unknown
}

/** One row per thing the viewer page really does, from the choices (wizard) or the saved record (Viewer page tab). A value that is not a plain true / false
 *  (or, for the audience, one of the three this build knows) gets NO row: "only list what actually works" includes not claiming what was not confirmed.
 *  Not listed on purpose: asking aloud (needs a live voice that the owner cannot check from here) and anything about hidden slides or notes (see SUBTITLE). */
export function capabilityRows(input: CapabilityInput): CapabilityRow[] {
  const rows: CapabilityRow[] = []
  const known = input.visibility === 'unlisted' || input.visibility === 'public' || input.visibility === 'restricted'
  if (known) {
    const locked = input.visibility === 'restricted'
    rows.push({ id: 'lock', label: 'Passcode lock', on: locked, note: locked ? 'Viewers enter the passcode before they see a slide.' : 'Anyone who has the link can open it.' })
    const listed = input.visibility === 'public'
    rows.push({ id: 'index', label: 'Search engines', on: listed, note: listed ? 'They may index the page. There is no public gallery.' : 'The page asks search engines not to index it.' })
  }
  rows.push({ id: 'present', label: 'Full-screen slides', on: true, note: 'Viewers can open the frozen copy full screen.' })
  if (typeof input.qaEnabled === 'boolean') {
    rows.push({
      id: 'ask',
      label: 'Ask questions',
      on: input.qaEnabled,
      note: !input.qaEnabled ? 'New questions are switched off.'
        : input.qaAutoAnswer === false ? 'Every question comes to you.'
        : input.qaAutoAnswer === true ? 'Answers come from the deck; the rest come to you.'
        : 'Viewers can ask; what the deck cannot answer comes to you.',
    })
  }
  if (typeof input.allowPdf === 'boolean') rows.push({ id: 'pdf', label: 'PDF download', on: input.allowPdf, note: input.allowPdf ? 'Viewers can save a PDF of the published copy.' : 'No PDF button for viewers.' })
  if (typeof input.allowPptx === 'boolean') rows.push({ id: 'pptx', label: 'PowerPoint download', on: input.allowPptx, note: input.allowPptx ? 'Viewers can save an editable PowerPoint.' : 'No PowerPoint button for viewers.' })
  if (typeof input.narrationEnabled === 'boolean') {
    rows.push({
      id: 'narration',
      label: 'Narrated run',
      on: input.narrationEnabled,
      note: input.narrationEnabled ? 'Plays once a script and a recording exist. It never starts by itself.' : 'Viewers move through the slides themselves.',
    })
  }
  return rows
}

/** The line under the Viewer page tab's thumbnail. The image is the CURRENT deck's first slide (the existing preview, never a read of the frozen copy), so
 *  it says so unless the staleness check has shown the two match. */
export function viewerPreviewNote(staleness: string | null | undefined): string {
  if (staleness === 'current') return 'First slide of your deck. It matches the published copy at the last check.'
  if (staleness === 'stale') return 'First slide of your current deck. The published copy was frozen earlier and may differ; republish to update it.'
  if (staleness === 'checking') return 'First slide of your current deck. Checking whether it matches the published copy…'
  return 'First slide of your current deck. Whether it matches the published copy is not confirmed.'
}

// ---- PUB-11: what the owner sees about the published copy at a glance ----------------------------------------------------------------------

export interface QuestionCounts {
  total: number
  waiting: number
}

const wholeCount = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

/** GET /api/publish/{slug}/questions?summary=1 → { totalCount, unansweredCount }. Null for anything else (the facts then say less, never guess). */
export function parseQuestionCounts(data: unknown): QuestionCounts | null {
  const body = data as { totalCount?: unknown; unansweredCount?: unknown } | null
  if (!body || typeof body !== 'object') return null
  if (!wholeCount(body.totalCount) || !wholeCount(body.unansweredCount) || body.unansweredCount > body.totalCount) return null
  return { total: body.totalCount, waiting: body.unansweredCount }
}

/** "Questions: on · 3 asked · 1 waiting". The counts are the inbox's own (Notes > Q&A: waiting = not blocked and not yet answered by the owner). */
export function questionsFact(qaEnabled: boolean, counts: QuestionCounts | null): string {
  if (!qaEnabled) return 'Questions: off'
  if (!counts) return 'Questions: on'
  if (counts.total === 0) return 'Questions: on · none asked yet'
  return `Questions: on · ${counts.total} asked · ${counts.waiting > 0 ? `${counts.waiting} waiting` : 'none waiting'}`
}

/** The badge on the Questions tab: the number waiting on the owner, only when there is one. */
export function questionsBadge(counts: QuestionCounts | null): { text: string; label: string } | null {
  if (!counts || counts.waiting <= 0) return null
  return { text: counts.waiting > 9 ? '9+' : String(counts.waiting), label: `${plural(counts.waiting, 'question')} waiting` }
}

export interface NarrationState {
  voiceName: string | null
  /** Slides whose recording is ready and current. */
  recorded: number
  /** Slides with a script but no usable recording (none yet, or the script changed since). */
  needRecording: number
}

/** GET /api/narration/manifest?slug=… (the owner's own read of a published deck). Null when the answer does not have the manifest's shape. */
export function parseNarrationState(data: unknown): NarrationState | null {
  const body = data as { voiceName?: unknown; slides?: unknown; missing?: unknown } | null
  if (!body || typeof body !== 'object' || !Array.isArray(body.slides) || !wholeCount(body.missing)) return null
  const recorded = (body.slides as Array<Record<string, unknown> | null>).filter(slide => slide && typeof slide.full === 'string' && slide.full.length > 0).length
  const voiceName = typeof body.voiceName === 'string' && body.voiceName.trim() ? body.voiceName.trim() : null
  return { voiceName, recorded, needRecording: body.missing }
}

/** "Narration: on · Narrated by Alloy · 12 slides recorded". Off, or not read yet, it says only what is known. */
export function narrationFact(narrationEnabled: boolean, state: NarrationState | null): string {
  if (!narrationEnabled) return 'Narration: off'
  if (!state) return 'Narration: on'
  const parts = ['Narration: on']
  if (state.voiceName) parts.push(`Narrated by ${state.voiceName}`)
  if (state.recorded > 0 && state.needRecording > 0) parts.push(`${plural(state.recorded, 'slide')} recorded · ${state.needRecording} need recording`)
  else if (state.recorded > 0) parts.push(`${plural(state.recorded, 'slide')} recorded`)
  else if (state.needRecording > 0) parts.push(`${plural(state.needRecording, 'slide')} need recording`)
  else parts.push('no script yet')
  return parts.join(' · ')
}

// ---- the viewer link's origin (NEXT_PUBLIC_STUDIO_P2_PUBLISH_ORIGIN_URL) ---------------------------------------------------------------------------

const PRODUCTION_APP_URL = 'https://deckster.xyz'

/** `https://host[:port]` of an http(s) address, or null: no credentials, no other scheme, nothing unparseable. Paths, queries and fragments are dropped. */
export function cleanOrigin(value: unknown): string | null {
  if (typeof value !== 'string' || value.length === 0 || value.length > 300) return null
  let url: URL
  try { url = new URL(value) } catch { return null }
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username || url.password || !url.hostname) return null
  return url.origin
}

interface RequestLike {
  url: string
  headers: { get(name: string): string | null }
}

/** The origin the owner reached this server on: the proxy's forwarded host (and protocol) when it sent a usable one, else the request's own address. */
export function requestOrigin(request: RequestLike | null | undefined): string | null {
  if (!request) return null
  const first = (value: string | null) => (value ?? '').split(',')[0].trim()
  const host = first(request.headers.get('x-forwarded-host'))
  if (host) {
    const proto = first(request.headers.get('x-forwarded-proto')).toLowerCase()
    const forwarded = cleanOrigin(`${proto === 'http' || proto === 'https' ? proto : 'https'}://${host}`)
    if (forwarded) return forwarded
  }
  return cleanOrigin(request.url)
}

/** What the publish routes hand to serializePublishedDeck: the request's origin with the flag on, nothing (so nothing changes) with it off. */
export function linkOriginOf(request: RequestLike | null | undefined): string | undefined {
  return STUDIO_P2_PUBLISH_ORIGIN_ENABLED ? requestOrigin(request) ?? undefined : undefined
}

/** The base of a published link. NEXT_PUBLIC_APP_URL, when set, wins exactly as before; unset, the flag decides between the origin and production. */
export function publicBaseUrl(appUrl: string | undefined, origin: string | null | undefined, enabled: boolean): string {
  if (appUrl) return appUrl
  return (enabled ? cleanOrigin(origin) : null) ?? PRODUCTION_APP_URL
}

/** The link the browser shows for a record: the server's own (publicUrl) unless the flag is on, NEXT_PUBLIC_APP_URL is unset and the page knows where it is. */
export function viewerLinkFor(record: { slug: string; publicUrl: string }, appUrl: string | undefined, browserOrigin: string | null | undefined, enabled: boolean): string {
  if (!enabled || appUrl) return record.publicUrl
  const own = cleanOrigin(browserOrigin)
  return own && typeof record.slug === 'string' && /^[A-Za-z0-9_-]+$/.test(record.slug) ? `${own}/p/${record.slug}` : record.publicUrl
}
