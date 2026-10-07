/**
 * Studio v4 blocked-send feedback: pure helpers (no imports, no side effects).
 *
 * Context (J1.0, 7 Oct): a send the Builder refuses before it leaves (a plan
 * limit, an unfinished upload, a locked template) is explained only by an
 * ephemeral toast, the top-up dialog and the usage strip. Nothing in the chat
 * says that the message was NOT sent. With this flag on, the refusal also posts
 * one client-only notice at the end of the chat transcript, and the notice says
 * where the text is still waiting. It is never sent to the Director, never
 * persisted, and never changes the gate: the draft was always kept on a refusal
 * and still is.
 *
 * The flag is build-time: both public values are inlined into the client bundle,
 * so switching it needs a rebuild. Only the literal string "true" for BOTH turns
 * the feature on; anything else (including unset) is OFF.
 */

export function studioBlockedSendFeedbackFlagOn(shell: string | undefined, flag: string | undefined): boolean {
  return shell === 'true' && flag === 'true'
}

/** Literal `process.env.NEXT_PUBLIC_*` reads so Next inlines them at build time. */
export const STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED = studioBlockedSendFeedbackFlagOn(
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL,
  process.env.NEXT_PUBLIC_STUDIO_BLOCKED_SEND_FEEDBACK_ENABLED,
)

/**
 * `typed` = the composer box; `answers` = the Director question card (same preflight);
 * `action` = a card button that sends its label (the button stays available);
 * `queued` = an automatic send that stays staged for this session (template ingest).
 */
export type BlockedSendSource = 'typed' | 'answers' | 'action' | 'queued'

export type BlockedSendKind = 'quota' | 'no_allowance' | 'quota_unknown' | 'upload_pending' | 'upload_failed' | 'template_locked'

export interface BlockedSendNoticeContent {
  kind: BlockedSendKind
  title: string
  text: string
}

/** The notice as held by the page: content plus a counter so a repeat re-announces. */
export interface BlockedSendNotice extends BlockedSendNoticeContent {
  id: number
}

const wording = (source: BlockedSendSource) => source === 'answers'
  ? { title: 'Answers not sent', notSent: "your answers weren't sent", kept: 'They are still in the question card.' }
  : source === 'action'
    ? { title: 'Choice not sent', notSent: "your choice wasn't sent", kept: 'The option is still available.' }
    : source === 'queued'
      ? { title: 'Request not sent', notSent: "your request wasn't sent", kept: 'It stays queued for this session and goes out once your plan allows it.' }
      : { title: 'Message not sent', notSent: "your message wasn't sent", kept: 'Your text is still in the box.' }

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1)

/** End a reason with sentence punctuation so it can sit in the middle of a notice. */
const sentence = (value: string) => {
  const trimmed = value.trim()
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`
}

export interface QuotaBlockedSendInput {
  /** The plan window the gate tripped on. */
  which: 'daily' | 'weekly'
  /** Already-formatted local reset time for that window. */
  resetLabel: string
  /** `quota.status.caps` when the plan has them: a zero monthly cap means no allowance at all. */
  caps?: { monthlyCents?: number } | null
}

/** Plan gate: a cap is fully used (or the plan has none) and no reserve covers the turn. */
export function quotaBlockedSendNotice(input: QuotaBlockedSendInput, source: BlockedSendSource = 'typed'): BlockedSendNoticeContent {
  const w = wording(source)
  const noAllowance = typeof input.caps?.monthlyCents === 'number' && input.caps.monthlyCents <= 0
  return noAllowance
    ? {
        kind: 'no_allowance',
        title: w.title,
        text: `This account's plan includes no build quota, so ${w.notSent}. ${w.kept} Add reserve credits to build.`,
      }
    : {
        kind: 'quota',
        title: w.title,
        text: `This account has no build quota left on its plan, so ${w.notSent}. ${w.kept} Your ${input.which} budget resets ${input.resetLabel}; reserve credits keep you building now.`,
      }
}

export interface QuotaUnknownBlockedSendInput {
  /** True while the first plan read is still in flight; false when it finished without an answer. */
  checking: boolean
}

/** Fail-closed plan gate (separate flag): the plan picture is unknown, so the turn waits for it. */
export function quotaUnknownBlockedSendNotice(input: QuotaUnknownBlockedSendInput, source: BlockedSendSource = 'typed'): BlockedSendNoticeContent {
  const w = wording(source)
  return {
    kind: 'quota_unknown',
    title: w.title,
    text: input.checking
      ? `We're still checking this account's build quota, so ${w.notSent}. ${w.kept} Try again in a moment.`
      : `We couldn't confirm this account's build quota, so ${w.notSent}. ${w.kept} We're checking again; try again in a moment.`,
  }
}

/** Raw-upload gate: the Director is told about uploads only through the send, so it waits. */
export function uploadBlockedSendNotice(
  upload: { name: string; status: 'uploading' | 'error' },
  source: BlockedSendSource = 'typed',
): BlockedSendNoticeContent {
  const w = wording(source)
  return upload.status === 'uploading'
    ? {
        kind: 'upload_pending',
        title: w.title,
        text: `${capitalize(w.notSent)} because ${upload.name} is still uploading. ${w.kept} Send again when the upload finishes.`,
      }
    : {
        kind: 'upload_failed',
        title: w.title,
        text: `${capitalize(w.notSent)} because ${upload.name} couldn't be uploaded. ${w.kept} Remove the file or try again, then send.`,
      }
}

/** Template gate: generation is locked until the template is ready. */
export function templateBlockedSendNotice(reason: string, source: BlockedSendSource = 'typed'): BlockedSendNoticeContent {
  const w = wording(source)
  return {
    kind: 'template_locked',
    title: w.title,
    text: `${capitalize(w.notSent)}. ${sentence(reason)} ${w.kept}`,
  }
}

/** Next notice id: a repeat of the same refusal is a new notice, so it is announced again. */
export function nextBlockedSendNotice(previous: BlockedSendNotice | null, content: BlockedSendNoticeContent): BlockedSendNotice {
  return { ...content, id: (previous?.id ?? 0) + 1 }
}
