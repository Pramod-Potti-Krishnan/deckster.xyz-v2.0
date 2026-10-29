// FRONTEND-2 (B48, 29 Oct; E2E-2 B3 row 42, Studio dev 973fa22b, deck d68f9b14: a chart added by chat sat at z 1 under the slide's content and infographic, so a click selected the infographic). Flag NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING
// (exact "true", default off, build-time): a chat-added element is inserted at the z the Element panel's own add of that type starts at (TEXT_LABS_ELEMENT_DEFAULTS, 1000), not the chat directive's z 1 (lib/mdc-element-directive.ts BASE), so it lands on top of the
// slide's z-100 content like a panel add and can be selected. The cause is Studio's: Layout honours the z it is sent.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-ADD-STACKING (a whole token): hooks/use-textlabs-generation.ts (one import, the one line after buildInsertionParams). Strip those lines and the file is its base,
// byte for byte. The new lib lib/chat-add-stacking.ts holds the flag and the rule.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read the generation hook raw (each one registry-read line, as #546 taught them for
// CHAT-ADD-TARGETED; two of them replace #546's line with one that reads both strips, and are put back to the line from before #546, so the two strips commute in the registry's order). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = 'cdadebac01e7baa136e597587da6a80e87e93077' // frontend2/mdc-element-fields (#547) @ cdadebac: dev 9a62b4e6 (#548 merged) with #549 and #547 stacked on it. This change is merged with it and read against it (it was cut from 973fa22b, #546), so the blocks and lines of the two changes below it are part of its base.
export const CHAT_ADD_STACKING_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING'
export const CHAT_ADD_STACKING_MARKER = 'CHAT-ADD-STACKING'
/** The marker as a WHOLE token: CHAT-ADD-STACKING-X and X-CHAT-ADD-STACKING are not it (and neither is the older CHAT-ADD-TARGETED). */
export const CHAT_ADD_STACKING_MARKER_RE = /(?<![\w-])CHAT-ADD-STACKING(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Targeted chat add:": #546's scope check finds its own commits by that prefix). */
export const CHAT_ADD_STACKING_SUBJECT = 'Chat add stacking:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_ADD_STACKING_FILES = [
  'hooks/use-textlabs-generation.ts',
]

/** New files (no base text to put back). */
export const CHAT_ADD_STACKING_NEW_FILES = [
  'lib/chat-add-stacking.ts',
  'scripts/studio-chat-add-stacking-strip.mjs',
  'scripts/test-studio-chat-add-stacking.mjs',
  'scripts/fixtures/chat-add-stacking/layout-transcripts.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_ADD_STACKING_PIN_MARK. */
export const CHAT_ADD_STACKING_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-ADD-STACKING)'
export const CHAT_ADD_STACKING_PIN_EDITS = {
  "scripts/test-studio-chat-element-refine.mjs": [
    ["const { stripChatAddTargeted } = await import('./studio-chat-add-targeted-strip.mjs'), { stripChatAddStacking } = await import('./studio-chat-add-stacking-strip.mjs'), read = rel => stripChatAddStacking(rel, stripChatAddTargeted(rel, stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8'))))) // LATER-CHANGES: registry read (CHAT-ADD-STACKING) after (CHAT-ADD-TARGETED): the targeted chat add and the chat add stacking stacked after this change, so their marked lines in the generation hook come out first; one line, so the older stacked-scope checks (model-catalog, narration-router) still find stripLaunchWording on every added line\n",
     "const read = rel => stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8')))\n"],
    ["    added.splice(0, added.length, ...added.filter(line => !/^\\+import \\{ stripBulkEditUndo \\} from '\\.\\/studio-bulk-edit-undo-strip\\.mjs'|LATER-CHANGES: registry read \\(CHAT-ADD-STACKING\\)/.test(line))) // stacked after #475: the bulk edit + chat undo change (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) chains its strip into this root with one import line; that line is a later PR's, not this change's // LATER-CHANGES: registry read (CHAT-ADD-STACKING): this root's filter also takes the chat add stacking's one import and one call in the pins that read the generation hook (B48; stacked after #475)\n",
     "    added.splice(0, added.length, ...added.filter(line => !/^\\+import \\{ stripBulkEditUndo \\} from '\\.\\/studio-bulk-edit-undo-strip\\.mjs'/.test(line))) // stacked after #475: the bulk edit + chat undo change (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) chains its strip into this root with one import line; that line is a later PR's, not this change's\n"],
  ],
  "scripts/test-textbox-role-contract.mjs": [
    ["import { stripChatAddStacking } from './studio-chat-add-stacking-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-STACKING): the chat add stacking stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["const generationSource = stripChatAddStacking('hooks/use-textlabs-generation.ts', stripChatAddTargeted('hooks/use-textlabs-generation.ts', fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8'))) // LATER-CHANGES: registry read (CHAT-ADD-STACKING) after (CHAT-ADD-TARGETED)\n",
     "const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')\n"],
  ],
  "scripts/test-studio-element-free-spot.mjs": [
    ["import { stripChatAddStacking } from './studio-chat-add-stacking-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-STACKING): the chat add stacking stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["    source = stripChatAddStacking(HOOK, source) // LATER-CHANGES: registry read (CHAT-ADD-STACKING)\n",
     ""],
  ],
  "scripts/test-studio-element-placeholder-fix.mjs": [
    ["import { stripChatAddStacking } from './studio-chat-add-stacking-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-STACKING): the chat add stacking stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["      source = stripChatAddStacking('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-STACKING)\n",
     ""],
  ],
  "scripts/test-studio-image-pending-write.mjs": [
    ["import { stripChatAddStacking } from './studio-chat-add-stacking-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-STACKING): the chat add stacking stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["  source = stripChatAddStacking('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-STACKING)\n",
     ""],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_ADD_STACKING_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_ADD_STACKING_PIN_FILES = Object.keys(CHAT_ADD_STACKING_PIN_EDITS)

export const CHAT_ADD_STACKING_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ADD_STACKING_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_ADD_STACKING_SCOPE_FILES = new Set([...CHAT_ADD_STACKING_FILES, ...CHAT_ADD_STACKING_NEW_FILES, ...CHAT_ADD_STACKING_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_ADD_STACKING_ENV_BLOCK = `# STUDIO CHAT ADD STACKING (FRONTEND-2, B48; E2E-2 B3 row 42, Studio dev, 29 Oct: a chart added by chat sat under the slide's content and could not be clicked). On for the exact value "true"; default off, and then a chat add is inserted exactly as today. Build-time value: change it on Vercel and redeploy.
# On, an element added by chat (text box, metrics, image, chart, icon label, shape) is inserted at the layer the Element panel's own add of that type starts at (1000), not at layer 1 under the slide's other elements (100), so it is on top, visible, and a click selects it. Position, size, content and the way it is saved are not changed. The manual Add Element panel and a chat refine are not touched. Layout is not involved.
NEXT_PUBLIC_STUDIO_CHAT_ADD_STACKING="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatAddStacking(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_ADD_STACKING_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_ADD_STACKING_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_ADD_STACKING_MARKER_RE.test(line)).join('\n')
}
