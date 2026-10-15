// PASS2B G48 (flag NEXT_PUBLIC_STUDIO_SESSION_ROW_QUIET, default off). Import-free: words and one pure test only.
//
// The Sessions panel's row carried a message preview and a stage word under every title. The preview was the same canned Director line on
// almost every row ("Your presentation is ready." on every finished deck, the greeting on every empty one) and the stage read "Unknown" for a
// session that had not started; the accepted v4 mockup shows the title and "12 slides · Just now" only. Behind the flag the row drops a preview
// that is one of Director's canned lines (a real first prompt or a real reply is kept) and calls a session without a stage "Draft".

/** The stage word for a session that has no stage yet (the base's word is "Unknown"). */
export const SESSION_ROW_NO_STAGE_LABEL = 'Draft'

// Director's own canned lines: its greeting (backend/director websocket.py `_send_greeting`, streamlined_packager.py) and its "ready" notices
// (the build-complete messages). Matched on the FIRST non-empty line only, so a longer real message that merely starts the same way is kept
// only if its first line says more than the canned sentence.
const GENERIC_FIRST_LINES: readonly RegExp[] = [
  /^hello[!.]?\s+i['’]?m\s+(?:deckster,\s+)?your\s+(?:ai\s+)?presentation\s+assistant\b/i,
  /^(?:content generation complete[!.]?\s+)?your\s+presentation\s+is\s+ready[.!]*$/i,
  /^here\s+is\s+the\s+outline\s+for\s+your\s+deck[.!]*$/i,
]

/** True when `text` is one of Director's canned lines (so a row should not repeat it under every title). */
export function isGenericSessionPreview(text: string | null | undefined): boolean {
  if (typeof text !== 'string') return false
  const firstLine = text.split(/\r?\n/).map(line => line.replace(/^[^\p{L}\p{N}]+/u, '').trim()).find(line => line !== '')
  return firstLine !== undefined && GENERIC_FIRST_LINES.some(pattern => pattern.test(firstLine))
}
