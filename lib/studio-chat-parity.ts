// CHAT-PARITY (FRONTEND-1, P3-1 A post-Thursday rows, Studio half; contract: deckster-workspace streams/frontend1/chat-parity-p3/CONTRACTS.md).
// Three flags, one per row group, each on only for the string "true", default off, build-time:
//   (rows 105 / 106 / 108, notes / script / references: Director writes them itself and sends deck_mutation notes_updated; that frame, the cap
//    notes1 and the Notes panel re-read are #522's single path, NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT; this change adds one marked line there.)
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES     rows 56-59, 61: fonts, save, set / clear standard, rename, apply a saved theme — the composer palette's
//                                             own useThemeProfiles writes and the theme picker's own apply (lib/studio-chat-parity-themes.ts); cap `themes1`.
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY   rows 62-64: the footer and logo through the Master panel's own open / fill / Save path (components/
//                                             presentation-settings-panel.tsx), presenter details through the identity form's own writer; cap `identity1`.
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO  row 63's generate (one paid image call): a sub-flag under IDENTITY, off until PK rules; on, a Studio confirm first.
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES  rows 65 / 67 / 76 (+ 70 / 75 behind their paid sub-flags): the template picker's own select, the composer
//                                             library's own action, the Templates page's own rename / optimise, the Save Template dialog's own save; cap
//                                             `templates1`. Rows 66 (New topic / Reuse as-is) and 72 (apply to the open deck) have no live Studio click path
//                                             at this head (the workspace's startDeck exists only in its mock source; no "Available Templates" control), so
//                                             they are not actions: a request for them is answered `unsupported`, honestly.
//   NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE / _PAID_OPTIMIZE  rows 70 / 75 (a composer job each): sub-flags under TEMPLATES, off until PK rules.
// With a group's flag on, Studio adds the group's cap to user_message.data.client_caps (beside mdc1, theme1, ...), takes Director's
// request frame out of band (never the reducer, the transcript or the cache), runs the SAME function the click path runs, and answers
// with the result frame. Director keeps the request's kind in its own pending table and closes the turn with a fixed line; Studio
// shows no line of its own. Every flag off: no cap is sent, the frames are unknown types (dropped at ingress, as before) and every
// file this change touches is byte for byte what it was (scripts/studio-chat-parity-strip.mjs).
//
// THE FRAME NAMES LIVE IN ONE PLACE (CHAT_PARITY_FRAMES): if DIRECTOR-2 prefers the existing element_directive_result route, only the
// two strings change (and the result's id key, CHAT_PARITY_RESULT_ID_KEY).
//
// IMPORT-FREE BY DESIGN: scripts/test-studio-chat-parity.mjs transpiles this file into a bare function scope with a fake `process`.
// Every decision (which frame, which cap, is this request ours, what does the answer look like) is a pure function here; the hook and
// the page hold the state and do the I/O.

// ---------------------------------------------------------------------------------------------------------------------------------------
// Frames
// ---------------------------------------------------------------------------------------------------------------------------------------

/** Director -> Studio request frame type, Studio -> Director result frame type, and the correlation key the result carries. */
export const CHAT_PARITY_FRAMES = Object.freeze({
  request: 'studio_action',
  result: 'studio_action_result',
} as const)

/** The key under which the result frame's data carries the request's id (`directive_id` if the frames become element_directive_result). */
export const CHAT_PARITY_RESULT_ID_KEY = 'request_id'

export type ChatParityGroup = 'themes' | 'identity' | 'templates'
export type ChatParityStatus = 'done' | 'failed' | 'dismissed'
export type ChatParityErrorCode =
  | 'not_owner' | 'viewer_unavailable' | 'flag_off' | 'not_found' | 'locked' | 'invalid_args' | 'write_failed' | 'timeout' | 'unsupported'
  // themes (rows 56-59, 61)
  | 'theme_auto' | 'theme_locked' | 'theme_failed'
  // identity (rows 62-64)
  | 'busy' | 'generate_failed' | 'declined'
  // templates (rows 65 / 67 / 70 / 75 / 76)
  | 'no_deck' | 'already_ready' | 'name_taken'

// ---------------------------------------------------------------------------------------------------------------------------------------
// Flags (literal process.env reads so Next inlines them at build time)
// ---------------------------------------------------------------------------------------------------------------------------------------

export function chatParityFlagOn(value: string | undefined): boolean {
  return value === 'true'
}

export const STUDIO_CHAT_PARITY_THEMES_ENABLED = chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_THEMES)
export const STUDIO_CHAT_PARITY_IDENTITY_ENABLED = chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_IDENTITY)
/** Row 63's generate: a paid image call. A sub-flag of IDENTITY (both must be on), default off until PK rules on paid actions. */
export const STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED = STUDIO_CHAT_PARITY_IDENTITY_ENABLED && chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_LOGO)
export const STUDIO_CHAT_PARITY_TEMPLATES_ENABLED = chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_TEMPLATES)
/** Rows 70 / 75: a composer job each (paid). Sub-flags of TEMPLATES (both must be on), default off until PK rules on paid actions. */
export const STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE_ENABLED = STUDIO_CHAT_PARITY_TEMPLATES_ENABLED && chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE)
export const STUDIO_CHAT_PARITY_PAID_OPTIMIZE_ENABLED = STUDIO_CHAT_PARITY_TEMPLATES_ENABLED && chatParityFlagOn(process.env.NEXT_PUBLIC_STUDIO_CHAT_PARITY_PAID_OPTIMIZE)

export interface ChatParityFlags {
  themes: boolean
  identity: boolean
  templates: boolean
}

/** The flags this build was made with. */
export const CHAT_PARITY_FLAGS: Readonly<ChatParityFlags> = Object.freeze({
  themes: STUDIO_CHAT_PARITY_THEMES_ENABLED,
  identity: STUDIO_CHAT_PARITY_IDENTITY_ENABLED,
  templates: STUDIO_CHAT_PARITY_TEMPLATES_ENABLED,
})

/** True when any group is on: the request frame is then taken out of band (a group that is off answers `failed` / `flag_off`). */
export const STUDIO_CHAT_PARITY_ANY_ENABLED = Object.values(CHAT_PARITY_FLAGS).some(Boolean)

// ---------------------------------------------------------------------------------------------------------------------------------------
// Capabilities (Studio -> Director, on every user_message)
// ---------------------------------------------------------------------------------------------------------------------------------------

/** The cap Director checks before it sends a group's request (exact, case-sensitive). (`notes1` is #522's.) */
export const CHAT_PARITY_GROUP_CAPS: Readonly<Record<ChatParityGroup, string>> = Object.freeze({
  themes: 'themes1',
  identity: 'identity1',
  templates: 'templates1',
})

/** The caps a build with these flags sends, in group order; empty when every flag is off (and then nothing is added to a send). */
export function chatParityCaps(flags: Readonly<ChatParityFlags>): string[] {
  return (['themes', 'identity', 'templates'] as const).filter(group => flags[group] === true).map(group => CHAT_PARITY_GROUP_CAPS[group])
}

export const CHAT_PARITY_CAPS: readonly string[] = chatParityCaps(CHAT_PARITY_FLAGS)

/**
 * Adds the caps to a built `user_message.data`, in place: after whatever caps are there (mdc1, theme1, ...), each once. Called only when
 * `caps` is non-empty. A `client_caps` that is not an array of strings is replaced by the strings it holds plus ours.
 */
export function addChatParityCaps(data: Record<string, unknown>, caps: readonly string[] = CHAT_PARITY_CAPS): Record<string, unknown> {
  const existing = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter(cap => typeof cap === 'string') as string[] : []
  const next = [...existing]
  for (const cap of caps) if (!next.includes(cap)) next.push(cap)
  data.client_caps = next
  return data
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The request frame (Director -> Studio)
// ---------------------------------------------------------------------------------------------------------------------------------------

/** The actions each group runs. A request whose action is not in its group's list is answered `failed` / `unsupported`. */
export const CHAT_PARITY_ACTIONS: Readonly<Record<ChatParityGroup, readonly string[]>> = Object.freeze({
  themes: ['set_theme_fonts', 'save_theme', 'set_standard_theme', 'clear_standard_theme', 'rename_theme', 'apply_saved_theme'],
  identity: ['set_footer', 'clear_footer', 'set_logo', 'generate_logo', 'remove_logo', 'set_deck_identity'],
  templates: ['select_template', 'composer_template_action', 'save_template', 'optimize_template', 'rename_template'],
})

export interface ChatParityRequest {
  requestId: string
  group: ChatParityGroup
  action: string
  presentationId: string | null
  args: Record<string, unknown>
  label: string
}

const GROUPS: readonly ChatParityGroup[] = ['themes', 'identity', 'templates']

/** The frame's request id when it has a usable one (an answer needs it), else null: such a frame is dropped unanswered. */
export function chatParityRequestId(message: unknown): string | null {
  const payload = (message as { payload?: unknown } | null)?.payload as { request_id?: unknown } | null | undefined
  const id = payload && typeof payload === 'object' ? payload.request_id : null
  return typeof id === 'string' && id.trim() ? id : null
}

/** True when the frame is this change's request frame (its type, whatever the rest). */
export function isChatParityRequestFrame(message: unknown): boolean {
  return Boolean(message) && typeof message === 'object' && (message as { type?: unknown }).type === CHAT_PARITY_FRAMES.request
}

/**
 * Reads a request frame. null when it is not one, or has no usable request id. A well-formed request whose group is unknown, whose group
 * is off in this build, or whose action is not the group's, still comes back (with its group as read, `action` as read) so the page can
 * answer it honestly (`flag_off` / `unsupported`): see chatParityRefusal.
 */
export function chatParityRequest(message: unknown): ChatParityRequest | null {
  if (!isChatParityRequestFrame(message)) return null
  const requestId = chatParityRequestId(message)
  if (!requestId) return null
  const payload = (message as { payload: Record<string, unknown> }).payload
  const group = typeof payload.group === 'string' ? payload.group : ''
  const action = typeof payload.action === 'string' ? payload.action : ''
  const args = payload.args && typeof payload.args === 'object' && !Array.isArray(payload.args) ? { ...(payload.args as Record<string, unknown>) } : {}
  return {
    requestId,
    group: group as ChatParityGroup,
    action,
    presentationId: typeof payload.presentation_id === 'string' && payload.presentation_id ? payload.presentation_id : null,
    args,
    label: typeof payload.label === 'string' ? payload.label : '',
  }
}

/** Why a read request cannot run in this build, or null when it can: an unknown or off group is `flag_off`, an action outside the group's list is `unsupported`. */
export function chatParityRefusal(request: ChatParityRequest, flags: Readonly<ChatParityFlags> = CHAT_PARITY_FLAGS): ChatParityErrorCode | null {
  if (!GROUPS.includes(request.group) || flags[request.group] !== true) return 'flag_off'
  if (!CHAT_PARITY_ACTIONS[request.group].includes(request.action)) return 'unsupported'
  return null
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The result frame (Studio -> Director)
// ---------------------------------------------------------------------------------------------------------------------------------------

export interface ChatParityResultData {
  [key: string]: unknown
  status: ChatParityStatus
  error_code: ChatParityErrorCode | null
  detail?: Record<string, unknown>
}

/** The result frame's data: the id under CHAT_PARITY_RESULT_ID_KEY, the status, an error code only on `failed`, a detail only when given. */
export function chatParityResult(
  requestId: string, status: ChatParityStatus, errorCode: ChatParityErrorCode | null = null, detail?: Record<string, unknown>,
): ChatParityResultData {
  const data: ChatParityResultData = { [CHAT_PARITY_RESULT_ID_KEY]: requestId, status, error_code: status === 'failed' ? errorCode : null }
  if (detail && Object.keys(detail).length > 0) data.detail = detail
  return data
}

/** The whole outbound frame: the data under `payload` (DIRECTOR-2, 27 Oct 03:59Z: Director reads `payload` or `data`; it sends under `payload`). */
export function chatParityResultFrame(data: ChatParityResultData): { type: string; payload: ChatParityResultData } {
  return { type: CHAT_PARITY_FRAMES.result, payload: data }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// The bus between the socket hook and the Builder page (the flowBus idiom of lib/studio-flow-control.ts): the hook hands frames to it and
// registers its sender; the page sets the handlers AFTER its runners (so no line of this change sits before the older proofs' page regions).
// One socket per page, so one module-level record. Every flag off: nothing is set and nothing is called.
// ---------------------------------------------------------------------------------------------------------------------------------------

export interface ChatParityOwner {
  sessionId: string | null
  isCurrent: () => boolean
}

export interface ChatParityRequestFrame {
  type: string
  session_id?: string
  payload: Record<string, unknown>
}

export const chatParityBus: {
  /** The page's runner of a studio_action frame (set with a group flag on). */
  request: ((message: ChatParityRequestFrame, owner: ChatParityOwner) => void) | null
  /** The hook's sender of the result frame (set while the hook is mounted). */
  send: ((data: ChatParityResultData) => boolean) | null
  /** IDENTITY: the viewer's opener of the Master (footer and logo) panel, the Show menu's own "Master…" (components/presentation-viewer.tsx). */
  openMaster: (() => void) | null
  /** IDENTITY: the Master panel's own run of one footer / logo op: its read fills the fields, the op's fields are set as if typed, the Save button's own handler writes and closes. */
  master: ((op: ChatParityMasterOp, deadline: number) => Promise<ChatParityMasterResult>) | null
} = { request: null, send: null, openMaster: null, master: null }

// ---------------------------------------------------------------------------------------------------------------------------------------
// Rows 106 / 108: which narration fields a notes_updated frame names (DIRECTOR-2 !580: payload.fields = ["speaker_notes" | "script" | "references"]).
// #522's single path reloads the panel and lets a saved notes edit go; the hook raises this event first so the panel lets a script / references
// edit go the same way (no second reload, no second cap: the panel listens, #522's handler reloads).
// ---------------------------------------------------------------------------------------------------------------------------------------

export const CHAT_PARITY_NOTES_FIELDS_EVENT = 'deckster:chat-notes-fields'
export const CHAT_PARITY_NOTES_FIELDS: readonly string[] = ['script', 'references']

/** The script / references fields a deck_mutation notes_updated payload names (speaker_notes is #522's); [] for any other frame or none named. */
export function chatParityNotesFields(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const value = payload as { mutation?: unknown; fields?: unknown }
  if (value.mutation !== 'notes_updated' || !Array.isArray(value.fields)) return []
  return (value.fields as unknown[]).filter((f): f is string => typeof f === 'string' && CHAT_PARITY_NOTES_FIELDS.includes(f))
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// THEMES (rows 56-59, 61): the request args, read deterministically (Director validated them first; Studio still checks)
// ---------------------------------------------------------------------------------------------------------------------------------------

/** The window event the composer palette listens for after a chat save / rename / standard change (components/builder/chat-input.tsx). */
export const CHAT_PARITY_THEME_LIBRARY_EVENT = 'deckster:theme-library-changed'
/** A saved theme's name: trimmed, 1-80 characters (the palette's own field). */
export const CHAT_PARITY_THEME_NAME_MAX = 80

export type ChatParityThemeArgs =
  | { action: 'set_theme_fonts'; font_family?: string; font_family_heading?: string }
  | { action: 'save_theme'; name: string; set_standard: boolean }
  | { action: 'set_standard_theme'; theme_id: string }
  | { action: 'clear_standard_theme' }
  | { action: 'rename_theme'; theme_id: string; name: string }
  | { action: 'apply_saved_theme'; theme_id: string }

const themeName = (value: unknown): string | null => {
  const name = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return name && name.length <= CHAT_PARITY_THEME_NAME_MAX ? name : null
}
const themeId = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)

/**
 * The theme action's args, normalised, or null when they do not fit the action (`invalid_args`). `fonts` is the build's allowed family list
 * (lib/theme-fonts.ts THEME_FONT_FAMILIES, matched trimmed and case-insensitively, returned in its canonical spelling); a font request must
 * name at least one known family and no unknown one.
 */
export function chatParityThemeArgs(action: string, args: Record<string, unknown>, fonts: readonly string[]): ChatParityThemeArgs | null {
  switch (action) {
    case 'set_theme_fonts': {
      const out: { action: 'set_theme_fonts'; font_family?: string; font_family_heading?: string } = { action }
      for (const field of ['font_family', 'font_family_heading'] as const) {
        if (args[field] === undefined || args[field] === null) continue
        const wanted = typeof args[field] === 'string' ? (args[field] as string).trim().toLowerCase() : ''
        const family = fonts.find(name => name.toLowerCase() === wanted)
        if (!family) return null
        out[field] = family
      }
      return out.font_family || out.font_family_heading ? out : null
    }
    case 'save_theme': {
      const name = themeName(args.name)
      return name ? { action, name, set_standard: args.set_standard === true } : null
    }
    case 'set_standard_theme': { const id = themeId(args.theme_id); return id ? { action, theme_id: id } : null }
    case 'clear_standard_theme': return { action }
    case 'rename_theme': { const id = themeId(args.theme_id); const name = themeName(args.name); return id && name ? { action, theme_id: id, name } : null }
    case 'apply_saved_theme': { const id = themeId(args.theme_id); return id ? { action, theme_id: id } : null }
    default: return null
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// IDENTITY (rows 62-64): the request args and the Master panel op
// ---------------------------------------------------------------------------------------------------------------------------------------

/** Paid actions and the sub-flag each needs on top of its group flag (off: answered `flag_off`, nothing runs, nothing is charged). */
export const CHAT_PARITY_PAID_ACTIONS: Readonly<Record<string, boolean>> = Object.freeze({
  generate_logo: STUDIO_CHAT_PARITY_PAID_LOGO_ENABLED,
  save_template: STUDIO_CHAT_PARITY_PAID_SAVE_TEMPLATE_ENABLED,
  optimize_template: STUDIO_CHAT_PARITY_PAID_OPTIMIZE_ENABLED,
})
/** True when `action` is paid and its sub-flag is off in this build. */
export function chatParityPaidBlocked(action: string, paid: Readonly<Record<string, boolean>> = CHAT_PARITY_PAID_ACTIONS): boolean {
  return action in paid && paid[action] !== true
}

/** A footer value or presenter field: trimmed, one line, at most this long (the identity dialog's own 120). */
export const CHAT_PARITY_IDENTITY_MAX = 120
export const CHAT_PARITY_LOGO_PROMPT_MAX = 300

export type ChatParityIdentityArgs =
  | { action: 'set_footer'; template?: string; title?: string; date?: string; author?: string }
  | { action: 'clear_footer' }
  | { action: 'set_logo'; image_url: string; alt_text?: string }
  | { action: 'generate_logo'; prompt: string }
  | { action: 'remove_logo' }
  | { action: 'set_deck_identity'; company?: string; confidentiality?: string; logo_url?: string }

const oneLine = (value: unknown, max: number): string | null => {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  return text && text.length <= max ? text : null
}
/** An https URL (the identity dialog's own rule for a logo: anything else is never a logo and may leak a secret). */
const httpsUrl = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value.trim() : ''
  return /^https:\/\/[^\s]+$/i.test(text) && text.length <= 2048 ? text : null
}

/** The identity action's args, normalised, or null when they do not fit (`invalid_args`). Every value is the user's own text (Director passes it verbatim). */
export function chatParityIdentityArgs(action: string, args: Record<string, unknown>): ChatParityIdentityArgs | null {
  switch (action) {
    case 'set_footer': {
      const out: { action: 'set_footer'; template?: string; title?: string; date?: string; author?: string } = { action }
      for (const field of ['template', 'title', 'date', 'author'] as const) {
        if (args[field] === undefined || args[field] === null) continue
        const text = oneLine(args[field], CHAT_PARITY_IDENTITY_MAX)
        if (text === null) return null
        out[field] = text
      }
      return out.template || out.title || out.date || out.author ? out : null
    }
    case 'clear_footer': return { action }
    case 'set_logo': {
      const url = httpsUrl(args.image_url); if (!url) return null
      const alt = args.alt_text === undefined || args.alt_text === null ? undefined : oneLine(args.alt_text, CHAT_PARITY_IDENTITY_MAX)
      if (alt === null) return null
      return alt ? { action, image_url: url, alt_text: alt } : { action, image_url: url }
    }
    case 'generate_logo': { const prompt = oneLine(args.prompt, CHAT_PARITY_LOGO_PROMPT_MAX); return prompt ? { action, prompt } : null }
    case 'remove_logo': return { action }
    case 'set_deck_identity': {
      const out: { action: 'set_deck_identity'; company?: string; confidentiality?: string; logo_url?: string } = { action }
      for (const field of ['company', 'confidentiality'] as const) {
        if (args[field] === undefined || args[field] === null) continue
        const text = oneLine(args[field], CHAT_PARITY_IDENTITY_MAX); if (text === null) return null
        out[field] = text
      }
      if (args.logo_url !== undefined && args.logo_url !== null) { const url = httpsUrl(args.logo_url); if (!url) return null; out.logo_url = url }
      return out.company || out.confidentiality || out.logo_url ? out : null
    }
    default: return null
  }
}

/** What the Master panel runs for a footer / logo request (components/presentation-settings-panel.tsx): the panel's own fields, then its Save. */
export type ChatParityMasterOp =
  | { kind: 'footer'; template?: string; title?: string; date?: string; author?: string }
  | { kind: 'clear_footer' }
  | { kind: 'logo'; image_url: string; alt_text?: string }
  | { kind: 'generate_logo'; prompt: string }
  | { kind: 'remove_logo' }
export interface ChatParityMasterResult { ok: boolean; error?: 'busy' | 'viewer_unavailable' | 'generate_failed' | 'write_failed' | 'timeout' }

/** The panel op for an identity action that goes through the Master panel, or null for one that does not (set_deck_identity). */
export function chatParityMasterOp(args: ChatParityIdentityArgs): ChatParityMasterOp | null {
  switch (args.action) {
    case 'set_footer': { const { action: _a, ...rest } = args; return { kind: 'footer', ...rest } }
    case 'clear_footer': return { kind: 'clear_footer' }
    case 'set_logo': return args.alt_text ? { kind: 'logo', image_url: args.image_url, alt_text: args.alt_text } : { kind: 'logo', image_url: args.image_url }
    case 'generate_logo': return { kind: 'generate_logo', prompt: args.prompt }
    case 'remove_logo': return { kind: 'remove_logo' }
    default: return null
  }
}

// ---------------------------------------------------------------------------------------------------------------------------------------
// TEMPLATES (rows 65 / 67 / 70 / 75 / 76): the request args
// ---------------------------------------------------------------------------------------------------------------------------------------

/** A template's name: trimmed, 1-150 characters (Director's rename rule). */
export const CHAT_PARITY_TEMPLATE_NAME_MAX = 150
/** The composer library's actions a chat request may name, and the library dialog's own action id for each. */
export const CHAT_PARITY_COMPOSER_ACTIONS: Readonly<Record<string, 'use' | 'ditto' | 'new-topic'>> = Object.freeze({ use_original: 'use', rebuild: 'ditto', new_topic: 'new-topic' })

export type ChatParityTemplateArgs =
  | { action: 'select_template'; template_id: string }
  | { action: 'composer_template_action'; template_id: string; composer_action: 'use' | 'ditto' | 'new-topic' }
  | { action: 'save_template'; name: string }
  | { action: 'optimize_template'; template_id: string }
  | { action: 'rename_template'; template_id: string; name: string }

const templateId = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null)
const templateName = (value: unknown): string | null => {
  const name = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
  return name && name.length <= CHAT_PARITY_TEMPLATE_NAME_MAX ? name : null
}

/** The template action's args, normalised, or null when they do not fit (`invalid_args`). Templates are always named by id. */
export function chatParityTemplateArgs(action: string, args: Record<string, unknown>): ChatParityTemplateArgs | null {
  switch (action) {
    case 'select_template': { const id = templateId(args.template_id); return id ? { action, template_id: id } : null }
    case 'composer_template_action': {
      const id = templateId(args.template_id)
      const composer = typeof args.action === 'string' ? CHAT_PARITY_COMPOSER_ACTIONS[args.action] : undefined
      return id && composer ? { action, template_id: id, composer_action: composer } : null
    }
    case 'save_template': { const name = templateName(args.name); return name ? { action, name } : null }
    case 'optimize_template': { const id = templateId(args.template_id); return id ? { action, template_id: id } : null }
    case 'rename_template': { const id = templateId(args.template_id); const name = templateName(args.name); return id && name ? { action, template_id: id, name } : null }
    default: return null
  }
}
