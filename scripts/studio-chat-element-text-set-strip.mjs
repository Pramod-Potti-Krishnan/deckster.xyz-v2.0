// FRONTEND-2 (B49, 29 Oct; parity row 44, E2E-2 29 Oct 03:26-03:30Z: a chat "Change this to 'Order Smarter, Waste Less'." on a selected title was rewritten by a model). Flag NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET (exact "true", default off,
// build-time): the Studio half of element_edit op "text" (Director's half is DIRECTOR_MDC_ELEMENT_TEXT_SET_ENABLED). A chat "Change this to '<words>'" on ONE selected text box sets exactly those words through Layout's own
// updateTextBoxContent, as text (escaped, one <p> per paragraph), the box keeps its style, and the result is ok:true only once Layout stored it (#540's targeted save). While the flag is on Studio also advertises the client capability
// element_text1, right after element_edit1 / notes1 (Director sends op "text" only to a client that has it, so neither flip order opens an UNSUPPORTED_OP window).
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-ELEMENT-TEXT-SET (a whole token): lib/chat-element-edit-wire.ts (the flag, the capability name, the cap's push) and lib/chat-element-edit.ts (two
// imports, the union member, the validation line, the plan's case). Strip those lines and each file is its base, byte for byte. The hook (hooks/use-deckster-websocket-v2.ts) is NOT touched: it already calls addChatElementEditCaps. The new lib
// lib/chat-element-text-set.ts holds the value check and the escaping.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read the runner or the wire raw (CHAT_ELEMENT_TEXT_SET_PIN_EDITS).
// Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '973fa22b94df309c53f3a9052938e080e4597325' // origin/studio-v4-dev-preparation-code with #546 merged: dev, which this change is cut from
export const CHAT_ELEMENT_TEXT_SET_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET'
export const CHAT_ELEMENT_TEXT_SET_MARKER = 'CHAT-ELEMENT-TEXT-SET'
/** The marker as a WHOLE token: CHAT-ELEMENT-TEXT-SET-X and X-CHAT-ELEMENT-TEXT-SET are not it. */
export const CHAT_ELEMENT_TEXT_SET_MARKER_RE = /(?<![\w-])CHAT-ELEMENT-TEXT-SET(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Chat element edit" / "Targeted chat edit:" / "Targeted chat add:": the older scope checks find their own commits by those prefixes). */
export const CHAT_ELEMENT_TEXT_SET_SUBJECT = 'Chat text set:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_ELEMENT_TEXT_SET_FILES = [
  'lib/chat-element-edit-wire.ts',
  'lib/chat-element-edit.ts',
]

/** New files (no base text to put back). */
export const CHAT_ELEMENT_TEXT_SET_NEW_FILES = [
  'lib/chat-element-text-set.ts',
  'scripts/studio-chat-element-text-set-strip.mjs',
  'scripts/test-studio-chat-element-text-set.mjs',
  'scripts/fixtures/chat-element-text-set/layout-transcripts.json',
  'scripts/fixtures/chat-element-text-set/director-frames/01-row-44-title.json', // DIRECTOR-2's recorded frames (workspace main 85b6f367, streams/director2/text-set/examples; Director MR !598 12a8c5bf), copied byte for byte
  'scripts/fixtures/chat-element-text-set/director-frames/02-multi-line.json',
  'scripts/fixtures/chat-element-text-set/director-frames/03-no-element-text1-refine-fallback.json',
  'scripts/fixtures/chat-element-text-set/director-frames/04-over-500-characters.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_ELEMENT_TEXT_SET_PIN_MARK. */
export const CHAT_ELEMENT_TEXT_SET_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET)'
export const CHAT_ELEMENT_TEXT_SET_PIN_EDITS = {
  "scripts/test-studio-chat-element-edit.mjs": [ // #522's proof: its scope check reads the first-parent line of BASE..HEAD (a branch stacked after it has others' commits there); one line, like chat parity's
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat text set:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET): on a branch stacked after this change (chat text set's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n",
     ""],
  ],
  "scripts/test-studio-deck-sync-truth.mjs": [ // B26's proof: the same first-parent scope check
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Chat text set:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET): on a branch stacked after this change (chat text set's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n",
     ""],
  ],
  "scripts/test-studio-chat-element-edit-2.mjs": [ // B32's proof reads lib/chat-element-edit.ts raw (its byte pins), past the targeted chat edit's lines; this change's come out too
    ["const textSetStrip = await import('./studio-chat-element-text-set-strip.mjs') // LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET): the chat text set stacked after this change and after the targeted chat edit\nconst read = rel => textSetStrip.stripChatElementTextSet(rel, targetedStrip.stripChatEditTargeted(rel, fs.readFileSync(path.join(repo, rel), 'utf8'))) // LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET): its marked lines come out with the targeted chat edit's, before this change's pins\n",
     "const read = rel => targetedStrip.stripChatEditTargeted(rel, fs.readFileSync(path.join(repo, rel), 'utf8')) // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED): its marked lines come out before this change's pins\n"],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_ELEMENT_TEXT_SET_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_ELEMENT_TEXT_SET_PIN_FILES = Object.keys(CHAT_ELEMENT_TEXT_SET_PIN_EDITS)

export const CHAT_ELEMENT_TEXT_SET_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ELEMENT_TEXT_SET_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_ELEMENT_TEXT_SET_SCOPE_FILES = new Set([...CHAT_ELEMENT_TEXT_SET_FILES, ...CHAT_ELEMENT_TEXT_SET_NEW_FILES, ...CHAT_ELEMENT_TEXT_SET_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_ELEMENT_TEXT_SET_ENV_BLOCK = `# STUDIO CHAT TEXT SET (FRONTEND-2, B49; parity row 44, E2E-2 29 Oct 03:26-03:30Z: a chat "Change this to 'Order Smarter, Waste Less'." on a selected title was rewritten by a model). On for the exact value "true"; default off, and then
# a chat element edit with op "text" stays INVALID_VALUE and the client does not advertise element_text1, exactly as today. Build-time value: change it on Vercel and redeploy. It acts only with NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_EDIT on (it needs
# the chat element edit runner); Studio half of Director's DIRECTOR_MDC_ELEMENT_TEXT_SET_ENABLED.
# On, Studio adds the client capability element_text1 right after element_edit1 / notes1 (Director sends op "text" only to a client that has it, so neither flip order opens an UNSUPPORTED_OP window), and an element_edit with op "text"
# {text: 1 to 500 characters, no HTML, "\\n" between paragraphs} on one selected text box sets exactly those words: through Layout's own updateTextBoxContent, as escaped text (one paragraph per line), never as markup; the box keeps its style
# (font, size, colour, alignment and the box itself); an empty, HTML or over-long value is INVALID_VALUE and nothing is stored; a box that is not a text box, or that Layout will not rewrite, is UNSUPPORTED_OP. ok:true only once Layout stored it:
# with NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE on (and Layout's LAYOUT_CHAT_TARGETED_SAVE_ENABLED) that is a save of this one element, else the runner's own save acknowledgement. No new text: Director owns the sentences.
NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatElementTextSet(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_ELEMENT_TEXT_SET_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_ELEMENT_TEXT_SET_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_ELEMENT_TEXT_SET_MARKER_RE.test(line)).join('\n')
}
