/**
 * FRONTEND-2 (B49b, 29 Oct; follow-up to #551, E2E-2 run-B5: an exact-text set on a slide TITLE drew it at 20px instead of 42px/700): text set keep look
 * (NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK, exact "true", default off, read at build time; it acts only where #551's NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET already sends the words).
 *
 * Root cause (Layout, read-only at layout-builder frontend2/layout-targeted-save). #551 writes the user's words as one `<p>` per paragraph (lib/chat-element-text-set.ts elementTextToHtml). Layout styles a `<p>` inside a
 * text box as BODY text: src/styles/content-typography.css `.textbox-content:not(.leaf-rendered-content) p { font-size: var(--theme-body-p-size); color: var(--theme-text-body); ... }` (and textbox.css's paragraph margins).
 * A title box gets its look from text sitting DIRECTLY in `.textbox-content`, which carries the box's own inline text style (font-size 42px, weight 700 ...): a `<p>` inside it is not that text any more, it takes the body
 * paragraph size (20px) and the body colour. The words stored are exact; only the look of a title-type box is lost.
 *
 * With the flag on, the words are written in the box's EXISTING structure, which Studio reads first with Layout's existing READ command `getTextBoxContent {elementId}` (viewer/presentation-viewer.html, ElementManager.getTextBoxContent:
 * the `.textbox-content` innerHTML; no new Layout command; the generation context's element summary is plain text and says nothing of structure):
 *  - 'inline'     `.textbox-content` has no block child (no p, div, ul, ol, li, h1-h6, blockquote, table ...): the escaped words go inline, a `<br>` between lines and no `<p>`. This is a title, an eyebrow, a one-line label.
 *  - 'paragraphs' the content is `<p>` blocks (and no other block): one `<p>` per line, as #551 writes.
 *  - 'other'      any other block structure (a list, a heading element, a div, a table, a mix): #551's behaviour, one `<p>` per line. Not changed here on purpose: the look of those depends on the block's own element.
 *  - 'unread'     the structure could not be read (the command failed, answered no content, or timed out): #551's behaviour, one `<p>` per line. The edit is never failed for it.
 * Still escaped text, never HTML (the value rules are #551's, unchanged). Run-level formatting inside the old text (an accent span, a bold word) is not carried over, as in #551: the ok line claims only the words.
 *
 * Imports only #551's escaping (itself import-free). Flag off: nothing here runs.
 */
import { elementTextToHtml, escapeElementText } from '@/lib/chat-element-text-set'

export const CHAT_TEXT_SET_KEEP_LOOK_ENABLED = process.env.NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK === 'true'

/** Layout's existing read of a text box's content (the `.textbox-content` innerHTML). */
export const KEEP_LOOK_READ_COMMAND = 'getTextBoxContent'

export type TextBoxStructure = 'inline' | 'paragraphs' | 'other' | 'unread'

/** The elements that make a block of their own inside a text box (an element not in this list is inline for this purpose: span, strong, em, a, br, sup, ...). */
const BLOCK_TAGS = new Set([
  'p', 'div', 'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'section', 'article', 'header', 'footer', 'aside', 'nav', 'main', 'figure', 'figcaption', 'form', 'fieldset', 'address', 'hr',
])

/** The structure of a `.textbox-content` innerHTML; 'unread' when there is none (null: the read failed). Comments are not elements. */
export function textBoxStructure(html: string | null | undefined): TextBoxStructure {
  if (typeof html !== 'string') return 'unread'
  const tags = new Set<string>()
  for (const match of html.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<\s*([A-Za-z][A-Za-z0-9]*)(?=[\s/>])/g)) {
    const name = match[1].toLowerCase()
    if (BLOCK_TAGS.has(name)) tags.add(name)
  }
  if (tags.size === 0) return 'inline'
  return tags.size === 1 && tags.has('p') ? 'paragraphs' : 'other'
}

/** The content to write for the words in a box of this structure: inline text with `<br>` between lines for an inline box, else #551's `<p>` per line. The lines are the same ones #551 writes (a line with no word is none). */
export function keepLookHtml(text: string, structure: TextBoxStructure): string {
  if (structure !== 'inline') return elementTextToHtml(text)
  return text.split('\n').filter(line => line.trim() !== '').map(line => escapeElementText(line)).join('<br>')
}

/** The content of a `getTextBoxContent` answer, or null (not a success, no content string). */
export function contentFromReply(reply: unknown): string | null {
  const record = reply && typeof reply === 'object' ? reply as { success?: unknown; content?: unknown } : null
  return record && record.success !== false && typeof record.content === 'string' ? record.content : null
}

/**
 * Sets the content of the plan's one text step (`updateTextBoxContent`, lib/chat-element-edit.ts planViewerSteps) from the box's structure. Never throws and never fails the edit: whatever goes wrong with the read, the step keeps #551's
 * `<p>` content. Returns the structure it wrote for (for the proof; the runner ignores it).
 */
export async function keepLookContent(
  steps: ReadonlyArray<{ params: Record<string, unknown> }>, text: string, elementId: string,
  read: (action: string, params: Record<string, unknown>) => Promise<unknown>,
): Promise<TextBoxStructure> {
  const step = steps.find(item => item.params.elementId === elementId && typeof item.params.content === 'string')
  if (!step) return 'unread'
  let structure: TextBoxStructure = 'unread'
  try {
    structure = textBoxStructure(contentFromReply(await read(KEEP_LOOK_READ_COMMAND, { elementId })))
  } catch {
    structure = 'unread'
  }
  step.params.content = keepLookHtml(text, structure)
  return structure
}
