// FRONTEND-1 (PROGRAM-1 E5, chat add free slot, 4 Nov). Flag NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED (the string "true", default off, build-time): a chat add moves to a free area of the slide at its own size,
// with its caption row (lib/chat-add-free-slot.ts). Every line this change adds to an EXISTING file is a pure insertion that carries the marker CHAT-ADD-FREE-SLOT (a whole token): hooks/use-textlabs-generation.ts
// (one import and one line right after the CHAT-ADD-STACKING line, before the insert). No existing line is rewritten. Strip the marked lines and the file is its base, byte for byte.
// How the older pins reach it: this change REGISTERS its files, its .env.example block and this strip (scripts/studio-later-changes.mjs, three lines). Plain node, no imports, nothing read from disk or git here.

export const BASE_COMMIT = '3e1ce88eec23fbfd33f249332d06a65ad05ffc40' // origin/studio-v4-dev-preparation-code under this change
export const CHAT_ADD_FREE_SLOT_FLAG = 'NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED'
export const CHAT_ADD_FREE_SLOT_MARKER = 'CHAT-ADD-FREE-SLOT'
/** The marker as a WHOLE token. */
export const CHAT_ADD_FREE_SLOT_MARKER_RE = /(?<![\w-])CHAT-ADD-FREE-SLOT(?![\w-])/

/** Existing files that get marked lines. */
export const CHAT_ADD_FREE_SLOT_FILES = ['hooks/use-textlabs-generation.ts']

/** The older proofs this change teaches (they listed the hook's strips by hand): [line now, line before] per edit, whole lines, plus one marked import of the registry each; the strip puts the old text back. */
export const CHAT_ADD_FREE_SLOT_EDITS = {
  "scripts/test-studio-image-pending-write.mjs": [
    [
      "  source = laterStripsForChatAddFreeSlot.find(fn => fn.name === 'stripChatAddFreeSlot')('hooks/use-textlabs-generation.ts', stripChatAddStacking('hooks/use-textlabs-generation.ts', source)) // LATER-CHANGES: registry read (CHAT-ADD-STACKING), then (CHAT-ADD-FREE-SLOT) from the registry\n",
      "  source = stripChatAddStacking('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-STACKING)\n"
    ]
  ],
  "scripts/test-textbox-role-contract.mjs": [
    [
      "const generationSource = laterStripsForChatAddFreeSlot.find(fn => fn.name === 'stripChatAddFreeSlot')('hooks/use-textlabs-generation.ts', stripChatAddStacking('hooks/use-textlabs-generation.ts', stripChatAddTargeted('hooks/use-textlabs-generation.ts', fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8')))) // LATER-CHANGES: registry read (CHAT-ADD-STACKING) after (CHAT-ADD-TARGETED), then (CHAT-ADD-FREE-SLOT) from the registry\n",
      "const generationSource = stripChatAddStacking('hooks/use-textlabs-generation.ts', stripChatAddTargeted('hooks/use-textlabs-generation.ts', fs.readFileSync(new URL('../hooks/use-textlabs-generation.ts', import.meta.url), 'utf8'))) // LATER-CHANGES: registry read (CHAT-ADD-STACKING) after (CHAT-ADD-TARGETED)\n"
    ]
  ],
  "scripts/test-studio-chat-element-refine.mjs": [
    [
      "const { stripChatAddTargeted } = await import('./studio-chat-add-targeted-strip.mjs'), { stripChatAddStacking } = await import('./studio-chat-add-stacking-strip.mjs'), read = rel => laterStripsForChatAddFreeSlot.find(fn => fn.name === 'stripChatAddFreeSlot')(rel, stripChatAddStacking(rel, stripChatAddTargeted(rel, stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8')))))) /* then (CHAT-ADD-FREE-SLOT) from the registry */ // LATER-CHANGES: registry read (CHAT-ADD-STACKING) after (CHAT-ADD-TARGETED): the targeted chat add and the chat add stacking stacked after this change, so their marked lines in the generation hook come out first; one line, so the older stacked-scope checks (model-catalog, narration-router) still find stripLaunchWording on every added line\n",
      "const { stripChatAddTargeted } = await import('./studio-chat-add-targeted-strip.mjs'), { stripChatAddStacking } = await import('./studio-chat-add-stacking-strip.mjs'), read = rel => stripChatAddStacking(rel, stripChatAddTargeted(rel, stripFirstPaint(rel, stripLaunchWording(rel, fs.readFileSync(path.join(root, rel), 'utf8'))))) // LATER-CHANGES: registry read (CHAT-ADD-STACKING) after (CHAT-ADD-TARGETED): the targeted chat add and the chat add stacking stacked after this change, so their marked lines in the generation hook come out first; one line, so the older stacked-scope checks (model-catalog, narration-router) still find stripLaunchWording on every added line\n"
    ],
    [
      "    added.splice(0, added.length, ...added.filter(line => !/^\\+import \\{ stripBulkEditUndo \\} from '\\.\\/studio-bulk-edit-undo-strip\\.mjs'|LATER-CHANGES: registry read \\(CHAT-ADD-STACKING\\)|LATER-CHANGES: registry read \\(CHAT-ADD-FREE-SLOT\\)/.test(line))) // stacked after #475: the bulk edit + chat undo change (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) chains its strip into this root with one import line; that line is a later PR's, not this change's // LATER-CHANGES: registry read (CHAT-ADD-STACKING): this root's filter also takes the chat add stacking's one import and one call in the pins that read the generation hook (B48; stacked after #475)\n",
      "    added.splice(0, added.length, ...added.filter(line => !/^\\+import \\{ stripBulkEditUndo \\} from '\\.\\/studio-bulk-edit-undo-strip\\.mjs'|LATER-CHANGES: registry read \\(CHAT-ADD-STACKING\\)/.test(line))) // stacked after #475: the bulk edit + chat undo change (NEXT_PUBLIC_STUDIO_BULK_EDIT / NEXT_PUBLIC_STUDIO_CHAT_UNDO) chains its strip into this root with one import line; that line is a later PR's, not this change's // LATER-CHANGES: registry read (CHAT-ADD-STACKING): this root's filter also takes the chat add stacking's one import and one call in the pins that read the generation hook (B48; stacked after #475)\n"
    ]
  ],
  "scripts/test-studio-element-free-spot.mjs": [
    [
      "    source = laterStripsForChatAddFreeSlot.find(fn => fn.name === 'stripChatAddFreeSlot')(HOOK, stripChatAddStacking(HOOK, source)) // LATER-CHANGES: registry read (CHAT-ADD-STACKING), then (CHAT-ADD-FREE-SLOT) from the registry\n",
      "    source = stripChatAddStacking(HOOK, source) // LATER-CHANGES: registry read (CHAT-ADD-STACKING)\n"
    ]
  ],
  "scripts/test-studio-element-placeholder-fix.mjs": [
    [
      "      source = laterStripsForChatAddFreeSlot.find(fn => fn.name === 'stripChatAddFreeSlot')('hooks/use-textlabs-generation.ts', stripChatAddStacking('hooks/use-textlabs-generation.ts', source)) // LATER-CHANGES: registry read (CHAT-ADD-STACKING), then (CHAT-ADD-FREE-SLOT) from the registry\n",
      "      source = stripChatAddStacking('hooks/use-textlabs-generation.ts', source) // LATER-CHANGES: registry read (CHAT-ADD-STACKING)\n"
    ]
  ]
}

/** The proofs taught. */
export const CHAT_ADD_FREE_SLOT_PIN_FILES = Object.keys(CHAT_ADD_FREE_SLOT_EDITS)

/** New files (no base text to put back). */
export const CHAT_ADD_FREE_SLOT_NEW_FILES = ['lib/chat-add-free-slot.ts', 'scripts/studio-chat-add-free-slot-strip.mjs', 'scripts/test-studio-chat-add-free-slot.mjs']

/** Files this change edits that are neither marked app code nor new: its .env.example block and the registry (three lines). Run the proof with `node scripts/test-studio-chat-add-free-slot.mjs`. */
export const CHAT_ADD_FREE_SLOT_OWN_EDITS = ['.env.example', 'scripts/studio-later-changes.mjs', ...CHAT_ADD_FREE_SLOT_PIN_FILES]

/** Every file this change's commits touch. */
export const CHAT_ADD_FREE_SLOT_SCOPE_FILES = new Set([...CHAT_ADD_FREE_SLOT_FILES, ...CHAT_ADD_FREE_SLOT_NEW_FILES, ...CHAT_ADD_FREE_SLOT_OWN_EDITS])

/** The whole .env.example block. */
export const CHAT_ADD_FREE_SLOT_ENV_BLOCK = `# STUDIO CHAT ADD FREE SLOT (PROGRAM-1 E5 / FRONTEND-1). On only for the exact string "true"; default off, and then a chat add is inserted where it always was. Build-time value: change it on Vercel and redeploy.
# On: right before a chat add ("add a bar chart ... to slide 2") is inserted, the Studio asks the viewer for the slide's elements and MOVES the new element to the first free area of the content area at its own size (never shrunk).
# A picture with a caption row moves with its caption (the caption shifts by the same offset; an unreadable caption position keeps both in place). No room, an unreadable answer or a slow viewer (FREE_SPOT_READ_TIMEOUT_MS, logged): the old position.
NEXT_PUBLIC_STUDIO_CHAT_ADD_FREE_SLOT_ENABLED="false"
`

/** The file without this change's lines: every line that carries the marker (as a whole token) comes out, every other byte stays. Any other file is returned as it is. */
export function stripChatAddFreeSlot(rel, text) {
  if (typeof text !== 'string') return text
  if (rel in CHAT_ADD_FREE_SLOT_EDITS) text = CHAT_ADD_FREE_SLOT_EDITS[rel].reduce((out, [has, was]) => out.replace(has, () => was), text) // a taught proof: its previous lines, then its marked import comes out below
  else if (!CHAT_ADD_FREE_SLOT_FILES.includes(rel)) return text
  return text.split('\n').filter(line => !CHAT_ADD_FREE_SLOT_MARKER_RE.test(line)).join('\n')
}
