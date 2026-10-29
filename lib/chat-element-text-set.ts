/**
 * FRONTEND-2 (B49, 29 Oct; parity row 44, E2E-2 29 Oct 03:26-03:30Z: "Change this to 'Order Smarter, Waste Less'." on a selected title came back as a model rewrite): the Studio half of element_edit op "text"
 * (NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET, exact "true", default off, read at build time in lib/chat-element-edit-wire.ts; Director's half is DIRECTOR_MDC_ELEMENT_TEXT_SET_ENABLED). A chat "Change this to '<words>'" on
 * ONE selected text box sets exactly those words: no AI rewrite, the box keeps its style.
 *
 * Contract (DIRECTOR-2 <-> FRONTEND-2, 29 Oct): Director's `element_edit` frame, op "text", `text` = a plain string of 1 to 500 characters (the user's own words, no HTML, "\n" between paragraphs), for a TEXT_BOX only.
 * Studio answers the existing `element_edit_result {directive_id, ok, error_code?}`, `ok:true` only once the text is STORED (the runner's targeted save, lib/chat-edit-targeted.ts, or its save acknowledgement). Codes:
 * INVALID_VALUE (empty, over 500 characters, HTML), UNSUPPORTED_OP (not a text box, or a text box the viewer will not rewrite), and the runner's own SLIDE_CHANGED / ELEMENT_NOT_FOUND / ELEMENT_LOCKED / VIEWER_NOT_READY / BUSY / SAVE_FAILED.
 * The capability `element_text1` is advertised (lib/chat-element-edit-wire.ts addChatElementEditCaps) only while the flag is on, after `element_edit1`: Director sends op "text" only to a client that has it.
 *
 * The Layout command (layout-builder viewer/presentation-viewer.html `updateTextBoxContent {elementId, content}` -> src/utils/element-manager.js updateTextBoxContent): it sets the `.textbox-content` element's innerHTML and the
 * registry's content, and refuses a text box that carries typed generation params ("RECREATE_REQUIRED", UNSUPPORTED_OP here). The box's OWN style is not content: font, size, colour, weight, alignment, line height and the theme
 * bindings are inline styles on `.textbox-content` and data attributes of the box, and the container's background, border and padding are the box's. They stay. What is replaced is what was inside: runs formatted inside the old text
 * (a bold word, a link) are not carried over. The command takes HTML, so Studio sends TEXT, escaped, never the value as given: one `<p>` per paragraph (`.textbox-content p` is the paragraph Layout's own typography styles).
 *
 * Import-free (types only), so the proof runs it under plain node. Flag off: nothing here runs.
 */
import type { ElementEditErrorCode } from '@/lib/chat-element-edit-wire'

/** Contract: the value is 1 to 500 characters (Director counts code points, as Python's len does). */
export const ELEMENT_TEXT_MIN_CHARS = 1
export const ELEMENT_TEXT_MAX_CHARS = 500
/** The viewer command that sets a text box's content (HTML). */
export const ELEMENT_TEXT_VIEWER_COMMAND = 'updateTextBoxContent'

/** A tag (open or close), a comment, a doctype / CDATA or a processing instruction: markup, which the contract forbids. A bare "<" or ">" ("5 < 6") is text. */
const HTML_LOOKING = /<\/?[A-Za-z][^<>]*>|<!--|<![A-Za-z[]|<\?/

export type ValidElementText = { ok: true; text: string } | { ok: false; code: Extract<ElementEditErrorCode, 'INVALID_VALUE'> }

/** The value as the contract allows it: a string of 1 to 500 characters with at least one word, no HTML. Line breaks become "\n". INVALID_VALUE otherwise (nothing is sent to the viewer). */
export function validateElementText(value: unknown): ValidElementText {
  const invalid = { ok: false as const, code: 'INVALID_VALUE' as const }
  if (typeof value !== 'string') return invalid
  const text = value.replace(/\r\n?/g, '\n')
  const length = Array.from(text).length
  if (length < ELEMENT_TEXT_MIN_CHARS || length > ELEMENT_TEXT_MAX_CHARS) return invalid
  if (text.trim() === '' || HTML_LOOKING.test(text)) return invalid
  return { ok: true, text }
}

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }

/** The words as text inside markup: every character that could open a tag, an entity or an attribute is escaped. */
export function escapeElementText(text: string): string {
  return text.replace(/[&<>"']/g, character => ESCAPES[character])
}

/** The content the viewer command gets: one escaped `<p>` per line of the value ("\n" separates paragraphs); a line with no word in it is not a paragraph. */
export function elementTextToHtml(text: string): string {
  return text.split('\n').filter(line => line.trim() !== '').map(line => `<p>${escapeElementText(line)}</p>`).join('')
}
