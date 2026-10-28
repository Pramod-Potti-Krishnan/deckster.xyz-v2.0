// FRONTEND-2 (B42, 28 Oct; E2E-2 batch 2, rows 37 and 38, Studio dev, 21:11Z: each chat element ADD also wrote an "Auto-save from editor" Layout version that stored 16 layout text boxes on all 4 slides). Flag NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE
// (exact "true", default off, build-time): a chat element add saves only the NEW element through Layout's targeted save (layout-builder LAYOUT_CHAT_TARGETED_SAVE_ENABLED, !262), never through the editor's whole-deck autosave. The add-side twin of #540
// (NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE), which covers the element edit.
// Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-ADD-TARGETED (a whole token): hooks/use-textlabs-generation.ts (one import, one optional field of the layoutServiceApis type, the scope variable, the insert's
// scope opening, the new element's save, the catch's cancel). Strip those lines and the file is its base, byte for byte. The new lib lib/chat-add-targeted.ts holds the flag and the steps.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines), and teaches the older proofs that read the generation hook raw (test-studio-chat-element-refine, test-studio-image-pending-write, test-studio-element-free-spot,
// test-studio-element-placeholder-fix, test-textbox-role-contract: each one registry-read line, as #540 taught test-studio-chat-element-edit-2). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '61568fe6b7e07972051f1103749ee4551dd76ef5' // origin/studio-v4-dev-preparation-code with #544 merged (tree 59a79621): dev, which this change is cut from
export const CHAT_ADD_TARGETED_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE'
export const CHAT_ADD_TARGETED_MARKER = 'CHAT-ADD-TARGETED'
/** The marker as a WHOLE token: CHAT-ADD-TARGETED-X and X-CHAT-ADD-TARGETED are not it. */
export const CHAT_ADD_TARGETED_MARKER_RE = /(?<![\w-])CHAT-ADD-TARGETED(?![\w-])/
/** The subject prefix of this change's own commits (NOT "Targeted chat edit:": #540's scope check finds its own commits by that prefix). */
export const CHAT_ADD_TARGETED_SUBJECT = 'Targeted chat add:'

/** Existing files that get marked lines (pure insertions only). */
export const CHAT_ADD_TARGETED_FILES = [
  'hooks/use-textlabs-generation.ts',
]

/** New files (no base text to put back). */
export const CHAT_ADD_TARGETED_NEW_FILES = [
  'lib/chat-add-targeted.ts',
  'scripts/studio-chat-add-targeted-strip.mjs',
  'scripts/studio-chat-add-targeted-world.mjs',
  'scripts/test-studio-chat-add-targeted.mjs',
  'scripts/fixtures/chat-add-targeted/layout-transcripts.json',
]

/** The older proofs this change teaches: [text the proof has now, text the proof had before] per edit, whole lines, so putting them back gives the previous file byte for byte. Every line the proof has now carries CHAT_ADD_TARGETED_PIN_MARK. */
export const CHAT_ADD_TARGETED_PIN_MARK = '// LATER-CHANGES: registry read (CHAT-ADD-TARGETED)'
export const CHAT_ADD_TARGETED_PIN_EDITS = {
  'scripts/test-studio-chat-element-refine.mjs': [
    ["const addStrip = await import('./studio-chat-add-targeted-strip.mjs') // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first\nconst read = rel => addStrip.stripChatAddTargeted(rel, stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8')))) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): read through the later change's strip\n",
     "const read = rel => stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8')))\n"],
  ],
  "scripts/test-studio-element-free-spot.mjs": [
    ["import { stripChatAddTargeted } from './studio-chat-add-targeted-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["    source = stripChatAddTargeted(HOOK, source) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED)\n",
     ""],
  ],
  "scripts/test-studio-element-placeholder-fix.mjs": [
    ["import { stripChatAddTargeted } from './studio-chat-add-targeted-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["      source = stripChatAddTargeted('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED)\n",
     ""],
  ],
  "scripts/test-studio-image-pending-write.mjs": [
    ["import { stripChatAddTargeted } from './studio-chat-add-targeted-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["  source = stripChatAddTargeted('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED)\n",
     ""],
  ],
  "scripts/test-textbox-role-contract.mjs": [
    ["import { stripChatAddTargeted } from './studio-chat-add-targeted-strip.mjs' // LATER-CHANGES: registry read (CHAT-ADD-TARGETED): the targeted chat add stacked after this change, so its marked lines in the generation hook come out first\n",
     ""],
    ["const generationSource = stripChatAddTargeted('hooks/use-textlabs-generation.ts', fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')) // LATER-CHANGES: registry read (CHAT-ADD-TARGETED)\n",
     "const generationSource = fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')\n"],
  ],
}

/** The proof without this change's edits (the previous file). Used by the strip and the proof. */
export function putBackPin(rel, text) {
  return (CHAT_ADD_TARGETED_PIN_EDITS[rel] || []).reduce((out, [has, was]) => out.replace(has, () => was), text)
}

/** The older proofs this change teaches. */
export const CHAT_ADD_TARGETED_PIN_FILES = Object.keys(CHAT_ADD_TARGETED_PIN_EDITS)

export const CHAT_ADD_TARGETED_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ADD_TARGETED_PIN_FILES]

/** Every file this change's commits touch: what the older scope checks skip once the registry names it (scripts/studio-later-changes.mjs, LATER_CHANGE_FILES). */
export const CHAT_ADD_TARGETED_SCOPE_FILES = new Set([...CHAT_ADD_TARGETED_FILES, ...CHAT_ADD_TARGETED_NEW_FILES, ...CHAT_ADD_TARGETED_OWN_EDITS])

/** The whole .env.example block: its comment and its line. */
export const CHAT_ADD_TARGETED_ENV_BLOCK = `# STUDIO TARGETED CHAT ADD (FRONTEND-2, B42; E2E-2 batch 2, rows 37 and 38, Studio dev, 28 Oct 21:11Z: each chat element add also wrote an "Auto-save from editor" version that stored the layout text of all 4 slides as text boxes). On for the exact value "true"; default off, and then a chat element add
# is saved exactly as today. Build-time value: change it on Vercel and redeploy. The add-side twin of NEXT_PUBLIC_STUDIO_CHAT_EDIT_TARGETED_SAVE (the chat element edit); it does not need that flag.
# On, a chat element add (text box, metrics, shape, icon label, image, chart) is saved through Layout's targeted save: Layout stores that one new element and nothing else (no whole-deck "Auto-save from editor" version, so no layout text becomes text boxes on any slide). NEEDS Layout's
# LAYOUT_CHAT_TARGETED_SAVE_ENABLED on: without it the add is saved as today (by the editor's autosave) and says so in the console. A save that was started and is not confirmed fails the add (the element is removed again). The manual Add Element panel and Edit Mode are not touched.
NEXT_PUBLIC_STUDIO_CHAT_ADD_TARGETED_SAVE="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) is taken out, every other byte stays. Any other file is returned as it is. */
export function stripChatAddTargeted(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_ADD_TARGETED_PIN_EDITS) return putBackPin(rel, text) // an older proof this change taught: its previous text
  if (!CHAT_ADD_TARGETED_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_ADD_TARGETED_MARKER_RE.test(line)).join('\n')
}
