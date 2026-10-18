// PASS2-PAGES publish flow + public viewer (E2E-1 read, streams/ops/PASS2-PAGES/publish.md): the "move to mock" rows PUB-01 (one audience vocabulary),
// PUB-02 (masked passcode with a counter), PUB-06 (recording defaults off and shows an estimate before anything is charged), PUB-07 (no script
// request without a session length), PUB-10 (the done screen carries the link), VIEW-07 (the narrated run's Ask popover on the viewer tokens) and
// VIEW-04 (the viewer follows the visitor's system theme when nothing is stored). PUB-16 (Unblock / Remove from FAQ) has its own flag.
// Flag NEXT_PUBLIC_STUDIO_P2_PUBLISH: exact "true", Studio shell only (NEXT_PUBLIC_STUDIO_V4_SHELL), default off. Off: every surface is exactly as before
// and nothing here is read.
// Import-free on purpose, so scripts/test-studio-p2-publish.mjs can run the real file in a bare vm.

export const STUDIO_P2_PUBLISH_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH === 'true'

// PUB-16 is its own flag (NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX, same rules): it adds a join to the owner's questions route and two actions on public
// FAQ text / a blocked asker, so it can be switched off without touching the wizard rows above.
export const STUDIO_P2_PUBLISH_INBOX_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true' && process.env.NEXT_PUBLIC_STUDIO_P2_PUBLISH_INBOX === 'true'

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
