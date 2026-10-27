/**
 * FRONTEND-2, P3-1 A chat parity: the WIRE half of the composer's "/" commands and "@" mentions (NEXT_PUBLIC_STUDIO_CHAT_COMMANDS, the string "true",
 * default off, build-time; it needs NEXT_PUBLIC_STUDIO_CHAT_CLEAN and the Studio shell too, because the menus live in the v3.1 composer).
 *
 * THE ONE PLACE THE WIRE LIVES (agreed with DIRECTOR-2, 27 Oct: the Director side is DIRECTOR_MDC_MENTIONS_COMMANDS_ENABLED, off, and today's Director ignores
 * a kind it does not know). If DIRECTOR-2 changes a name or a shape, it changes here and nowhere else:
 *   user_message.data.references[]   'slide' and 'element' unchanged (K1 and the element refine; never two element references), plus
 *                                      { kind: 'file',     file_id, name, source: 'upload' | 'second_brain' }
 *                                      { kind: 'template', template_id, name }
 *                                      { kind: 'theme',    theme_id, name, source: 'preset' | 'saved' }     (only a built-in preset is acted on; DIRECTOR-2, 27 Oct)
 *   user_message.data.command        'add_slide' | 'duplicate_slide' | 'delete_slide' for the three commands that pre-fill a request. A HINT: the text stays the source of truth.
 *   user_message.data.client_caps    'mentions2' and 'commands1', appended after whatever caps are there, only with the flag on.
 * Flag off: nothing in this file is read by a send (the hook's two lines test STUDIO_CHAT_COMMANDS_ENABLED first), so the frames are the base's, byte for byte.
 *
 * IMPORT-FREE BY DESIGN (scripts/test-studio-chat-commands.mjs transpiles this file into a bare function scope with a fake `process`).
 */

export const STUDIO_CHAT_COMMANDS_ENABLED =
  process.env.NEXT_PUBLIC_STUDIO_CHAT_COMMANDS === 'true' &&
  process.env.NEXT_PUBLIC_STUDIO_CHAT_CLEAN === 'true' &&
  process.env.NEXT_PUBLIC_STUDIO_V4_SHELL === 'true'

/** The capabilities Director checks before it acts on the new reference kinds and on `command` (appended after the caps already there). */
export const MENTIONS2_CLIENT_CAP = 'mentions2'
export const COMMANDS1_CLIENT_CAP = 'commands1'

export type ChatCommandWireName = 'add_slide' | 'duplicate_slide' | 'delete_slide'

export interface FileMentionReference { kind: 'file'; file_id: string; name: string; source: 'upload' | 'second_brain' }
export interface TemplateMentionReference { kind: 'template'; template_id: string; name: string }
export interface ThemeMentionReference { kind: 'theme'; theme_id: string; name: string; source: 'preset' | 'saved' }
/** The one element reference Studio already builds (lib/chat-element-refine.ts); a picked @Element token carries the one captured at the pick. */
export interface ElementMentionReference { kind: 'element'; element_id: string; element_type: string; slide_index: number; slide_id: string | null; label: string }
export type MentionReference = FileMentionReference | TemplateMentionReference | ThemeMentionReference | ElementMentionReference

/** At most this many typed references from the menus on one message (slides are K1's own and are not counted). */
export const CHAT_MENTIONS_MAX = 20

// ---- the readable tokens in the text --------------------------------------------------------------------------------------------------

/** A label that can sit inside `@[Kind: label]`: no brackets, no line breaks, one line, 60 characters at most. */
export function mentionLabel(value: unknown): string {
  const text = typeof value === 'string' ? value : ''
  const clean = text.replace(/[\[\]\r\n]+/g, ' ').replace(/\s+/g, ' ').trim()
  return Array.from(clean).slice(0, 60).join('').trim()
}

export const elementToken = (label: string) => `@[Element: ${mentionLabel(label) || 'selected element'}]`
export const fileToken = (name: string) => `@[File: ${mentionLabel(name) || 'file'}]`
export const templateToken = (name: string) => `@[Template: ${mentionLabel(name) || 'template'}]`
/** A saved theme reads "(saved)" so it can never be taken for the preset of the same name. */
export const themeToken = (name: string, source: 'preset' | 'saved') => `@[Theme: ${mentionLabel(name) || 'theme'}${source === 'saved' ? ' (saved)' : ''}]`

// ---- what a pick registers, and what a send takes ------------------------------------------------------------------------------------------

/** The composer registers a picked mention here (token -> reference) and the command a pre-fill started; the hook reads them when the message goes out. */
export const chatCommandsBus: {
  mentions: Map<string, MentionReference>
  command: { name: ChatCommandWireName; pattern: RegExp } | null
} = { mentions: new Map(), command: null }

export function registerMention(token: string, reference: MentionReference): void {
  chatCommandsBus.mentions.delete(token)
  chatCommandsBus.mentions.set(token, reference)
  while (chatCommandsBus.mentions.size > CHAT_MENTIONS_MAX * 2) chatCommandsBus.mentions.delete(chatCommandsBus.mentions.keys().next().value as string)
}

export function registerCommand(name: ChatCommandWireName, pattern: RegExp): void {
  chatCommandsBus.command = { name, pattern }
}

export function clearChatCommands(): void {
  chatCommandsBus.mentions.clear()
  chatCommandsBus.command = null
}

/** The references whose token is STILL in the text (a deleted token drops its reference), in the order the tokens appear, each once, at most CHAT_MENTIONS_MAX. */
export function referencesInText(text: string): MentionReference[] {
  const found: Array<{ at: number; reference: MentionReference }> = []
  for (const [token, reference] of chatCommandsBus.mentions) {
    const at = typeof text === 'string' ? text.indexOf(token) : -1
    if (at >= 0) found.push({ at, reference })
  }
  return found.sort((a, b) => a.at - b.at).slice(0, CHAT_MENTIONS_MAX).map(item => item.reference)
}

/** The command the text still reads as (the verb phrase the pre-fill began with), else null: an edited-away request carries no hint. */
export function commandInText(text: string): ChatCommandWireName | null {
  const command = chatCommandsBus.command
  return command && typeof text === 'string' && command.pattern.test(text) ? command.name : null
}

/**
 * Adds the capabilities, the picked references and the command to a built `user_message.data`, in place. Called only with the flag on, AFTER the K1 slide references and the
 * element refine's reference are in. Kinds 'slide' and 'element' stay as they are; a picked @Element token replaces the live selection's reference rather than adding a second,
 * so there is never more than one element reference.
 */
export function addChatCommandsFields(data: Record<string, unknown>, text: string): Record<string, unknown> {
  const caps = Array.isArray(data.client_caps) ? (data.client_caps as unknown[]).filter(cap => typeof cap === 'string') as string[] : []
  data.client_caps = [...caps, ...[MENTIONS2_CLIENT_CAP, COMMANDS1_CLIENT_CAP].filter(cap => !caps.includes(cap))]
  const picked = referencesInText(text)
  if (picked.length) {
    const existing = Array.isArray(data.references) ? (data.references as Array<{ kind?: unknown }>) : []
    const element = picked.find(reference => reference.kind === 'element')
    const kept = element ? existing.filter(reference => reference?.kind !== 'element') : existing
    const rest = picked.filter(reference => reference.kind !== 'element')
    data.references = [...kept, ...(element ? [element] : []), ...rest]
  }
  const command = commandInText(text)
  if (command) data.command = command
  return data
}

/** The message went out: what it used is spent (a later message must not carry a stale command or the same picks unless they are picked or typed again). */
export function chatCommandsSent(text: string): void {
  for (const [token] of Array.from(chatCommandsBus.mentions)) if (typeof text === 'string' && text.includes(token)) chatCommandsBus.mentions.delete(token)
  chatCommandsBus.command = null
}
