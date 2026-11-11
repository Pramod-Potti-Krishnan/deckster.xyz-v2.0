// CHAT-PARITY-C2 (FRONTEND-1, chat parity round C2, Studio half). Director's two C2 groups reach Studio as the same `studio_action` frame the themes / identity / templates groups use
// (lib/studio-chat-parity.ts); this file is the pure part for them: which actions each group has, what a request's args must look like, what a refusal is, and what evidence makes a result `done`.
//   group `deck_ops` (cap `deckops1`, flag NEXT_PUBLIC_STUDIO_CHAT_PARITY_DECKOPS): start_blank_canvas, add_blank_slide, change_layout, goto_slide, rename_deck, duplicate_deck, delete_deck, present, set_view_mode, set_slide_rail.
//   group `publish`  (cap `publish1`,  flag NEXT_PUBLIC_STUDIO_CHAT_PARITY_PUBLISH):  publish_deck, republish_deck, unpublish_deck, rotate_publish_link, configure_publish, open_publish_link, copy_publish_link.
// The contract is Director's own code, read-only, origin/uat @ e30b41d4: src/utils/mdc_chat_parity_deck.py (args built in dispatch :236-313, closing lines :426-446), src/utils/mdc_chat_parity_publish.py (args :272-324, lines :508-522),
// src/utils/mdc_studio_action.py (frame :161-204, result :299-370), docs/chat-parity/c2-deck-contract.md and c2-publish-contract.md. Director sends a request only to a client that advertises mdc1 AND the group's cap, and only after the
// user's click on its own card for a destructive or outward action (delete_deck, publish_deck, republish_deck, unpublish_deck, rotate_publish_link, configure_publish): this file never treats a typed word as a confirmation.
// Every decision here is a pure function; lib/studio-chat-parity-deckops.ts and lib/studio-chat-parity-publish.ts run the actions, the page holds the state and the I/O. The only import is the C2 flags / result helper of lib/studio-chat-parity.ts.

import { CHAT_PARITY_C2_FLAGS, chatParityResult, type ChatParityC2Flags, type ChatParityErrorCode, type ChatParityRequest, type ChatParityResultData } from '@/lib/studio-chat-parity'

export type ChatParityC2Group = 'deck_ops' | 'publish'
/** Director's per-group extra codes (mdc_chat_parity_deck.EXTRA_ERROR_CODES :26, mdc_chat_parity_publish.EXTRA_ERROR_CODES :51) on top of the shared ones; the wire value is the string, whatever the name. */
export type ChatParityC2ErrorCode = ChatParityErrorCode
  | 'stale_target' | 'fullscreen_denied'
  | 'not_published' | 'passcode_required' | 'browser_blocked' | 'state_changed' | 'snapshot_failed'

export const CHAT_PARITY_C2_DECK_ACTIONS = ['start_blank_canvas', 'add_blank_slide', 'change_layout', 'goto_slide', 'rename_deck', 'duplicate_deck', 'delete_deck', 'present', 'set_view_mode', 'set_slide_rail'] as const
export const CHAT_PARITY_C2_PUBLISH_ACTIONS = ['publish_deck', 'republish_deck', 'unpublish_deck', 'rotate_publish_link', 'configure_publish', 'open_publish_link', 'copy_publish_link'] as const
/** The actions each C2 group runs. A request whose action is not in its group's list is answered `failed` / `unsupported`. */
export const CHAT_PARITY_C2_ACTIONS: Readonly<Record<ChatParityC2Group, readonly string[]>> = Object.freeze({ deck_ops: CHAT_PARITY_C2_DECK_ACTIONS, publish: CHAT_PARITY_C2_PUBLISH_ACTIONS })

/** Actions Director lets run while another Studio write waits for its answer (mdc_chat_parity_deck.READ_ONLY_ACTIONS :24, publish READ_ACTIONS :38): navigation, view settings, the link reads. Every other action waits for a build and for any slide write. */
export const CHAT_PARITY_C2_READ_ONLY: ReadonlySet<string> = new Set(['goto_slide', 'present', 'set_view_mode', 'set_slide_rail', 'open_publish_link', 'copy_publish_link'])
/** Actions Director puts behind its own click card (delete_deck: mdc_chat_parity_deck._ask_delete :324; publish: mdc_chat_parity_publish MUTATING_ACTIONS :39, _ask :394). */
export const CHAT_PARITY_C2_CARD_ACTIONS: ReadonlySet<string> = new Set(['delete_deck', 'publish_deck', 'republish_deck', 'unpublish_deck', 'rotate_publish_link', 'configure_publish'])

export function isChatParityC2Group(group: unknown): group is ChatParityC2Group {
  return group === 'deck_ops' || group === 'publish'
}

/** Why a C2 request cannot run in this build, or null when it can: a group that is off is `flag_off`, an action outside the group's list is `unsupported`. */
export function chatParityC2Refusal(request: ChatParityRequest, flags: Readonly<ChatParityC2Flags> = CHAT_PARITY_C2_FLAGS): ChatParityErrorCode | null {
  const group = request.group as string
  if (!isChatParityC2Group(group) || flags[group] !== true) return 'flag_off'
  if (!CHAT_PARITY_C2_ACTIONS[group].includes(request.action)) return 'unsupported'
  return null
}

/** The result frame's data for a C2 request (mdc_studio_action.result_fields :299: request_id, status, error_code only on a failure; `detail` is never read by Director and never carries a link, a name or a count here). */
export function chatParityC2Result(requestId: string, status: 'done' | 'failed' | 'dismissed', errorCode: ChatParityC2ErrorCode | null = null): ChatParityResultData {
  return chatParityResult(requestId, status, errorCode as ChatParityErrorCode | null)
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// deck_ops: the request args, read deterministically (Director built them from its own session; Studio still checks every one)
// ---------------------------------------------------------------------------------------------------------------------------------------

/** The 19 SlideLayoutType codes of types/elements.ts (Director's mdc_chat_parity_deck.LAYOUT_LABELS :38 mirrors them). */
export const CHAT_PARITY_C2_LAYOUTS: readonly string[] = Object.freeze([
  'H1-generated', 'H1-structured', 'H2-section', 'H3-closing', 'C1-text', 'C3-chart', 'C4-infographic', 'C5-diagram', 'V1-image-text', 'V2-chart-text', 'V3-diagram-text',
  'V4-infographic-text', 'I1-image-left', 'I2-image-right', 'I3-image-left-narrow', 'I4-image-right-narrow', 'S3-two-visuals', 'S4-comparison', 'B1-blank',
])
export const CHAT_PARITY_C2_BLANK_LAYOUT = 'B1-blank'
/** A deck name: one line, at most this long (mdc_chat_parity_deck.NAME_MAX_CHARS :32). */
export const CHAT_PARITY_C2_NAME_MAX = 150
/** The slide-count ceiling Studio accepts in a target (a sanity bound, not a product limit). */
export const CHAT_PARITY_C2_MAX_SLIDES = 5000
const SLIDE_ID_MAX = 128
const CONFIRMATION_ID = /^dd_[0-9a-f]{24}$/

/** The one slide a request names: its index (0-based), its stable id and the slide count Director saw (all three come from Director's own session list; Studio re-reads the deck before it writes). */
export interface ChatParityC2SlideTarget { slideIndex: number; slideId: string; expectedSlideCount: number }

export type ChatParityDeckOpsArgs =
  | { action: 'start_blank_canvas' }
  | { action: 'add_blank_slide'; position: 'end' | 'before' | 'after'; insertionIndex: number; expectedSlideCount: number; target: ChatParityC2SlideTarget | null }
  | { action: 'change_layout'; target: ChatParityC2SlideTarget; layout: string }
  | { action: 'goto_slide'; target: ChatParityC2SlideTarget }
  | { action: 'rename_deck'; name: string }
  | { action: 'duplicate_deck' }
  | { action: 'delete_deck'; confirmationId: string }
  | { action: 'present' }
  | { action: 'set_view_mode'; mode: 'view' | 'edit' }
  | { action: 'set_slide_rail'; visible: boolean }

const isInt = (value: unknown, min: number, max: number): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max

function slideTarget(args: Record<string, unknown>): ChatParityC2SlideTarget | null {
  const slideId = typeof args.slide_id === 'string' ? args.slide_id : ''
  if (!isInt(args.slide_index, 0, CHAT_PARITY_C2_MAX_SLIDES) || !isInt(args.expected_slide_count, 1, CHAT_PARITY_C2_MAX_SLIDES)) return null
  if (!slideId || slideId !== slideId.trim() || slideId.length > SLIDE_ID_MAX || args.slide_index >= args.expected_slide_count) return null
  return { slideIndex: args.slide_index, slideId, expectedSlideCount: args.expected_slide_count }
}

/** A deck name as Director sends it (exact user text, one line): trimmed, 1-150 characters, no control character. */
export function chatParityC2DeckName(value: unknown): string | null {
  const name = typeof value === 'string' ? value.trim() : ''
  if (!name || name.length > CHAT_PARITY_C2_NAME_MAX) return null
  for (let i = 0; i < name.length; i++) { const code = name.charCodeAt(i); if (code < 32 || code === 127) return null }
  return name
}

/** The deck_ops action's args, normalised, or null when they do not fit the action (`invalid_args`). Direction of every rule: Director's dispatch (mdc_chat_parity_deck.py :236-313). */
export function chatParityDeckOpsArgs(action: string, args: Record<string, unknown>): ChatParityDeckOpsArgs | null {
  switch (action) {
    case 'start_blank_canvas': return { action }
    case 'duplicate_deck': return { action }
    case 'present': return { action }
    case 'goto_slide': { const target = slideTarget(args); return target ? { action, target } : null }
    case 'change_layout': {
      const target = slideTarget(args)
      const layout = typeof args.layout === 'string' ? args.layout : ''
      return target && CHAT_PARITY_C2_LAYOUTS.includes(layout) && args.preserve_content === true ? { action, target, layout } : null
    }
    case 'add_blank_slide': {
      const position = args.position
      if (args.layout !== CHAT_PARITY_C2_BLANK_LAYOUT || !isInt(args.expected_slide_count, 1, CHAT_PARITY_C2_MAX_SLIDES) || !isInt(args.insertion_index, 0, CHAT_PARITY_C2_MAX_SLIDES)) return null
      if (position === 'end') return args.insertion_index === args.expected_slide_count ? { action, position, insertionIndex: args.insertion_index, expectedSlideCount: args.expected_slide_count, target: null } : null
      if (position !== 'before' && position !== 'after') return null
      const target = slideTarget(args)
      if (!target || target.expectedSlideCount !== args.expected_slide_count || args.insertion_index !== target.slideIndex + (position === 'after' ? 1 : 0)) return null
      return { action, position, insertionIndex: args.insertion_index, expectedSlideCount: args.expected_slide_count, target }
    }
    case 'rename_deck': { const name = chatParityC2DeckName(args.name); return name ? { action, name } : null }
    case 'delete_deck': {
      const id = typeof args.confirmation_id === 'string' ? args.confirmation_id : ''
      return args.confirmed === true && CONFIRMATION_ID.test(id) ? { action, confirmationId: id } : null
    }
    case 'set_view_mode': return args.mode === 'view' || args.mode === 'edit' ? { action, mode: args.mode } : null
    case 'set_slide_rail': return typeof args.visible === 'boolean' ? { action, visible: args.visible } : null
    default: return null
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// deck_ops: evidence. A write is `done` only when the viewer's own order of slides (Layout's composeGetState, lib/studio-native-slide-order.ts) shows it.
// ---------------------------------------------------------------------------------------------------------------------------------------

export interface ChatParityC2SlideOrder { nativeCount: number; currentVisualIndex: number; slideIds: readonly string[] }

/** The request's slide is still the one Director named: same count, same id at the same index. Anything else is a stale or reordered target (never moved to another slide). */
export function chatParityC2TargetStale(order: ChatParityC2SlideOrder, target: ChatParityC2SlideTarget): boolean {
  return order.nativeCount !== target.expectedSlideCount || order.slideIds.length !== order.nativeCount || order.slideIds[target.slideIndex] !== target.slideId
}

/** The deck still has the count Director saw (an add at the end, or before / after a named slide that is checked separately). */
export function chatParityC2CountStale(order: ChatParityC2SlideOrder, expectedSlideCount: number): boolean {
  return order.nativeCount !== expectedSlideCount || order.slideIds.length !== order.nativeCount
}

/** A blank slide was added at `insertionIndex`: one more slide, a new id there, every other slide where it was. */
export function chatParityC2AddVerified(before: ChatParityC2SlideOrder, after: ChatParityC2SlideOrder, insertionIndex: number): boolean {
  if (after.nativeCount !== before.nativeCount + 1 || after.slideIds.length !== after.nativeCount || insertionIndex < 0 || insertionIndex >= after.nativeCount) return false
  const added = after.slideIds[insertionIndex]
  if (!added || before.slideIds.includes(added)) return false
  const rest = [...after.slideIds]; rest.splice(insertionIndex, 1)
  return rest.length === before.slideIds.length && rest.every((id, index) => id === before.slideIds[index])
}

/** A layout change kept the deck's shape: same count, every other slide where it was (the changed slide's own id is not required to stay: that is Layout's to say). */
export function chatParityC2LayoutShapeKept(before: ChatParityC2SlideOrder, after: ChatParityC2SlideOrder, index: number): boolean {
  if (after.nativeCount !== before.nativeCount || after.slideIds.length !== before.slideIds.length || !after.slideIds[index]) return false
  return after.slideIds.every((id, at) => at === index || id === before.slideIds[at])
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// publish: the request args. Director sends typed settings only: no slug, URL, passcode, session / user / deck id, free-form dictionary (mdc_chat_parity_publish.py _FIELDS :97, _args :272-324).
// ---------------------------------------------------------------------------------------------------------------------------------------

export type ChatParityPublishVisibility = 'public' | 'unlisted'
export interface ChatParityPublishSettings {
  visibility?: ChatParityPublishVisibility
  allowPdf?: boolean
  allowPptx?: boolean
  qaEnabled?: boolean
  qaDailyCap?: number
  qaMonthlyCap?: number
  narrationEnabled?: boolean
  narrationBudgetMinutes?: number
  qaReserveMinutes?: number
}
export type ChatParityPublishArgs =
  | { action: 'publish_deck'; visibility: ChatParityPublishVisibility; allowPdf: boolean; allowPptx: boolean }
  | { action: 'republish_deck' } | { action: 'unpublish_deck' } | { action: 'rotate_publish_link' }
  | { action: 'configure_publish'; settings: ChatParityPublishSettings }
  | { action: 'open_publish_link' } | { action: 'copy_publish_link' }

/** Bounds of the integer settings (mdc_chat_parity_publish._args :302; the contract's table). */
export const CHAT_PARITY_C2_PUBLISH_BOUNDS: Readonly<Record<'qaDailyCap' | 'qaMonthlyCap' | 'narrationBudgetMinutes' | 'qaReserveMinutes', readonly [number, number]>> = Object.freeze({
  qaDailyCap: [0, 1000], qaMonthlyCap: [0, 20000], narrationBudgetMinutes: [1, 480], qaReserveMinutes: [0, 480],
})
const PUBLISH_BOOLEANS = ['allowPdf', 'allowPptx', 'qaEnabled', 'narrationEnabled'] as const
const PUBLISH_INTEGERS = ['qaDailyCap', 'qaMonthlyCap', 'narrationBudgetMinutes', 'qaReserveMinutes'] as const

/** The settings a publish / configure request names, checked: only the whitelisted keys, typed strictly, visibility `public` or `unlisted` (never restricted, never a passcode). null when anything else is there or a value is off. */
function publishSettings(args: Record<string, unknown>, allowed: readonly string[]): ChatParityPublishSettings | null {
  const out: ChatParityPublishSettings = {}
  for (const key of Object.keys(args)) if (!allowed.includes(key)) return null
  if (args.visibility !== undefined) { if (args.visibility !== 'public' && args.visibility !== 'unlisted') return null; out.visibility = args.visibility }
  for (const key of PUBLISH_BOOLEANS) if (args[key] !== undefined) { if (typeof args[key] !== 'boolean') return null; out[key] = args[key] as boolean }
  for (const key of PUBLISH_INTEGERS) if (args[key] !== undefined) {
    const [low, high] = CHAT_PARITY_C2_PUBLISH_BOUNDS[key]
    if (!isInt(args[key], low, high)) return null
    out[key] = args[key] as number
  }
  return out
}

/** The publish action's args, normalised, or null when they do not fit (`invalid_args`). A request that carries any key it does not list (a passcode, a slug, a link) is refused whole. */
export function chatParityPublishArgs(action: string, args: Record<string, unknown>): ChatParityPublishArgs | null {
  switch (action) {
    case 'republish_deck': case 'unpublish_deck': case 'rotate_publish_link': case 'open_publish_link': case 'copy_publish_link': return Object.keys(args).length === 0 ? { action } : null
    case 'publish_deck': {
      const settings = publishSettings(args, ['visibility', 'allowPdf', 'allowPptx'])
      // Director sends the three explicitly (safe defaults unlisted / no downloads); a missing one reads as the least exposure, never as more.
      return settings ? { action, visibility: settings.visibility ?? 'unlisted', allowPdf: settings.allowPdf ?? false, allowPptx: settings.allowPptx ?? false } : null
    }
    case 'configure_publish': {
      const settings = publishSettings(args, ['visibility', 'allowPdf', 'allowPptx', 'qaEnabled', 'qaDailyCap', 'qaMonthlyCap', 'narrationEnabled', 'narrationBudgetMinutes', 'qaReserveMinutes'])
      if (!settings || Object.keys(settings).length === 0) return null
      // The same cross-field rules Director applies (mdc_chat_parity_publish.py :315-323); a request that breaks one never reaches the server.
      if (settings.qaEnabled === true && (settings.qaDailyCap === undefined || settings.qaMonthlyCap === undefined)) return null
      if (settings.qaDailyCap !== undefined && settings.qaMonthlyCap !== undefined && settings.qaDailyCap > settings.qaMonthlyCap) return null
      if ((settings.narrationEnabled === true || settings.qaReserveMinutes !== undefined) && settings.narrationBudgetMinutes === undefined) return null
      if ((settings.qaReserveMinutes ?? 0) > (settings.narrationBudgetMinutes ?? 480)) return null
      return { action, settings }
    }
    default: return null
  }
}
