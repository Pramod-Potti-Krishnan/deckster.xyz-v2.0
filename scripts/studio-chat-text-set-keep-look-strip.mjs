// FRONTEND-2 (B49b, 29 Oct; follow-up to #551, E2E-2 run-B5: a chat exact-text set on a slide TITLE drew it at 20px instead of 42px/700). Flag NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK (exact "true", default off, build-time; it acts only where
// #551's NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET sends the words): the words are written in the text box's EXISTING structure (inline text with <br> between lines where the box held inline text, <p> where it used <p>, #551's <p> per line
// for any other structure or when the structure cannot be read), so a title stays a title. Layout styles a <p> inside a text box as body text (content-typography.css), which is what #551's <p> did to a title.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-TEXT-SET-KEEP-LOOK (a whole token): lib/chat-element-edit.ts (one import, the read of the structure before the plan runs). Strip those lines and the file
// is its base, byte for byte. The new lib lib/chat-text-set-keep-look.ts holds the flag, the structure rule and the read.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read the runner raw or check the first-parent line
// (CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'dec76f0afde6de6da906a06e5ea19d9ae5ce8ff9' // origin/studio-v4-dev-preparation-code with #551 merged: dev, which this change is cut from
export const CHAT_TEXT_SET_KEEP_LOOK_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK'
export const CHAT_TEXT_SET_KEEP_LOOK_MARKER = 'CHAT-TEXT-SET-KEEP-LOOK'
/** The marker as a WHOLE token: CHAT-TEXT-SET-KEEP-LOOK-X and X-CHAT-TEXT-SET-KEEP-LOOK are not it. */
export const CHAT_TEXT_SET_KEEP_LOOK_MARKER_RE = /(?<![\w-])CHAT-TEXT-SET-KEEP-LOOK(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Chat text set:" / "Chat element edit" / "Targeted chat ...": the older scope checks find their own commits by those prefixes). */
export const CHAT_TEXT_SET_KEEP_LOOK_SUBJECT = 'Text set keep look:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_TEXT_SET_KEEP_LOOK_FILES = [
  'lib/chat-element-edit.ts',
]

/** New files (no base text to put back). */
export const CHAT_TEXT_SET_KEEP_LOOK_NEW_FILES = [
  'lib/chat-text-set-keep-look.ts',
  'scripts/studio-chat-text-set-keep-look-strip.mjs',
  'scripts/studio-chat-text-set-keep-look-render.py',
  'scripts/test-studio-chat-text-set-keep-look.mjs',
  'scripts/fixtures/chat-text-set-keep-look/layout-transcripts.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file. Every line the proof has now carries a registry-read mark; at least one carries CHAT_TEXT_SET_KEEP_LOOK_PIN_MARK. */
export const CHAT_TEXT_SET_KEEP_LOOK_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-TEXT-SET-KEEP-LOOK)'
export const CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS = {
  // B32's proof reads lib/chat-element-edit.ts raw (its byte pins). #540 taught it two lines and the chat text set (#551) three; this block REPLACES those with four of this change's own and puts back the single line that was before all three, so the three strips commute (each finds nothing of its own to match in the others' text, and this one gives the base whichever runs first)
  "scripts/test-studio-chat-element-edit-2.mjs": [
    ["const targetedStrip = await import('./studio-chat-edit-targeted-strip.mjs') // LATER-CHANGES: registry read (CHAT-EDIT-TARGETED): the targeted chat edit stacked after this change\nconst textSetStrip = await import('./studio-chat-element-text-set-strip.mjs') // LATER-CHANGES: registry read (CHAT-ELEMENT-TEXT-SET): the chat text set stacked after this change and after the targeted chat edit\nconst keepLookStrip = await import('./studio-chat-text-set-keep-look-strip.mjs') // LATER-CHANGES: registry read (CHAT-TEXT-SET-KEEP-LOOK): the text set keep look stacked after this change, the targeted chat edit and the chat text set\nconst read = rel => keepLookStrip.stripChatTextSetKeepLook(rel, textSetStrip.stripChatElementTextSet(rel, targetedStrip.stripChatEditTargeted(rel, fs.readFileSync(path.join(repo, rel), 'utf8')))) // LATER-CHANGES: registry read (CHAT-TEXT-SET-KEEP-LOOK): its marked lines come out with the other two changes', before this change's pins\n",
     "const read = rel => fs.readFileSync(path.join(repo, rel), 'utf8')\n"],
  ],
  // the first-parent scope check of test-studio-chat-element-edit.mjs: a branch stacked after this change has this change's commits on the first-parent line
  "scripts/test-studio-chat-element-edit.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Text set keep look:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-TEXT-SET-KEEP-LOOK): on a branch stacked after this change (text set keep look's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n",
     ""],
  ],
  // the first-parent scope check of test-studio-deck-sync-truth.mjs: a branch stacked after this change has this change's commits on the first-parent line
  "scripts/test-studio-deck-sync-truth.mjs": [
    ["  shas.splice(0, shas.length, ...shas.filter(sha => !/^Text set keep look:/.test(git('log', '-1', '--format=%s', sha)))) // LATER-CHANGES: registry read (CHAT-TEXT-SET-KEEP-LOOK): on a branch stacked after this change (text set keep look's), the first-parent commits are its own, not this change's; with none left the pins and identity checks above cover the files\n",
     ""],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_TEXT_SET_KEEP_LOOK_PIN_FILES = Object.keys(CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS)

export const CHAT_TEXT_SET_KEEP_LOOK_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_TEXT_SET_KEEP_LOOK_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_TEXT_SET_KEEP_LOOK_SCOPE_FILES = new Set([...CHAT_TEXT_SET_KEEP_LOOK_FILES, ...CHAT_TEXT_SET_KEEP_LOOK_NEW_FILES, ...CHAT_TEXT_SET_KEEP_LOOK_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_TEXT_SET_KEEP_LOOK_ENV_BLOCK = `# STUDIO TEXT SET KEEP LOOK (FRONTEND-2, B49b; follow-up to NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET, E2E-2 run-B5 29 Oct: a chat exact-text set on a slide title drew it at 20px instead of 42px/700, because Layout styles a paragraph in a text box as body text).
# On for the exact value "true"; default off, and then an exact-text set writes one paragraph per line exactly as it does today. Build-time value: change it on Vercel and redeploy. It acts only where NEXT_PUBLIC_STUDIO_CHAT_ELEMENT_TEXT_SET already sets the words.
# On, the words are written in the box's existing structure, read first with Layout's own getTextBoxContent: a box that holds inline text (a title, an eyebrow, a label) gets inline text with a line break between lines and no paragraph, so it keeps its size, weight and
# colour; a box that holds paragraphs gets one paragraph per line; any other structure (a list, a heading element, a div, a table), or a box whose structure cannot be read, gets one paragraph per line as today. Still escaped text, never HTML; the value rules are unchanged;
# run-level formatting inside the old text (an accent span) is not carried over. No new text, no Director change, no new Layout command.
NEXT_PUBLIC_STUDIO_CHAT_TEXT_SET_KEEP_LOOK="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatTextSetKeepLook(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_TEXT_SET_KEEP_LOOK_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_TEXT_SET_KEEP_LOOK_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_TEXT_SET_KEEP_LOOK_MARKER_RE.test(line)).join('\n')
}
